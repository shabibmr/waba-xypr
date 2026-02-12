# Functional Requirements Document (FRD)
## Genesys Webhook Service - Implementation Guide

**Service Name:** `genesys-webhook-service`  
**Version:** 1.2 (LLM-Optimized)  
**Purpose:** Ingress gateway for Genesys Cloud webhook events  
**Architecture Pattern:** Stateless, Event-Driven Microservice

---

## Table of Contents
1. [Service Overview](#1-service-overview)
2. [Core Responsibilities](#2-core-responsibilities)
3. [External Dependencies](#3-external-dependencies)
4. [Data Models](#4-data-models)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Error Handling](#7-error-handling)
8. [Security Requirements](#8-security-requirements)
9. [Testing Scenarios](#9-testing-scenarios)
10. [Implementation Notes](#10-implementation-notes)

---

## 1. Service Overview

### 1.1 Purpose
This service acts as the **SOLE ingress point** for all Genesys Cloud webhook events. It:
- Validates webhook authenticity using HMAC-SHA256 signatures
- Processes outbound agent messages (text and media)
- Routes lifecycle events (read, delivered, typing, disconnect)
- Prevents feedback loops from middleware-injected messages
- Buffers validated events into RabbitMQ for downstream processing

### 1.2 Service Characteristics
- **Stateless**: No local state persistence; all data stored in external systems
- **Multi-tenant**: Single deployment serving multiple tenants via `integrationId` routing
- **Security-critical**: First line of defense against unauthorized access
- **Latency-sensitive**: Must respond to Genesys within 5 seconds to avoid retries
- **Idempotent**: Same event processed multiple times produces same outcome

### 1.3 Architecture Position
```
Genesys Cloud → [genesys-webhook-service] → RabbitMQ → state-manager-service
                         ↓
                      MinIO (media storage)
                         ↓
                   Tenant Service (metadata)
                         ↓
                   Auth Service (OAuth tokens)
```

---

## 2. Core Responsibilities

### 2.1 Ingress Security (REQ-SEC-01)
**What:** Validate every incoming webhook request using HMAC-SHA256 signature verification.

**Why:** Ensure requests are genuinely from Genesys Cloud and haven't been tampered with.

**How:**
1. Extract `integrationId` from `channel.from.id`
2. Lookup tenant's `webhook_secret` from Tenant Service
3. Compute HMAC-SHA256 of raw request body using secret
4. Compare with `x-hub-signature-256` header using constant-time comparison
5. Reject mismatches with `403 Forbidden`

### 2.2 Event Classification (REQ-OUT-01)
**What:** Categorize incoming events by type and route to appropriate queue.

**Types:**
- **Outbound Message** (Text/Attachment) → `outboundQueue`
- **Status Event** (Receipt/Typing/Disconnect) → `statusQueue`
- **Health Check** → Acknowledge immediately, no processing

### 2.3 Media Handling (REQ-OUT-02, REQ-OUT-03)
**What:** Download agent-sent media from authenticated Genesys URLs and re-host on MinIO.

**Why:** 
- Genesys URLs are temporary and require OAuth authentication
- Centralized storage enables consistent access control
- Presigned URLs provide time-limited, secure access

**Flow:**
1. Detect `contentType: "Attachment"` in payload
2. Obtain OAuth token from Auth Service
3. Stream download from Genesys URL (no memory buffering)
4. Stream upload to MinIO bucket `media-outbound`
5. Generate 7-day presigned URL
6. Replace original URL in RabbitMQ payload

### 2.4 Loop Prevention (REQ-OUT-06)
**What:** Detect and suppress webhook events triggered by middleware's own message injections.

**Why:** Messages sent via `genesys-api-service` echo back as webhooks, creating infinite loops.

**Detection:**
- Inspect `channel.messageId`
- If matches known internal UUID pattern or middleware prefix → suppress
- Return `200 OK` to Genesys but don't publish to RabbitMQ
- Log as `echo_filtered`

### 2.5 Event Buffering
**What:** Publish structured events to RabbitMQ for asynchronous processing.

**Queues:**
- `RabbitMQ-outboundQueue`: Agent messages to be sent to customers
- `RabbitMQ-statusQueue`: Status updates for conversation state

---

## 3. External Dependencies

### 3.1 RabbitMQ
**Purpose:** Message queue for downstream event processing

**Queues Used:**
- `outboundQueue`: Outbound messages (text + media)
- `statusQueue`: Status events (delivered, read, typing, disconnect)

**Connection:**
- Protocol: AMQP 0.9.1
- Exchange: Direct
- Durability: Persistent messages
- Acknowledgment: Publisher confirms enabled

**Failure Handling:**
- Retry once on publish failure
- Log critical error if both attempts fail
- Do NOT retry webhook response to Genesys (avoid timeout)

### 3.2 MinIO
**Purpose:** Object storage for outbound media files

**Bucket:** `media-outbound`

**Operations:**
- `PUT object`: Upload media stream
- `GET presigned URL`: Generate 7-day temporary access URL

**Configuration:**
- Endpoint: `MINIO_ENDPOINT` env var
- Access Key: `MINIO_ACCESS_KEY` env var
- Secret Key: `MINIO_SECRET_KEY` env var
- Region: `us-east-1` (default)

**File Naming:**
```
{tenantId}/{year}/{month}/{day}/{uuid}.{extension}
```

**Size Limits:**
- Maximum file size: 20 MB
- Timeout: 30 seconds per upload

### 3.3 Tenant Service
**Purpose:** Resolve tenant metadata from Genesys integration ID

**API Endpoint:**
```
GET /api/v1/tenants/by-integration/{integrationId}
```

**Request:**
```http
GET /api/v1/tenants/by-integration/integration-id-5678
Authorization: Bearer {service_token}
```

**Response:**
```json
{
  "tenantId": "uuid-5678",
  "integrationId": "integration-id-5678",
  "webhookSecret": "base64-encoded-secret",
  "status": "active"
}
```

**Error Cases:**
- 404: Integration ID not found → Return `400 Bad Request` to Genesys
- 500: Tenant Service down → Return `503 Service Unavailable`

### 3.4 Auth Service
**Purpose:** Provide OAuth tokens for authenticated Genesys API calls

**API Endpoint:**
```
POST /api/v1/auth/token
```

**Request:**
```json
{
  "tenantId": "uuid-5678",
  "scope": "genesys:media:download"
}
```

**Response:**
```json
{
  "accessToken": "Bearer eyJhbGc...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

**Usage:**
```http
GET https://api.genesys.cloud/v2/downloads/{mediaId}
Authorization: Bearer eyJhbGc...
```

---

## 4. Data Models

### 4.1 Genesys Webhook Input Schema

#### 4.1.1 Text Message Example
```json
{
  "id": "msg-abc-123",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "to": {
      "id": "919876543210",
      "idType": "Phone"
    },
    "from": {
      "id": "integration-id-5678",
      "idType": "Email"
    },
    "time": "2023-01-01T12:00:00.000Z",
    "messageId": null
  },
  "type": "Text",
  "text": "Hello, how can I help you?",
  "direction": "Outbound"
}
```

#### 4.1.2 Attachment Message Example
```json
{
  "id": "msg-def-456",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "to": {
      "id": "919876543210",
      "idType": "Phone"
    },
    "from": {
      "id": "integration-id-5678",
      "idType": "Email"
    },
    "time": "2023-01-01T12:05:00.000Z",
    "messageId": null
  },
  "type": "Text",
  "text": "Here is your document",
  "direction": "Outbound",
  "content": [
    {
      "contentType": "Attachment",
      "attachment": {
        "id": "media-789",
        "url": "https://api.genesys.cloud/v2/downloads/auth-token-xyz/media-789",
        "mime": "application/pdf",
        "filename": "invoice.pdf"
      }
    }
  ]
}
```

#### 4.1.3 Status Event Example (Delivered)
```json
{
  "id": "receipt-ghi-789",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "to": {
      "id": "integration-id-5678",
      "idType": "Email"
    },
    "from": {
      "id": "919876543210",
      "idType": "Phone"
    },
    "time": "2023-01-01T12:01:00.000Z",
    "messageId": "msg-abc-123"
  },
  "type": "Receipt",
  "status": "Delivered",
  "direction": "Outbound"
}
```

#### 4.1.4 Echo Event Example (Should be Filtered)
```json
{
  "id": "msg-jkl-012",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "to": {
      "id": "919876543210",
      "idType": "Phone"
    },
    "from": {
      "id": "integration-id-5678",
      "idType": "Email"
    },
    "time": "2023-01-01T12:10:00.000Z",
    "messageId": "mw-injected-uuid-12345"
  },
  "type": "Text",
  "text": "Message sent via middleware",
  "direction": "Outbound"
}
```

### 4.2 RabbitMQ Output Schema

#### 4.2.1 Outbound Message Payload
**Queue:** `outboundQueue`

```json
{
  "tenantId": "uuid-5678",
  "genesysId": "msg-abc-123",
  "type": "message",
  "timestamp": "2023-01-01T12:00:00.000Z",
  "payload": {
    "text": "Hello, how can I help you?",
    "to_id": "919876543210",
    "to_id_type": "Phone",
    "media": null
  }
}
```

#### 4.2.2 Outbound Message with Media
```json
{
  "tenantId": "uuid-5678",
  "genesysId": "msg-def-456",
  "type": "message",
  "timestamp": "2023-01-01T12:05:00.000Z",
  "payload": {
    "text": "Here is your document",
    "to_id": "919876543210",
    "to_id_type": "Phone",
    "media": {
      "url": "https://minio.internal/media-outbound/uuid-5678/2023/01/01/abc-def-789.pdf?X-Amz-Expires=604800",
      "mime_type": "application/pdf",
      "filename": "invoice.pdf",
      "original_id": "media-789"
    }
  }
}
```

#### 4.2.3 Status Event Payload
**Queue:** `statusQueue`

```json
{
  "tenantId": "uuid-5678",
  "genesysId": "receipt-ghi-789",
  "originalMessageId": "msg-abc-123",
  "status": "delivered",
  "timestamp": "2023-01-01T12:01:00.000Z"
}
```

**Status Mapping:**
| Genesys Status | Internal Status |
|----------------|-----------------|
| Delivered      | delivered       |
| Read           | read            |
| Typing         | typing          |
| Disconnect     | disconnect      |

---

## 5. Functional Requirements

### 5.1 Webhook Ingress (REQ-SEC-01, REQ-OUT-01)

#### 5.1.1 HTTP Endpoint
```
POST /webhook
Content-Type: application/json
x-hub-signature-256: sha256=<hex-digest>
```

#### 5.1.2 Processing Steps

**Step 1: Extract Integration ID**
```python
integration_id = request_json["channel"]["from"]["id"]
```

**Step 2: Resolve Tenant**
```python
tenant_response = tenant_service.get_by_integration(integration_id)
tenant_id = tenant_response["tenantId"]
webhook_secret = tenant_response["webhookSecret"]
```

**Step 3: Validate Signature**
```python
import hmac
import hashlib

def validate_signature(raw_body: bytes, secret: str, signature_header: str) -> bool:
    """
    Validate HMAC-SHA256 signature.
    
    Args:
        raw_body: Raw request body bytes (not parsed JSON)
        secret: Webhook secret from tenant config
        signature_header: Value of x-hub-signature-256 header
        
    Returns:
        True if signature is valid, False otherwise
    """
    # Compute expected signature
    expected_signature = hmac.new(
        key=secret.encode('utf-8'),
        msg=raw_body,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    # Extract signature from header (format: "sha256=<hex>")
    provided_signature = signature_header.replace("sha256=", "")
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, provided_signature)
```

**Step 4: Classify Event**
```python
def classify_event(payload: dict) -> str:
    """
    Determine event type based on payload structure.
    
    Returns: "outbound_message" | "status_event" | "health_check" | "unknown"
    """
    if payload["direction"] != "Outbound":
        return "unknown"
    
    event_type = payload.get("type")
    
    if event_type == "Text" or event_type == "Structured":
        return "outbound_message"
    elif event_type in ["Receipt", "Typing", "Disconnect"]:
        return "status_event"
    elif event_type == "HealthCheck":
        return "health_check"
    else:
        return "unknown"
```

**Step 5: Check for Echo**
```python
def is_echo_event(payload: dict) -> bool:
    """
    Detect middleware-injected messages that should be filtered.
    
    Returns: True if this is an echo that should be suppressed
    """
    message_id = payload.get("channel", {}).get("messageId")
    
    if not message_id:
        return False
    
    # Check for middleware-specific prefixes
    echo_prefixes = ["mw-", "middleware-", "injected-"]
    
    for prefix in echo_prefixes:
        if message_id.startswith(prefix):
            return True
    
    # Check if UUID matches known injection pattern
    if is_internal_uuid(message_id):
        return True
    
    return False

def is_internal_uuid(value: str) -> bool:
    """Check if value matches internal UUID format."""
    import re
    pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    return bool(re.match(pattern, value, re.IGNORECASE))
```

#### 5.1.3 Response Codes

| Scenario | Status Code | Response Body |
|----------|-------------|---------------|
| Success | 200 OK | `{"status": "accepted"}` |
| Invalid signature | 403 Forbidden | `{"error": "Invalid signature"}` |
| Tenant not found | 400 Bad Request | `{"error": "Unknown integration"}` |
| Malformed JSON | 400 Bad Request | `{"error": "Invalid JSON"}` |
| Service error | 500 Internal Server Error | `{"error": "Processing failed"}` |
| Dependency unavailable | 503 Service Unavailable | `{"error": "Service temporarily unavailable"}` |

### 5.2 Media Processing (REQ-OUT-02, REQ-OUT-03)

#### 5.2.1 Detection Logic
```python
def has_media(payload: dict) -> bool:
    """Check if payload contains media attachments."""
    content = payload.get("content", [])
    return any(item.get("contentType") == "Attachment" for item in content)

def extract_attachments(payload: dict) -> list:
    """Extract all attachment objects from payload."""
    content = payload.get("content", [])
    attachments = []
    
    for item in content:
        if item.get("contentType") == "Attachment":
            attachments.append(item["attachment"])
    
    return attachments
```

#### 5.2.2 Download and Upload Flow
```python
import requests
from io import BytesIO

async def process_media(attachment: dict, tenant_id: str) -> dict:
    """
    Download media from Genesys and upload to MinIO.
    
    Args:
        attachment: Genesys attachment object
        tenant_id: Tenant identifier for MinIO path
        
    Returns:
        dict with url, mime_type, filename, original_id
    """
    # Step 1: Get OAuth token
    auth_token = await auth_service.get_token(tenant_id, scope="genesys:media:download")
    
    # Step 2: Download from Genesys (streaming)
    genesys_url = attachment["url"]
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    response = requests.get(genesys_url, headers=headers, stream=True, timeout=30)
    response.raise_for_status()
    
    # Step 3: Determine file extension
    mime_type = attachment.get("mime", "application/octet-stream")
    extension = get_extension_from_mime(mime_type)
    
    # Step 4: Generate MinIO object key
    import uuid
    from datetime import datetime
    
    now = datetime.utcnow()
    object_key = f"{tenant_id}/{now.year}/{now.month:02d}/{now.day:02d}/{uuid.uuid4()}{extension}"
    
    # Step 5: Stream upload to MinIO
    minio_client.put_object(
        bucket_name="media-outbound",
        object_name=object_key,
        data=response.raw,
        length=-1,  # Unknown length, stream until EOF
        content_type=mime_type
    )
    
    # Step 6: Generate presigned URL (7 days)
    presigned_url = minio_client.presigned_get_object(
        bucket_name="media-outbound",
        object_name=object_key,
        expires=timedelta(days=7)
    )
    
    return {
        "url": presigned_url,
        "mime_type": mime_type,
        "filename": attachment.get("filename", "attachment"),
        "original_id": attachment["id"]
    }

def get_extension_from_mime(mime_type: str) -> str:
    """Map MIME type to file extension."""
    mime_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "application/pdf": ".pdf",
        "video/mp4": ".mp4",
        "audio/mpeg": ".mp3",
        "text/plain": ".txt"
    }
    return mime_map.get(mime_type, "")
```

#### 5.2.3 MIME Type Validation
```python
ALLOWED_MIME_TYPES = [
    # Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    
    # Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    
    # Audio
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    
    # Video
    "video/mp4",
    "video/quicktime",
    
    # Other
    "text/plain",
    "text/csv"
]

def validate_mime_type(mime_type: str) -> bool:
    """Check if MIME type is allowed for upload."""
    return mime_type in ALLOWED_MIME_TYPES
```

#### 5.2.4 Size and Timeout Limits
```python
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
DOWNLOAD_TIMEOUT_SECONDS = 30
UPLOAD_TIMEOUT_SECONDS = 30

def validate_file_size(content_length: int) -> bool:
    """Check if file size is within allowed limit."""
    return content_length <= MAX_FILE_SIZE_BYTES
```

### 5.3 Event Publishing (REQ-OUT-04, REQ-STATE-05)

#### 5.3.1 Outbound Message Publishing
```python
import json
import pika

def publish_outbound_message(
    tenant_id: str,
    genesys_id: str,
    payload: dict,
    timestamp: str
) -> bool:
    """
    Publish outbound message to RabbitMQ.
    
    Returns: True if published successfully, False otherwise
    """
    message = {
        "tenantId": tenant_id,
        "genesysId": genesys_id,
        "type": "message",
        "timestamp": timestamp,
        "payload": payload
    }
    
    try:
        channel.basic_publish(
            exchange='',
            routing_key='outboundQueue',
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent
                content_type='application/json'
            )
        )
        return True
    except Exception as e:
        logger.error(f"Failed to publish to outboundQueue: {e}")
        return False
```

#### 5.3.2 Status Event Publishing
```python
def publish_status_event(
    tenant_id: str,
    genesys_id: str,
    original_message_id: str,
    status: str,
    timestamp: str
) -> bool:
    """
    Publish status event to RabbitMQ.
    
    Returns: True if published successfully, False otherwise
    """
    message = {
        "tenantId": tenant_id,
        "genesysId": genesys_id,
        "originalMessageId": original_message_id,
        "status": status.lower(),
        "timestamp": timestamp
    }
    
    try:
        channel.basic_publish(
            exchange='',
            routing_key='statusQueue',
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent
                content_type='application/json'
            )
        )
        return True
    except Exception as e:
        logger.error(f"Failed to publish to statusQueue: {e}")
        return False
```

#### 5.3.3 Retry Logic
```python
def publish_with_retry(publish_func, *args, max_retries=1, **kwargs) -> bool:
    """
    Attempt to publish message with single retry on failure.
    
    Returns: True if any attempt succeeded
    """
    for attempt in range(max_retries + 1):
        try:
            if publish_func(*args, **kwargs):
                return True
        except Exception as e:
            logger.warning(f"Publish attempt {attempt + 1} failed: {e}")
            if attempt < max_retries:
                time.sleep(0.1)  # Brief delay before retry
    
    logger.critical("All publish attempts failed")
    return False
```

### 5.4 Complete Request Flow

```python
async def handle_webhook_request(request):
    """
    Main webhook handler - complete processing flow.
    
    Returns: HTTP response
    """
    start_time = time.time()
    
    try:
        # Step 1: Extract raw body for signature validation
        raw_body = await request.body()
        
        # Step 2: Parse JSON
        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid JSON"}
            )
        
        # Step 3: Extract integration ID
        integration_id = payload.get("channel", {}).get("from", {}).get("id")
        if not integration_id:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing integration ID"}
            )
        
        # Step 4: Resolve tenant
        try:
            tenant_data = await tenant_service.get_by_integration(integration_id)
            tenant_id = tenant_data["tenantId"]
            webhook_secret = tenant_data["webhookSecret"]
        except TenantNotFoundError:
            return JSONResponse(
                status_code=400,
                content={"error": "Unknown integration"}
            )
        
        # Step 5: Validate signature
        signature_header = request.headers.get("x-hub-signature-256", "")
        if not validate_signature(raw_body, webhook_secret, signature_header):
            logger.warning(f"Invalid signature for tenant {tenant_id}")
            return JSONResponse(
                status_code=403,
                content={"error": "Invalid signature"}
            )
        
        # Step 6: Check for echo
        if is_echo_event(payload):
            logger.info(f"Echo filtered for tenant {tenant_id}, genesysId {payload['id']}")
            return JSONResponse(
                status_code=200,
                content={"status": "accepted", "echo_filtered": True}
            )
        
        # Step 7: Classify event type
        event_type = classify_event(payload)
        
        if event_type == "health_check":
            return JSONResponse(
                status_code=200,
                content={"status": "healthy"}
            )
        
        # Step 8: Process based on type
        if event_type == "outbound_message":
            await process_outbound_message(tenant_id, payload)
        elif event_type == "status_event":
            await process_status_event(tenant_id, payload)
        else:
            logger.warning(f"Unknown event type: {payload.get('type')}")
        
        # Step 9: Log metrics
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Processed webhook in {processing_time:.2f}ms")
        
        return JSONResponse(
            status_code=200,
            content={"status": "accepted"}
        )
        
    except Exception as e:
        logger.error(f"Webhook processing failed: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Processing failed"}
        )

async def process_outbound_message(tenant_id: str, payload: dict):
    """Process outbound message event."""
    genesys_id = payload["id"]
    timestamp = payload["channel"]["time"]
    
    # Extract base payload
    message_payload = {
        "text": payload.get("text", ""),
        "to_id": payload["channel"]["to"]["id"],
        "to_id_type": payload["channel"]["to"]["idType"],
        "media": None
    }
    
    # Process media if present
    if has_media(payload):
        attachments = extract_attachments(payload)
        if attachments:
            # Process first attachment only (extend for multiple if needed)
            media_info = await process_media(attachments[0], tenant_id)
            message_payload["media"] = media_info
    
    # Publish to RabbitMQ
    publish_with_retry(
        publish_outbound_message,
        tenant_id=tenant_id,
        genesys_id=genesys_id,
        payload=message_payload,
        timestamp=timestamp
    )

async def process_status_event(tenant_id: str, payload: dict):
    """Process status event."""
    genesys_id = payload["id"]
    original_message_id = payload["channel"].get("messageId", "")
    status = payload.get("status", "").lower()
    timestamp = payload["channel"]["time"]
    
    # Publish to RabbitMQ
    publish_with_retry(
        publish_status_event,
        tenant_id=tenant_id,
        genesys_id=genesys_id,
        original_message_id=original_message_id,
        status=status,
        timestamp=timestamp
    )
```

---

## 6. Non-Functional Requirements

### 6.1 Performance

#### 6.1.1 Response Time (REQ-NFR-01)
- **Target:** 95th percentile < 2 seconds
- **Maximum:** 5 seconds (Genesys timeout threshold)
- **Measurement:** Time from request received to response sent

**Implementation:**
```python
RESPONSE_TIMEOUT_SECONDS = 4.5  # Safety margin before Genesys timeout

async def handle_with_timeout(request):
    """Ensure response within timeout."""
    try:
        return await asyncio.wait_for(
            handle_webhook_request(request),
            timeout=RESPONSE_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        logger.error("Request processing exceeded timeout")
        return JSONResponse(
            status_code=500,
            content={"error": "Processing timeout"}
        )
```

#### 6.1.2 Throughput
- **Target:** Handle 100 requests/second per instance
- **Scaling:** Horizontal scaling via container replication
- **Connection pooling:** Reuse RabbitMQ and HTTP connections

### 6.2 Reliability

#### 6.2.1 Idempotency (REQ-NFR-02)
**Mechanism:** Preserve Genesys event `id` throughout processing chain

**Deduplication:** Handled by downstream State Manager service

**Requirements:**
- Never modify `genesysId` field
- Don't generate new IDs for events
- Maintain correlation across systems

#### 6.2.2 Fault Tolerance
```python
# Connection pooling with auto-recovery
rabbitmq_connection = pika.BlockingConnection(
    pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        heartbeat=600,
        blocked_connection_timeout=300,
        connection_attempts=3,
        retry_delay=2
    )
)

# Circuit breaker for external services
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=60)
async def call_tenant_service(integration_id: str):
    """Call tenant service with circuit breaker protection."""
    # Implementation
```

### 6.3 Scalability

#### 6.3.1 Stateless Design
- No local state storage
- No in-memory session data
- No file system dependencies (except temp streams)

#### 6.3.2 Horizontal Scaling
```yaml
# Kubernetes deployment example
apiVersion: apps/v1
kind: Deployment
metadata:
  name: genesys-webhook-service
spec:
  replicas: 3  # Scale based on load
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

### 6.4 Observability

#### 6.4.1 Structured Logging
```python
import structlog

logger = structlog.get_logger()

# Example log entry
logger.info(
    "webhook_processed",
    tenant_id=tenant_id,
    genesys_id=genesys_id,
    integration_id=integration_id,
    event_type=event_type,
    processing_time_ms=processing_time,
    echo_filtered=is_echo,
    has_media=has_media,
    status="success"
)
```

#### 6.4.2 Metrics (Prometheus Format)
```python
from prometheus_client import Counter, Histogram, Gauge

# Request counters
webhook_requests_total = Counter(
    'webhook_requests_total',
    'Total webhook requests',
    ['tenant_id', 'event_type', 'status']
)

# Processing time histogram
webhook_processing_seconds = Histogram(
    'webhook_processing_seconds',
    'Webhook processing time',
    ['event_type']
)

# Signature validation failures
signature_failures_total = Counter(
    'signature_failures_total',
    'Total signature validation failures',
    ['tenant_id']
)

# Echo filtered events
echo_filtered_total = Counter(
    'echo_filtered_total',
    'Total echo events filtered',
    ['tenant_id']
)

# Media processing
media_processed_total = Counter(
    'media_processed_total',
    'Total media files processed',
    ['tenant_id', 'mime_type', 'status']
)

# RabbitMQ publish failures
rabbitmq_publish_failures_total = Counter(
    'rabbitmq_publish_failures_total',
    'Total RabbitMQ publish failures',
    ['queue']
)
```

#### 6.4.3 Health Check Endpoint
```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
async def health_check():
    """
    Health check endpoint for load balancers.
    
    Checks:
    - Service is running
    - RabbitMQ connection alive
    - MinIO accessible
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "dependencies": {}
    }
    
    # Check RabbitMQ
    try:
        rabbitmq_connection.process_data_events(time_limit=0)
        health_status["dependencies"]["rabbitmq"] = "healthy"
    except:
        health_status["dependencies"]["rabbitmq"] = "unhealthy"
        health_status["status"] = "degraded"
    
    # Check MinIO
    try:
        minio_client.bucket_exists("media-outbound")
        health_status["dependencies"]["minio"] = "healthy"
    except:
        health_status["dependencies"]["minio"] = "unhealthy"
        health_status["status"] = "degraded"
    
    status_code = 200 if health_status["status"] == "healthy" else 503
    return JSONResponse(status_code=status_code, content=health_status)

@app.get("/ready")
async def readiness_check():
    """Readiness check for Kubernetes."""
    # Similar to health but stricter - all dependencies must be healthy
    pass
```

---

## 7. Error Handling

### 7.1 Error Categories

#### 7.1.1 Client Errors (4xx)
| Error | HTTP Code | Cause | Action |
|-------|-----------|-------|--------|
| Invalid JSON | 400 | Malformed request body | Return error, log warning |
| Missing integration ID | 400 | Missing `channel.from.id` | Return error, log warning |
| Unknown integration | 400 | Integration ID not in tenant DB | Return error, log info |
| Invalid signature | 403 | HMAC mismatch | Return error, log security event |
| Request too large | 413 | Body exceeds size limit | Return error, log warning |

#### 7.1.2 Server Errors (5xx)
| Error | HTTP Code | Cause | Action |
|-------|-----------|-------|--------|
| Processing failure | 500 | Unhandled exception | Return error, log critical |
| Dependency unavailable | 503 | Tenant/Auth service down | Return error, retry internally |
| Timeout | 504 | Processing exceeded 5s | Return error, log warning |

### 7.2 Media Processing Errors

```python
class MediaProcessingError(Exception):
    """Base exception for media processing failures."""
    pass

class MediaDownloadError(MediaProcessingError):
    """Failed to download media from Genesys."""
    pass

class MediaUploadError(MediaProcessingError):
    """Failed to upload media to MinIO."""
    pass

class InvalidMediaError(MediaProcessingError):
    """Media validation failed."""
    pass

async def safe_process_media(attachment: dict, tenant_id: str) -> Optional[dict]:
    """
    Process media with comprehensive error handling.
    
    Returns: Media info dict on success, None on failure
    """
    try:
        # Validate MIME type
        mime_type = attachment.get("mime", "")
        if not validate_mime_type(mime_type):
            raise InvalidMediaError(f"Unsupported MIME type: {mime_type}")
        
        # Process media
        return await process_media(attachment, tenant_id)
        
    except MediaDownloadError as e:
        logger.error(f"Media download failed: {e}", extra={
            "tenant_id": tenant_id,
            "media_id": attachment.get("id"),
            "url": attachment.get("url")
        })
        return None
        
    except MediaUploadError as e:
        logger.error(f"Media upload failed: {e}", extra={
            "tenant_id": tenant_id,
            "media_id": attachment.get("id")
        })
        return None
        
    except InvalidMediaError as e:
        logger.warning(f"Invalid media: {e}", extra={
            "tenant_id": tenant_id,
            "media_id": attachment.get("id"),
            "mime_type": mime_type
        })
        return None
        
    except Exception as e:
        logger.exception(f"Unexpected media processing error: {e}")
        return None
```

### 7.3 Graceful Degradation

**Strategy:** Continue processing text even if media fails

```python
async def process_outbound_message_with_degradation(tenant_id: str, payload: dict):
    """
    Process message with graceful degradation for media failures.
    """
    message_payload = {
        "text": payload.get("text", ""),
        "to_id": payload["channel"]["to"]["id"],
        "to_id_type": payload["channel"]["to"]["idType"],
        "media": None
    }
    
    # Attempt media processing
    if has_media(payload):
        attachments = extract_attachments(payload)
        if attachments:
            media_info = await safe_process_media(attachments[0], tenant_id)
            if media_info:
                message_payload["media"] = media_info
            else:
                # Media failed but continue with text
                logger.warning("Continuing without media due to processing failure")
                # Optionally add flag to indicate media was stripped
                message_payload["media_processing_failed"] = True
    
    # Always publish message (with or without media)
    publish_with_retry(
        publish_outbound_message,
        tenant_id=tenant_id,
        genesys_id=payload["id"],
        payload=message_payload,
        timestamp=payload["channel"]["time"]
    )
```

---

## 8. Security Requirements

### 8.1 Authentication and Authorization

#### 8.1.1 Webhook Signature Validation
**CRITICAL:** Use raw request body, not parsed JSON

```python
# CORRECT: Use raw bytes
raw_body = await request.body()
is_valid = validate_signature(raw_body, secret, signature_header)

# INCORRECT: Using parsed JSON will fail
parsed = await request.json()
is_valid = validate_signature(json.dumps(parsed), secret, signature_header)  # WRONG!
```

**Why:** JSON parsing may reorder keys or change whitespace, invalidating signature.

#### 8.1.2 Constant-Time Comparison
```python
import hmac

# CORRECT: Prevents timing attacks
hmac.compare_digest(expected, provided)

# INCORRECT: Vulnerable to timing attacks
expected == provided  # NEVER use this for security!
```

### 8.2 Input Validation

#### 8.2.1 Request Size Limits
```python
MAX_REQUEST_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    """Reject oversized requests."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_SIZE_BYTES:
        return JSONResponse(
            status_code=413,
            content={"error": "Request too large"}
        )
    return await call_next(request)
```

#### 8.2.2 Content-Type Validation
```python
ALLOWED_CONTENT_TYPES = ["application/json"]

def validate_content_type(content_type: str) -> bool:
    """Ensure only JSON webhooks are accepted."""
    return content_type.lower().startswith("application/json")
```

### 8.3 Data Protection

#### 8.3.1 Secrets Management
```python
# Use environment variables or secrets manager
WEBHOOK_SECRETS = {}  # Never hardcode secrets

# Fetch from tenant service at runtime
def get_webhook_secret(integration_id: str) -> str:
    """Retrieve webhook secret from secure source."""
    tenant = tenant_service.get_by_integration(integration_id)
    return tenant["webhookSecret"]
```

#### 8.3.2 Logging Security
```python
def sanitize_for_logging(payload: dict) -> dict:
    """Remove sensitive data before logging."""
    safe_payload = payload.copy()
    
    # Remove or mask sensitive fields
    if "content" in safe_payload:
        for item in safe_payload["content"]:
            if "attachment" in item and "url" in item["attachment"]:
                # Log only media ID, not authenticated URL
                item["attachment"]["url"] = "[REDACTED]"
    
    return safe_payload

# Usage
logger.info("Received webhook", payload=sanitize_for_logging(payload))
```

### 8.4 Network Security

#### 8.4.1 TLS/HTTPS Enforcement
```python
# Enforce HTTPS in production
@app.middleware("http")
async def enforce_https(request: Request, call_next):
    """Redirect HTTP to HTTPS in production."""
    if request.url.scheme != "https" and not is_development():
        return RedirectResponse(
            url=request.url.replace(scheme="https"),
            status_code=301
        )
    return await call_next(request)
```

#### 8.4.2 Rate Limiting
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/webhook")
@limiter.limit("100/minute")  # 100 requests per minute per IP
async def webhook(request: Request):
    """Rate-limited webhook endpoint."""
    pass
```

---

## 9. Testing Scenarios

### 9.1 Unit Tests

#### 9.1.1 Signature Validation Tests
```python
import unittest

class TestSignatureValidation(unittest.TestCase):
    
    def test_valid_signature(self):
        """Test with correct signature."""
        body = b'{"test": "data"}'
        secret = "my-secret-key"
        signature = generate_signature(body, secret)
        
        self.assertTrue(
            validate_signature(body, secret, f"sha256={signature}")
        )
    
    def test_invalid_signature(self):
        """Test with incorrect signature."""
        body = b'{"test": "data"}'
        secret = "my-secret-key"
        wrong_signature = "invalid-signature-hash"
        
        self.assertFalse(
            validate_signature(body, secret, f"sha256={wrong_signature}")
        )
    
    def test_tampered_body(self):
        """Test with tampered request body."""
        original_body = b'{"test": "data"}'
        secret = "my-secret-key"
        signature = generate_signature(original_body, secret)
        
        tampered_body = b'{"test": "modified"}'
        
        self.assertFalse(
            validate_signature(tampered_body, secret, f"sha256={signature}")
        )
    
    def test_missing_signature_header(self):
        """Test with missing signature header."""
        body = b'{"test": "data"}'
        secret = "my-secret-key"
        
        self.assertFalse(
            validate_signature(body, secret, "")
        )
```

#### 9.1.2 Echo Detection Tests
```python
class TestEchoDetection(unittest.TestCase):
    
    def test_echo_with_middleware_prefix(self):
        """Test detection of middleware-prefixed message."""
        payload = {
            "channel": {
                "messageId": "mw-12345-67890"
            }
        }
        self.assertTrue(is_echo_event(payload))
    
    def test_echo_with_internal_uuid(self):
        """Test detection of internal UUID pattern."""
        payload = {
            "channel": {
                "messageId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
            }
        }
        self.assertTrue(is_echo_event(payload))
    
    def test_non_echo_genesys_message(self):
        """Test genuine Genesys message is not filtered."""
        payload = {
            "channel": {
                "messageId": None
            }
        }
        self.assertFalse(is_echo_event(payload))
    
    def test_non_echo_with_external_id(self):
        """Test external message ID is not filtered."""
        payload = {
            "channel": {
                "messageId": "external-system-msg-123"
            }
        }
        self.assertFalse(is_echo_event(payload))
```

#### 9.1.3 Event Classification Tests
```python
class TestEventClassification(unittest.TestCase):
    
    def test_classify_text_message(self):
        """Test classification of text message."""
        payload = {
            "type": "Text",
            "direction": "Outbound",
            "text": "Hello"
        }
        self.assertEqual(classify_event(payload), "outbound_message")
    
    def test_classify_receipt_event(self):
        """Test classification of delivery receipt."""
        payload = {
            "type": "Receipt",
            "direction": "Outbound",
            "status": "Delivered"
        }
        self.assertEqual(classify_event(payload), "status_event")
    
    def test_classify_health_check(self):
        """Test classification of health check."""
        payload = {
            "type": "HealthCheck",
            "direction": "Outbound"
        }
        self.assertEqual(classify_event(payload), "health_check")
    
    def test_reject_inbound_events(self):
        """Test inbound events are not processed."""
        payload = {
            "type": "Text",
            "direction": "Inbound",
            "text": "Customer message"
        }
        self.assertEqual(classify_event(payload), "unknown")
```

### 9.2 Integration Tests

#### 9.2.1 End-to-End Message Flow
```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_successful_text_message_processing(test_client: AsyncClient):
    """Test complete flow for text message."""
    
    # Prepare webhook payload
    payload = {
        "id": "test-msg-123",
        "channel": {
            "from": {"id": "integration-test-001"},
            "to": {"id": "919876543210"},
            "time": "2023-01-01T12:00:00.000Z"
        },
        "type": "Text",
        "text": "Test message",
        "direction": "Outbound"
    }
    
    # Generate valid signature
    secret = "test-webhook-secret"
    body_bytes = json.dumps(payload).encode()
    signature = generate_signature(body_bytes, secret)
    
    # Send webhook request
    response = await test_client.post(
        "/webhook",
        json=payload,
        headers={"x-hub-signature-256": f"sha256={signature}"}
    )
    
    # Verify response
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
    
    # Verify message published to RabbitMQ
    published_message = await get_from_rabbitmq("outboundQueue")
    assert published_message["genesysId"] == "test-msg-123"
    assert published_message["payload"]["text"] == "Test message"
```

#### 9.2.2 Media Processing Integration
```python
@pytest.mark.asyncio
async def test_media_download_and_upload(test_client: AsyncClient, mock_genesys, mock_minio):
    """Test media processing flow."""
    
    # Setup mocks
    mock_genesys.register_media(
        media_id="test-media-789",
        content=b"fake-image-data",
        mime_type="image/jpeg"
    )
    
    # Webhook payload with attachment
    payload = {
        "id": "test-msg-456",
        "channel": {
            "from": {"id": "integration-test-001"},
            "to": {"id": "919876543210"},
            "time": "2023-01-01T12:00:00.000Z"
        },
        "type": "Text",
        "text": "Here's an image",
        "direction": "Outbound",
        "content": [
            {
                "contentType": "Attachment",
                "attachment": {
                    "id": "test-media-789",
                    "url": "https://api.genesys.cloud/v2/downloads/token/test-media-789",
                    "mime": "image/jpeg"
                }
            }
        ]
    }
    
    # Send request
    response = await send_authenticated_webhook(test_client, payload)
    
    # Verify response
    assert response.status_code == 200
    
    # Verify media uploaded to MinIO
    assert mock_minio.object_exists("media-outbound", contains="test-media-789")
    
    # Verify RabbitMQ message contains MinIO URL
    published = await get_from_rabbitmq("outboundQueue")
    assert "minio" in published["payload"]["media"]["url"]
```

### 9.3 Load Tests

```python
import asyncio
from locust import HttpUser, task, between

class WebhookLoadTest(HttpUser):
    """Load test for webhook endpoint."""
    
    wait_time = between(0.1, 0.5)
    
    def on_start(self):
        """Setup test data."""
        self.payload = {
            "id": f"load-test-{self.environment.runner.user_count}",
            "channel": {
                "from": {"id": "integration-test-001"},
                "to": {"id": "919876543210"},
                "time": "2023-01-01T12:00:00.000Z"
            },
            "type": "Text",
            "text": "Load test message",
            "direction": "Outbound"
        }
        
        self.secret = "test-secret"
        body_bytes = json.dumps(self.payload).encode()
        self.signature = generate_signature(body_bytes, self.secret)
    
    @task
    def send_webhook(self):
        """Send webhook request."""
        headers = {
            "x-hub-signature-256": f"sha256={self.signature}",
            "Content-Type": "application/json"
        }
        
        with self.client.post(
            "/webhook",
            json=self.payload,
            headers=headers,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Got status code {response.status_code}")
```

---

## 10. Implementation Notes

### 10.1 Technology Stack Recommendations

#### 10.1.1 Framework
**Recommended:** FastAPI (Python)

**Rationale:**
- Async support for I/O-bound operations
- Built-in request validation
- OpenAPI documentation
- High performance

**Alternative:** Express.js (Node.js), Spring Boot (Java)

#### 10.1.2 Dependencies
```python
# requirements.txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
pika==1.3.2  # RabbitMQ client
minio==7.2.0  # MinIO client
httpx==0.25.0  # Async HTTP client
pydantic==2.4.2  # Data validation
python-dotenv==1.0.0  # Environment config
structlog==23.2.0  # Structured logging
prometheus-client==0.19.0  # Metrics
```

### 10.2 Configuration Management

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application configuration."""
    
    # Service
    service_name: str = "genesys-webhook-service"
    environment: str = "production"
    port: int = 8000
    
    # RabbitMQ
    rabbitmq_host: str
    rabbitmq_port: int = 5672
    rabbitmq_username: str
    rabbitmq_password: str
    rabbitmq_vhost: str = "/"
    outbound_queue: str = "outboundQueue"
    status_queue: str = "statusQueue"
    
    # MinIO
    minio_endpoint: str
    minio_access_key: str
    minio_secret_key: str
    minio_bucket: str = "media-outbound"
    minio_secure: bool = True
    
    # Tenant Service
    tenant_service_url: str
    tenant_service_timeout: int = 5
    
    # Auth Service
    auth_service_url: str
    auth_service_timeout: int = 5
    
    # Processing
    max_request_size_mb: int = 10
    max_file_size_mb: int = 20
    media_download_timeout: int = 30
    
    # Security
    echo_detection_prefixes: list[str] = ["mw-", "middleware-", "injected-"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
```

### 10.3 Deployment Considerations

#### 10.3.1 Docker Configuration
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

#### 10.3.2 Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: genesys-webhook-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: genesys-webhook-service
  template:
    metadata:
      labels:
        app: genesys-webhook-service
    spec:
      containers:
      - name: webhook-service
        image: genesys-webhook-service:1.2
        ports:
        - containerPort: 8000
        env:
        - name: RABBITMQ_HOST
          valueFrom:
            configMapKeyRef:
              name: service-config
              key: rabbitmq-host
        - name: RABBITMQ_PASSWORD
          valueFrom:
            secretKeyRef:
              name: service-secrets
              key: rabbitmq-password
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
```

### 10.4 Monitoring and Alerting

#### 10.4.1 Critical Alerts
```yaml
# Prometheus alert rules
groups:
  - name: webhook_service_alerts
    interval: 30s
    rules:
      - alert: HighSignatureFailureRate
        expr: rate(signature_failures_total[5m]) > 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High rate of signature validation failures"
          description: "Possible security issue or misconfigured tenant"
      
      - alert: WebhookProcessingTimeout
        expr: histogram_quantile(0.95, webhook_processing_seconds) > 4
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Webhook processing approaching timeout"
          description: "95th percentile processing time > 4 seconds"
      
      - alert: RabbitMQPublishFailures
        expr: rate(rabbitmq_publish_failures_total[5m]) > 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "RabbitMQ publish failures detected"
          description: "Events may be lost"
      
      - alert: MediaProcessingFailures
        expr: rate(media_processed_total{status="failed"}[10m]) > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High media processing failure rate"
          description: "Check MinIO and Genesys connectivity"
```

---

## Appendix A: Event Type Reference

### Genesys Event Types

| Type | Direction | Description | Action |
|------|-----------|-------------|--------|
| Text | Outbound | Agent text message | Process → outboundQueue |
| Text | Inbound | Customer text message | Ignore (handled elsewhere) |
| Structured | Outbound | Rich message (buttons, cards) | Process → outboundQueue |
| Attachment | Outbound | Media from agent | Download → MinIO → outboundQueue |
| Receipt | Outbound | Delivery/read status | Extract → statusQueue |
| Typing | Outbound | Typing indicator | Extract → statusQueue |
| Disconnect | Outbound | Conversation ended | Extract → statusQueue |
| HealthCheck | Outbound | Genesys ping | Return 200 OK immediately |

---

## Appendix B: Troubleshooting Guide

### Common Issues

#### Issue: Signature validation failing
**Symptoms:** 403 errors, high `signature_failures_total` metric

**Causes:**
1. Using parsed JSON instead of raw body
2. Incorrect webhook secret
3. Tenant not configured properly
4. Clock skew between systems

**Resolution:**
```python
# Debug signature generation
logger.debug(
    "signature_validation_debug",
    raw_body_preview=raw_body[:100],
    computed_signature=computed_sig,
    provided_signature=provided_sig,
    tenant_id=tenant_id
)
```

#### Issue: Echo loop detected
**Symptoms:** Messages bouncing between systems

**Resolution:**
- Verify `echo_detection_prefixes` configuration
- Check `channel.messageId` format in injected messages
- Review logs for `echo_filtered=true` entries

#### Issue: Media processing timeout
**Symptoms:** 500 errors, incomplete messages in queue

**Causes:**
1. Large file downloads exceeding timeout
2. MinIO connectivity issues
3. Genesys OAuth token expired

**Resolution:**
- Increase `MEDIA_DOWNLOAD_TIMEOUT`
- Implement async media processing
- Add retry logic for transient failures

---

## Appendix C: API Contract Summary

### POST /webhook

**Request:**
```http
POST /webhook HTTP/1.1
Host: webhook.example.com
Content-Type: application/json
x-hub-signature-256: sha256=abc123...

{Genesys webhook JSON}
```

**Success Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{"status": "accepted"}
```

**Error Responses:**
```http
HTTP/1.1 400 Bad Request
{"error": "Invalid JSON"}

HTTP/1.1 403 Forbidden
{"error": "Invalid signature"}

HTTP/1.1 500 Internal Server Error
{"error": "Processing failed"}
```

---

## Appendix D: Glossary

| Term | Definition |
|------|------------|
| Echo Event | Webhook triggered by middleware's own message injection |
| Integration ID | Genesys identifier for Open Messaging integration |
| Genesys ID | Unique identifier for each webhook event |
| Tenant ID | Internal identifier for customer organization |
| Webhook Secret | HMAC key for signature validation |
| Presigned URL | Time-limited, authenticated URL for media access |
| Loop Prevention | Mechanism to avoid infinite message cycles |
| Stateless Service | Service with no local persistent state |

---

**Document Version:** 1.2 (LLM-Optimized)  
**Last Updated:** 2024  
**Author:** System Architecture Team  
**Maintained By:** Engineering Team