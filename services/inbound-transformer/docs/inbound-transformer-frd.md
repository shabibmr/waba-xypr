# Inbound Transformer Service - Comprehensive Requirements Document

**Version:** 1.2 (Enterprise Hardened)  
**Service Name:** `inbound-transformer`  
**Document Purpose:** Code generation, implementation guidance, and debugging reference  
**Parent Document:** System Design Document

---

## Table of Contents

1. [Service Overview](#service-overview)
2. [Architecture Context](#architecture-context)
3. [Core Responsibilities](#core-responsibilities)
4. [Technology Stack & Dependencies](#technology-stack--dependencies)
5. [Data Contracts](#data-contracts)
6. [Functional Requirements](#functional-requirements)
7. [Non-Functional Requirements](#non-functional-requirements)
8. [Error Handling & Resilience](#error-handling--resilience)
9. [Security Requirements](#security-requirements)
10. [Observability & Monitoring](#observability--monitoring)
11. [Testing Requirements](#testing-requirements)
12. [Deployment & Operations](#deployment--operations)
13. [Implementation Guidelines](#implementation-guidelines)
14. [Common Pitfalls & Anti-Patterns](#common-pitfalls--anti-patterns)

---

## Service Overview

### Purpose
The Inbound Transformer Service is a **stateless, deterministic message-processing microservice** that translates enriched WhatsApp payloads into Open Messaging payloads compatible with Genesys Cloud and the WhatsApp Business Platform.

### Key Characteristics
- **Stateless**: No persistent storage, no business state management
- **Deterministic**: Same input always produces same output
- **Single Responsibility**: Transform and dispatch only
- **Horizontally Scalable**: Designed for multi-instance deployment
- **Idempotent**: Safe to retry operations

### What This Service DOES
✅ Consume enriched payloads from RabbitMQ  
✅ Transform WhatsApp format → Genesys Open Messaging format  
✅ Dispatch to Genesys API Service  
✅ Handle retries with exponential backoff  
✅ Route failures to dead-letter queue  
✅ Deduplicate messages and events  
✅ Emit metrics and structured logs  

### What This Service DOES NOT DO
❌ Identity resolution (handled by State Manager)  
❌ Mapping creation (handled by State Manager)  
❌ Business state storage (stateless by design)  
❌ Direct interaction with Genesys Cloud API (uses abstraction layer)  
❌ Direct interaction with WhatsApp API (upstream responsibility)  
❌ Message routing decisions (all messages follow same path)  
❌ Schema validation beyond basic structure (upstream responsibility)  

---

## Architecture Context

### Position in Data Flow

```
WhatsApp Business API
        ↓
[Inbound Webhook Handler]
        ↓
[State Manager Service]  ← Enriches & validates
        ↓
    RabbitMQ Queue: inbound-processed
        ↓
[Inbound Transformer Service]  ← THIS SERVICE
        ↓
[Genesys API Service]  ← Abstraction layer
        ↓
Genesys Cloud Platform
```

### Upstream Dependencies
- **State Manager Service**: Produces enriched, validated payloads
- **RabbitMQ**: Message broker providing `inbound-processed` queue

### Downstream Dependencies
- **Genesys API Service**: Internal REST service abstracting Genesys Cloud API
- **Redis** (optional): Idempotency cache
- **Prometheus**: Metrics collection
- **Logging Infrastructure**: JSON log aggregation

### Service Boundaries
- **Input Boundary**: RabbitMQ consumer
- **Output Boundary**: HTTP client to Genesys API Service
- **No Side Channels**: No database, no file system, no external APIs

---

## Core Responsibilities

### 1. Message Consumption (REQ-IN-07)

**Trigger**: Message arrives in `inbound-processed` queue

**Steps**:
1. Deserialize JSON payload
2. Validate required fields
3. Check idempotency (prevent duplicates)
4. Transform payload
5. Dispatch to Genesys API Service
6. ACK/NACK based on result

**Validation Rules**:
- `tenantId` must be present (UUID format)
- `waId` must be present (E.164 phone format expected)
- `type` must be one of: `["message", "event"]`
- JSON must be well-formed

**Idempotency Keys**:
- **For Messages**: Use `internalId` field directly
- **For Events**: Composite key = `SHA256(wamid + status + timestamp)`

### 2. Message Transformation (REQ-IN-05)

**Input**: WhatsApp-enriched format from State Manager  
**Output**: Genesys Open Messaging format

**Transformation Types**:
- Text messages → Genesys Text message
- Media messages → Genesys Media message
- Text + Media → Genesys Text with attachmenta
- Status events → Genesys Receipt events

### 3. Dispatch & Retry (REQ-IN-08)

**Dispatch Targets**:
- Messages: `POST /genesys/messages/inbound`
- Events: `POST /genesys/events/inbound`

**Retry Behavior**:
- 2xx: Success, ACK message
- 4xx: Client error, ACK (log and move on)
- 5xx: Server error, NACK (retry with backoff)
- Timeout: NACK (treat as temporary failure)

**Backoff Strategy**:
- Algorithm: Exponential with jitter
- Base delay: 1 second
- Max attempts: 5
- Max delay: 32 seconds
- Formula: `min(base * 2^attempt + random(0, 1000ms), 32000ms)`

### 4. Reliability & Observability

**Reliability**:
- Idempotent processing (safe to retry)
- Dead-letter queue after max retries
- No silent message drops
- Controlled failure modes

**Observability**:
- Structured JSON logging
- Prometheus metrics
- Correlation ID propagation
- Error tracking with context

---

## Technology Stack & Dependencies

### Required Components

| Component | Purpose | Version/Type | Configuration |
|-----------|---------|--------------|---------------|
| **RabbitMQ** | Message broker | 3.11+ | Queue: `inbound-processed`, Exchange: `inbound`, DLQ: `inbound-transformer-dlq` |
| **Genesys API Service** | REST destination | Internal | Endpoints: `/genesys/messages/inbound`, `/genesys/events/inbound` |
| **Redis** | Idempotency cache (optional) | 6.0+ | TTL: 24 hours, Namespace: `inbound-transformer:dedup:` |
| **Prometheus** | Metrics | 2.x | Scrape endpoint: `/metrics` |
| **Logging System** | Log aggregation | - | Format: JSON, Level: INFO minimum |

### Language & Runtime Recommendations
- **Node.js** (16+): Good async I/O, JSON native
- **Go**: High performance, good concurrency
- **Python** (3.9+): Rapid development, good libraries
- **Java/Kotlin** (11+): Enterprise-grade, Spring Boot ecosystem

### Key Libraries Needed
- **AMQP Client**: RabbitMQ connection
- **HTTP Client**: Genesys API calls (with timeout, retry)
- **JSON Parser**: Payload processing
- **Logging**: Structured JSON output
- **Metrics**: Prometheus client
- **UUID Generation**: Idempotency keys
- **Date/Time**: ISO 8601 formatting
- **Hashing**: SHA256 for composite keys

---

## Data Contracts

### 5.1 Input Schema - Type A: User Message

**Source**: State Manager via RabbitMQ `inbound-processed` queue

```json
{
  "type": "message",
  "internalId": "uuid-1234-5678-9abc-def0",
  "tenantId": "uuid-tenant-1111-2222-3333",
  "waId": "919876543210",
  "conversationId": "genesys-conv-uuid-999",
  "wamid": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
  "contactName": "John Doe",
  "timestamp": 1700000000,
  "payload": {
    "body": "Hello World",
    "media": {
      "url": "https://minio.internal/bucket/file.jpg",
      "mime_type": "image/jpeg",
      "caption": "Check this out"
    }
  }
}
```

**Field Specifications**:

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `type` | string | Yes | Must be `"message"` | Discriminator field |
| `internalId` | string | Yes | UUID v4 format | Unique message identifier, used as idempotency key |
| `tenantId` | string | Yes | UUID v4 format | Organization identifier |
| `waId` | string | Yes | E.164 format | WhatsApp ID (phone number) |
| `conversationId` | string | Yes | Non-empty string | Genesys conversation ID from mapping |
| `wamid` | string | Yes | Starts with `wamid.` | WhatsApp message ID |
| `contactName` | string | No | Max 256 chars | Display name for user |
| `timestamp` | integer | Yes | Unix epoch (seconds) | Message creation time |
| `payload.body` | string | No | Max 4096 chars | Message text content |
| `payload.media` | object | No | - | Media attachment (optional) |
| `payload.media.url` | string | Conditional | HTTPS URL | Media file URL (required if media present) |
| `payload.media.mime_type` | string | Conditional | MIME format | Content type (required if media present) |
| `payload.media.caption` | string | No | Max 1024 chars | Media caption/description |

**Validation Rules**:
1. At least one of `payload.body` or `payload.media` must be present
2. If `payload.media` exists, both `url` and `mime_type` are required
3. `timestamp` must not be more than 5 minutes in the future
4. `waId` should be numeric (phone number)
5. All URLs must use HTTPS scheme

### 5.2 Input Schema - Type B: Status Event

**Source**: State Manager via RabbitMQ `inbound-processed` queue

```json
{
  "type": "event",
  "tenantId": "uuid-tenant-1111-2222-3333",
  "waId": "919876543210",
  "wamid": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
  "status": "read",
  "timestamp": 1700000005,
  "reason": "Message failed due to network error"
}
```

**Field Specifications**:

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `type` | string | Yes | Must be `"event"` | Discriminator field |
| `tenantId` | string | Yes | UUID v4 format | Organization identifier |
| `waId` | string | Yes | E.164 format | WhatsApp ID (phone number) |
| `wamid` | string | Yes | Starts with `wamid.` | WhatsApp message ID being acknowledged |
| `status` | string | Yes | One of: `sent`, `delivered`, `read`, `failed` | Delivery status |
| `timestamp` | integer | Yes | Unix epoch (seconds) | Status change time |
| `reason` | string | No | Max 512 chars | Failure reason (only for `failed` status) |

**Idempotency Key Generation**:
```
key = SHA256(wamid + "|" + status + "|" + timestamp)
```

### 5.3 Output Schema - Genesys Inbound Message

**Destination**: Genesys API Service `POST /genesys/messages/inbound`

**Text Message Example**:
```json
{
  "id": "uuid-1234-5678-9abc-def0",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "messageId": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
    "to": {
      "id": "integration-id-from-config"
    },
    "from": {
      "nickname": "John Doe",
      "id": "919876543210",
      "idType": "Phone",
      "firstName": "John"
    },
    "time": "2023-11-15T03:33:20.000Z"
  },
  "type": "Text",
  "text": "Hello World",
  "direction": "Inbound"
}
```

**Media Message Example**:
```json
{
  "id": "uuid-1234-5678-9abc-def0",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "messageId": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
    "to": {
      "id": "integration-id-from-config"
    },
    "from": {
      "nickname": "John Doe",
      "id": "919876543210",
      "idType": "Phone",
      "firstName": "John"
    },
    "time": "2023-11-15T03:33:20.000Z"
  },
  "type": "Text",
  "text": "Check this out",
  "content": [
    {
      "contentType": "Attachment",
      "attachment": {
        "url": "https://minio.internal/bucket/file.jpg",
        "mime": "image/jpeg"
      }
    }
  ],
  "direction": "Inbound"
}
```

**Field Specifications**:

| Field | Type | Required | Source/Logic | Description |
|-------|------|----------|--------------|-------------|
| `id` | string | Yes | From `internalId` | Message identifier |
| `channel.platform` | string | Yes | Constant: `"Open"` | Platform type |
| `channel.type` | string | Yes | Constant: `"Private"` | Channel type |
| `channel.messageId` | string | Yes | From `wamid` | External message ID |
| `channel.to.id` | string | Yes | From config/env | Integration ID |
| `channel.from.id` | string | Yes | From `waId` | User identifier |
| `channel.from.idType` | string | Yes | Constant: `"Phone"` | ID type |
| `channel.from.nickname` | string | No | From `contactName` | Display name |
| `channel.from.firstName` | string | No | Derived from `contactName` | First word of name |
| `channel.time` | string | Yes | From `timestamp` (converted) | ISO 8601 UTC |
| `type` | string | Yes | `"Text"` or `"Media"` | Message type |
| `text` | string | Conditional | From `payload.body` or caption | Message text |
| `content` | array | No | From `payload.media` | Attachments |
| `direction` | string | Yes | Constant: `"Inbound"` | Message direction |

**Type Determination Logic**:
```
IF payload.body exists AND payload.media exists:
  type = "Text"
  text = payload.body
  content = [attachment from media]
  
ELSE IF payload.body exists:
  type = "Text"
  text = payload.body
  
ELSE IF payload.media exists:
  type = "Text"
  text = payload.media.caption OR "[Attachment]"
  content = [attachment from media]
```

**FirstName Extraction Logic**:
```
IF contactName exists:
  firstName = contactName.split()[0]  // First word
ELSE:
  firstName = null  // Omit field
```

### 5.4 Output Schema - Genesys Receipt Event

**Destination**: Genesys API Service `POST /genesys/events/inbound`

```json
{
  "id": "uuid-status-7890-abcd-ef12",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "messageId": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
    "to": {
      "id": "integration-id-from-config"
    },
    "from": {
      "id": "919876543210",
      "idType": "Phone"
    },
    "time": "2023-11-15T03:33:25.000Z"
  },
  "type": "Receipt",
  "status": "Read",
  "direction": "Outbound",
  "reason": "Network timeout"
}
```

**Field Specifications**:

| Field | Type | Required | Source/Logic | Description |
|-------|------|----------|--------------|-------------|
| `id` | string | Yes | Generate UUID v4 | Event identifier |
| `channel.platform` | string | Yes | Constant: `"Open"` | Platform type |
| `channel.type` | string | Yes | Constant: `"Private"` | Channel type |
| `channel.messageId` | string | Yes | From `wamid` | Message being acknowledged |
| `channel.to.id` | string | Yes | From config/env | Integration ID |
| `channel.from.id` | string | Yes | From `waId` | User identifier |
| `channel.from.idType` | string | Yes | Constant: `"Phone"` | ID type |
| `channel.time` | string | Yes | From `timestamp` (converted) | ISO 8601 UTC |
| `type` | string | Yes | Constant: `"Receipt"` | Event type |
| `status` | string | Yes | Mapped from `status` field | Receipt status |
| `direction` | string | Yes | Constant: `"Outbound"` | Always outbound for receipts |
| `reason` | string | No | From `reason` field | Failure reason (optional) |

**Status Mapping Table**:

| WhatsApp Status | Genesys Status | Process? | Notes |
|----------------|----------------|----------|-------|
| `sent` | `Published` | Optional | Configurable to ignore |
| `delivered` | `Delivered` | Yes | Message reached device |
| `read` | `Read` | Yes | User opened message |
| `failed` | `Failed` | Yes | Delivery failed, include reason |

**Configuration Option**:
```
IGNORE_SENT_STATUS=true  // Skip processing "sent" events
```

### 5.5 HTTP Headers for Dispatch

**Request Headers to Genesys API Service**:

```
POST /genesys/messages/inbound
Authorization: Bearer <internal-service-token>
Content-Type: application/json
X-Tenant-ID: uuid-tenant-1111-2222-3333
X-Correlation-ID: uuid-1234-5678-9abc-def0
X-Message-Source: inbound-transformer
```

| Header | Required | Source | Description |
|--------|----------|--------|-------------|
| `Authorization` | Yes | Config/env | Internal service authentication token |
| `Content-Type` | Yes | Constant | Always `application/json` |
| `X-Tenant-ID` | Yes | From `tenantId` | Organization identifier for routing |
| `X-Correlation-ID` | Yes | From `internalId` or generated | Request tracing |
| `X-Message-Source` | Yes | Constant | Service identifier |

---

## Functional Requirements

### 6.1 Message Consumption Flow (REQ-IN-07)

**Requirement**: Consume and validate messages from RabbitMQ

**Implementation Steps**:

1. **Connect to RabbitMQ**
   ```
   - Connect to queue: inbound-processed
   - Set prefetch count: 10 (limit in-flight messages)
   - Enable manual acknowledgments
   ```

2. **Receive Message**
   ```
   - Receive raw message bytes
   - Parse as UTF-8 string
   - Deserialize JSON
   ```

3. **Validate Structure**
   ```
   - Check JSON is valid
   - Verify required fields present
   - Validate field types
   - Check field constraints
   ```

4. **Idempotency Check**
   ```
   - Extract/generate idempotency key
   - Check cache (Redis or in-memory)
   - If duplicate: ACK and return
   - If new: Add to cache with 24h TTL
   ```

5. **Process Message**
   ```
   - Transform payload
   - Dispatch to Genesys API
   - Handle response
   ```

6. **Acknowledgment**
   ```
   - On success: ACK
   - On retriable failure: NACK (requeue)
   - On permanent failure: ACK + DLQ
   ```

**Error Scenarios**:

| Error Type | Action | Rationale |
|------------|--------|-----------|
| Invalid JSON | ACK + log error | Cannot process, don't retry |
| Missing required field | ACK + log error | Invalid input, upstream issue |
| Duplicate message | ACK silently | Already processed |
| Transformation error | ACK + log error | Logic error, needs code fix |
| Dispatch 4xx error | ACK + log error | Client error, won't succeed on retry |
| Dispatch 5xx error | NACK | Temporary failure, retry |
| Dispatch timeout | NACK | Network issue, retry |
| Max retries exceeded | ACK + route to DLQ | Persistent failure, needs investigation |

**Idempotency Cache Interface**:
```
Key Format (Messages): "msg:{internalId}"
Key Format (Events): "evt:{sha256(wamid|status|timestamp)}"
Value: "1" (simple flag)
TTL: 86400 seconds (24 hours)

Operations:
- SET key IF NOT EXISTS with TTL
- Return: true if new, false if exists
```

**Validation Pseudo-code**:
```python
def validate_message(payload):
    if not is_valid_json(payload):
        raise InvalidJSONError()
    
    if "type" not in payload:
        raise MissingFieldError("type")
    
    if payload["type"] not in ["message", "event"]:
        raise InvalidFieldError("type", payload["type"])
    
    if "tenantId" not in payload:
        raise MissingFieldError("tenantId")
    
    if not is_uuid(payload["tenantId"]):
        raise InvalidFieldError("tenantId", "must be UUID")
    
    if "waId" not in payload:
        raise MissingFieldError("waId")
    
    if payload["type"] == "message":
        validate_message_specific(payload)
    else:
        validate_event_specific(payload)

def validate_message_specific(payload):
    required = ["internalId", "conversationId", "wamid", "timestamp"]
    for field in required:
        if field not in payload:
            raise MissingFieldError(field)
    
    if "payload" not in payload:
        raise MissingFieldError("payload")
    
    has_body = "body" in payload.get("payload", {})
    has_media = "media" in payload.get("payload", {})
    
    if not has_body and not has_media:
        raise InvalidPayloadError("Must have body or media")
    
    if has_media:
        media = payload["payload"]["media"]
        if "url" not in media or "mime_type" not in media:
            raise InvalidPayloadError("Media must have url and mime_type")

def validate_event_specific(payload):
    required = ["wamid", "status", "timestamp"]
    for field in required:
        if field not in payload:
            raise MissingFieldError(field)
    
    valid_statuses = ["sent", "delivered", "read", "failed"]
    if payload["status"] not in valid_statuses:
        raise InvalidFieldError("status", payload["status"])
```

### 6.2 Message Transformation Logic (REQ-IN-05)

**Requirement**: Transform WhatsApp payloads to Genesys Open Messaging format

#### 6.2.1 Header/Channel Mapping

**Transformation Rules**:

| Input Field | Output Field | Transformation |
|-------------|--------------|----------------|
| `internalId` | `id` | Direct copy |
| `wamid` | `channel.messageId` | Direct copy |
| `waId` | `channel.from.id` | Direct copy |
| `waId` | `channel.from.idType` | Constant: `"Phone"` |
| `contactName` | `channel.from.nickname` | Direct copy (if present) |
| `contactName` | `channel.from.firstName` | Extract first word (if present) |
| `timestamp` | `channel.time` | Convert Unix → ISO 8601 UTC |
| `tenantId` | Header: `X-Tenant-ID` | Direct copy |
| N/A | `channel.platform` | Constant: `"Open"` |
| N/A | `channel.type` | Constant: `"Private"` |
| Config | `channel.to.id` | From environment/config |

**Timestamp Conversion**:
```python
def unix_to_iso8601(unix_timestamp):
    """
    Convert Unix epoch (seconds) to ISO 8601 UTC string
    
    Input: 1700000000
    Output: "2023-11-15T03:33:20.000Z"
    """
    dt = datetime.fromtimestamp(unix_timestamp, tz=timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    
    # Important: 
    # - Always use UTC timezone
    # - Include milliseconds (3 decimal places)
    # - End with 'Z' suffix
```

**Timestamp Validation**:
```python
def validate_timestamp(timestamp):
    """
    Reject timestamps too far in the future
    Prevents clock skew issues
    """
    current_time = time.time()
    max_future_skew = 300  # 5 minutes
    
    if timestamp > current_time + max_future_skew:
        raise InvalidTimestampError(
            f"Timestamp {timestamp} is {timestamp - current_time} seconds in future"
        )
```

**Name Parsing**:
```python
def parse_first_name(contact_name):
    """
    Extract first name from contact name
    
    Examples:
    "John Doe" -> "John"
    "Mary Jane Watson" -> "Mary"
    "Alice" -> "Alice"
    "" -> None
    None -> None
    """
    if not contact_name:
        return None
    
    parts = contact_name.strip().split()
    return parts[0] if parts else None
```

#### 6.2.2 Message Body Mapping

**Decision Tree**:
```
IF payload contains "body" AND payload contains "media":
    type = "Text"
    text = body
    content = [create_attachment(media)]
    
ELSE IF payload contains "body":
    type = "Text"
    text = body
    content = [] (omit)
    
ELSE IF payload contains "media":
    type = "Text"
    text = media.caption IF exists ELSE "[Attachment]"
    content = [create_attachment(media)]
```

**Text Message Transformation**:
```python
def transform_text_message(payload):
    """Text-only message"""
    return {
        "type": "Text",
        "text": payload["body"],
        "direction": "Inbound"
    }
```

**Media Message Transformation**:
```python
def transform_media_message(payload):
    """Media with optional caption"""
    media = payload["media"]
    
    return {
        "type": "Text",
        "text": media.get("caption", "[Attachment]"),
        "content": [{
            "contentType": "Attachment",
            "attachment": {
                "url": media["url"],
                "mime": media["mime_type"]
            }
        }],
        "direction": "Inbound"
    }
```

**Combined Message Transformation**:
```python
def transform_combined_message(payload):
    """Text body with media attachment"""
    media = payload["media"]
    
    return {
        "type": "Text",
        "text": payload["body"],
        "content": [{
            "contentType": "Attachment",
            "attachment": {
                "url": media["url"],
                "mime": media["mime_type"]
            }
        }],
        "direction": "Inbound"
    }
```

#### 6.2.3 Media Type Mapping

**MIME Type to Genesys Mapping**:

| MIME Type Pattern | Genesys Type | Examples |
|------------------|--------------|----------|
| `image/*` | `Image` | image/jpeg, image/png, image/gif, image/webp |
| `video/*` | `Video` | video/mp4, video/quicktime, video/3gpp |
| `audio/*` | `Audio` | audio/mpeg, audio/ogg, audio/aac |
| `application/pdf` | `File` | PDF documents |
| `application/*` | `File` | application/zip, application/msword |
| `text/*` | `File` | text/plain, text/csv |

**Implementation**:
```python
def map_mime_to_genesys_type(mime_type):
    """
    Map MIME type to Genesys media type
    
    Args:
        mime_type: MIME type string (e.g., "image/jpeg")
        
    Returns:
        Genesys type: "Image", "Video", "Audio", or "File"
    """
    mime_lower = mime_type.lower()
    
    if mime_lower.startswith("image/"):
        return "Image"
    elif mime_lower.startswith("video/"):
        return "Video"
    elif mime_lower.startswith("audio/"):
        return "Audio"
    else:
        return "File"
```

**Media URL Validation**:
```python
def validate_media_url(url):
    """
    Validate media URL for security
    
    Requirements:
    1. Must use HTTPS
    2. Must not resolve to private IP ranges
    3. Must be well-formed URL
    """
    from urllib.parse import urlparse
    import ipaddress
    
    parsed = urlparse(url)
    
    # Check protocol
    if parsed.scheme != "https":
        raise InvalidMediaURLError("URL must use HTTPS")
    
    # Check hostname exists
    if not parsed.hostname:
        raise InvalidMediaURLError("URL must have valid hostname")
    
    # Check for private IP ranges
    try:
        ip = ipaddress.ip_address(parsed.hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            raise InvalidMediaURLError("URL resolves to private IP")
    except ValueError:
        # Not an IP address, it's a hostname - OK
        pass
    
    # Additional checks for common internal hostnames
    internal_keywords = ["localhost", "internal", "local", "127.0.0.1", "0.0.0.0"]
    hostname_lower = parsed.hostname.lower()
    for keyword in internal_keywords:
        if keyword in hostname_lower:
            raise InvalidMediaURLError(f"URL contains internal keyword: {keyword}")
    
    return True
```

### 6.3 Status Event Transformation (REQ-STATE-05)

**Requirement**: Transform WhatsApp status events to Genesys receipt events

**Transformation Logic**:
```python
def transform_status_event(payload, config):
    """
    Transform WhatsApp status to Genesys receipt
    
    Args:
        payload: Input event payload
        config: Service configuration
        
    Returns:
        Genesys receipt event or None (if ignored)
    """
    status = payload["status"]
    
    # Check if status should be ignored
    if status == "sent" and config.get("IGNORE_SENT_STATUS", True):
        return None  # Skip processing
    
    # Map status
    genesys_status = map_status(status)
    
    # Build receipt event
    receipt = {
        "id": generate_uuid(),  # Generate new UUID for event
        "channel": {
            "platform": "Open",
            "type": "Private",
            "messageId": payload["wamid"],
            "to": {
                "id": config["INTEGRATION_ID"]
            },
            "from": {
                "id": payload["waId"],
                "idType": "Phone"
            },
            "time": unix_to_iso8601(payload["timestamp"])
        },
        "type": "Receipt",
        "status": genesys_status,
        "direction": "Outbound"  # Always Outbound for receipts
    }
    
    # Add reason for failed status
    if status == "failed" and "reason" in payload:
        receipt["reason"] = payload["reason"]
    
    return receipt

def map_status(whatsapp_status):
    """Map WhatsApp status to Genesys status"""
    mapping = {
        "sent": "Published",
        "delivered": "Delivered",
        "read": "Read",
        "failed": "Failed"
    }
    return mapping.get(whatsapp_status, "Failed")
```

**Configuration**:
```bash
# Environment variable to control "sent" status processing
IGNORE_SENT_STATUS=true   # Default: ignore "sent" events
IGNORE_SENT_STATUS=false  # Process all status events
```

**Status Processing Matrix**:

| WhatsApp Status | Genesys Status | Default Action | Configuration |
|----------------|----------------|----------------|---------------|
| `sent` | `Published` | **IGNORE** | `IGNORE_SENT_STATUS=true` |
| `delivered` | `Delivered` | Process | N/A |
| `read` | `Read` | Process | N/A |
| `failed` | `Failed` | Process + include reason | N/A |

**Rationale for Ignoring "sent"**:
- Creates excessive event volume
- Minimal business value (intermediate state)
- Genesys primarily cares about delivered/read
- Can be enabled for debugging/audit purposes

### 6.4 Dispatch to Genesys API (REQ-IN-08)

**Requirement**: Send transformed payloads to Genesys API Service with retry logic

#### 6.4.1 Endpoint Configuration

**Message Endpoint**:
```
POST /genesys/messages/inbound
Host: genesys-api-service.internal:8080
```

**Event Endpoint**:
```
POST /genesys/events/inbound
Host: genesys-api-service.internal:8080
```

**Base URL Configuration**:
```bash
GENESYS_API_BASE_URL=http://genesys-api-service.internal:8080
# or
GENESYS_API_BASE_URL=https://genesys-api.example.com
```

#### 6.4.2 Request Construction

```python
def dispatch_message(message, config):
    """
    Dispatch message to Genesys API Service
    
    Args:
        message: Transformed Genesys message payload
        config: Service configuration
        
    Returns:
        HTTP response
    """
    url = f"{config['GENESYS_API_BASE_URL']}/genesys/messages/inbound"
    
    headers = {
        "Authorization": f"Bearer {config['SERVICE_TOKEN']}",
        "Content-Type": "application/json",
        "X-Tenant-ID": message["tenantId"],  # From original payload
        "X-Correlation-ID": message["id"],
        "X-Message-Source": "inbound-transformer"
    }
    
    timeout = config.get("HTTP_TIMEOUT", 10)  # 10 seconds default
    
    response = http_client.post(
        url,
        json=message,
        headers=headers,
        timeout=timeout
    )
    
    return response

def dispatch_event(event, config):
    """
    Dispatch event to Genesys API Service
    
    Args:
        event: Transformed Genesys receipt event
        config: Service configuration
        
    Returns:
        HTTP response
    """
    url = f"{config['GENESYS_API_BASE_URL']}/genesys/events/inbound"
    
    headers = {
        "Authorization": f"Bearer {config['SERVICE_TOKEN']}",
        "Content-Type": "application/json",
        "X-Tenant-ID": event["tenantId"],  # From original payload
        "X-Correlation-ID": event["id"],
        "X-Message-Source": "inbound-transformer"
    }
    
    timeout = config.get("HTTP_TIMEOUT", 10)
    
    response = http_client.post(
        url,
        json=event,
        headers=headers,
        timeout=timeout
    )
    
    return response
```

#### 6.4.3 Response Handling

**HTTP Status Code Handling Matrix**:

| Status Code | Category | Action | Reason |
|-------------|----------|--------|--------|
| 200-299 | Success | ACK message | Request succeeded |
| 400 | Bad Request | ACK + log error | Invalid payload, won't fix with retry |
| 401 | Unauthorized | NACK + alert | Auth issue, needs investigation |
| 403 | Forbidden | ACK + log error | Permission issue, won't fix with retry |
| 404 | Not Found | ACK + log error | Endpoint/resource not found |
| 408 | Timeout | NACK | Server timeout, retry |
| 429 | Rate Limit | NACK | Throttled, retry with backoff |
| 500-599 | Server Error | NACK | Temporary failure, retry |
| Timeout | Network | NACK | Connection timeout, retry |
| Connection Error | Network | NACK | Connection failed, retry |

**Implementation**:
```python
def handle_response(response, original_message):
    """
    Handle HTTP response and determine action
    
    Returns:
        action: "ACK", "NACK", or "DLQ"
        retry: boolean
    """
    status = response.status_code
    
    if 200 <= status < 300:
        log_success(original_message, response)
        return "ACK", False
    
    elif 400 <= status < 500:
        # Client errors - don't retry
        if status == 401:
            # Auth error - alert but don't retry
            log_auth_error(original_message, response)
            alert("Authentication failure in Genesys dispatch")
            return "NACK", True  # Retry in case token refresh resolves it
        else:
            # Other 4xx - permanent failure
            log_client_error(original_message, response)
            return "ACK", False
    
    elif 500 <= status < 600:
        # Server errors - retry
        log_server_error(original_message, response)
        return "NACK", True
    
    else:
        # Unexpected status
        log_unexpected_response(original_message, response)
        return "NACK", True

def handle_exception(exception, original_message):
    """Handle network exceptions"""
    if isinstance(exception, TimeoutError):
        log_timeout(original_message, exception)
        return "NACK", True
    
    elif isinstance(exception, ConnectionError):
        log_connection_error(original_message, exception)
        return "NACK", True
    
    else:
        log_unexpected_error(original_message, exception)
        return "NACK", True
```

#### 6.4.4 Retry Strategy

**Exponential Backoff with Jitter**:
```python
import random
import time

def calculate_backoff(attempt):
    """
    Calculate backoff delay for retry attempt
    
    Args:
        attempt: Retry attempt number (1-indexed)
        
    Returns:
        Delay in seconds
    """
    base_delay = 1.0  # 1 second
    max_delay = 32.0  # 32 seconds
    
    # Exponential: 1, 2, 4, 8, 16, 32
    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
    
    # Add jitter: ±0-1000ms
    jitter = random.uniform(0, 1.0)
    
    return delay + jitter

# Retry schedule:
# Attempt 1: 0 seconds (immediate)
# Attempt 2: 1-2 seconds
# Attempt 3: 2-3 seconds
# Attempt 4: 4-5 seconds
# Attempt 5: 8-9 seconds
# After 5: Route to DLQ
```

**Retry Loop**:
```python
def process_with_retry(message, config):
    """
    Process message with retry logic
    
    Args:
        message: RabbitMQ message
        config: Service configuration
        
    Returns:
        success: boolean
    """
    max_attempts = config.get("MAX_RETRY_ATTEMPTS", 5)
    
    for attempt in range(1, max_attempts + 1):
        try:
            # Transform payload
            transformed = transform_payload(message.body, config)
            
            if transformed is None:
                # Ignored (e.g., "sent" status)
                return True
            
            # Dispatch
            response = dispatch(transformed, config)
            
            # Handle response
            action, should_retry = handle_response(response, message)
            
            if action == "ACK":
                return True
            
            if not should_retry:
                # Permanent failure
                route_to_dlq(message, "Permanent failure")
                return False
            
            # Retry
            if attempt < max_attempts:
                delay = calculate_backoff(attempt)
                log_retry(message, attempt, delay)
                time.sleep(delay)
            
        except Exception as e:
            action, should_retry = handle_exception(e, message)
            
            if not should_retry:
                route_to_dlq(message, f"Exception: {e}")
                return False
            
            if attempt < max_attempts:
                delay = calculate_backoff(attempt)
                log_retry(message, attempt, delay)
                time.sleep(delay)
    
    # Max retries exceeded
    route_to_dlq(message, "Max retries exceeded")
    return False
```

**RabbitMQ Integration**:
```python
def acknowledge_message(message, action):
    """
    Acknowledge or reject message
    
    Args:
        message: RabbitMQ message
        action: "ACK" or "NACK"
    """
    if action == "ACK":
        message.ack()  # Remove from queue
    else:
        message.nack(requeue=True)  # Return to queue for retry
```

### 6.5 Idempotency Implementation (REQ-IN-06)

**Requirement**: Ensure duplicate messages/events are not processed multiple times

#### 6.5.1 Key Generation

**For Messages**:
```python
def get_message_idempotency_key(payload):
    """
    Generate idempotency key for messages
    
    Args:
        payload: Input message payload
        
    Returns:
        Redis key string
    """
    internal_id = payload["internalId"]
    return f"inbound-transformer:dedup:msg:{internal_id}"
```

**For Events**:
```python
import hashlib

def get_event_idempotency_key(payload):
    """
    Generate idempotency key for events
    
    Uses composite key to handle same message with different statuses
    
    Args:
        payload: Input event payload
        
    Returns:
        Redis key string
    """
    wamid = payload["wamid"]
    status = payload["status"]
    timestamp = payload["timestamp"]
    
    # Create composite key
    composite = f"{wamid}|{status}|{timestamp}"
    
    # Hash for fixed-length key
    hash_value = hashlib.sha256(composite.encode()).hexdigest()
    
    return f"inbound-transformer:dedup:evt:{hash_value}"
```

#### 6.5.2 Cache Interface

**Redis Implementation**:
```python
import redis

class RedisIdempotencyCache:
    def __init__(self, redis_url, ttl=86400):
        """
        Initialize Redis cache
        
        Args:
            redis_url: Redis connection string
            ttl: Time to live in seconds (default 24 hours)
        """
        self.client = redis.from_url(redis_url)
        self.ttl = ttl
    
    def is_duplicate(self, key):
        """
        Check if key exists (message already processed)
        
        Args:
            key: Idempotency key
            
        Returns:
            True if duplicate, False if new
        """
        # SET if not exists, with TTL
        result = self.client.set(key, "1", ex=self.ttl, nx=True)
        
        # nx=True returns None if key already existed
        return result is None
    
    def mark_processed(self, key):
        """
        Mark message as processed (for manual control)
        
        Args:
            key: Idempotency key
        """
        self.client.setex(key, self.ttl, "1")
```

**In-Memory LRU Implementation** (for testing or single-instance):
```python
from collections import OrderedDict
import time

class LRUIdempotencyCache:
    def __init__(self, max_size=10000, ttl=86400):
        """
        Initialize in-memory LRU cache
        
        Args:
            max_size: Maximum number of keys to store
            ttl: Time to live in seconds
        """
        self.cache = OrderedDict()
        self.max_size = max_size
        self.ttl = ttl
    
    def is_duplicate(self, key):
        """
        Check if key exists
        
        Args:
            key: Idempotency key
            
        Returns:
            True if duplicate, False if new
        """
        # Clean expired entries
        self._clean_expired()
        
        # Check if key exists
        if key in self.cache:
            # Move to end (mark as recently used)
            self.cache.move_to_end(key)
            return True
        
        # Add new key
        expiry = time.time() + self.ttl
        self.cache[key] = expiry
        
        # Evict oldest if over size limit
        if len(self.cache) > self.max_size:
            self.cache.popitem(last=False)
        
        return False
    
    def _clean_expired(self):
        """Remove expired entries"""
        current_time = time.time()
        expired_keys = [
            k for k, expiry in self.cache.items()
            if expiry < current_time
        ]
        for k in expired_keys:
            del self.cache[k]
```

#### 6.5.3 Integration with Processing Flow

```python
def process_message(message, cache, config):
    """
    Process message with idempotency check
    
    Args:
        message: RabbitMQ message
        cache: Idempotency cache instance
        config: Service configuration
        
    Returns:
        success: boolean
    """
    try:
        # Parse payload
        payload = json.loads(message.body)
        
        # Validate
        validate_payload(payload)
        
        # Generate idempotency key
        if payload["type"] == "message":
            key = get_message_idempotency_key(payload)
        else:
            key = get_event_idempotency_key(payload)
        
        # Check for duplicate
        if cache.is_duplicate(key):
            log_duplicate(payload, key)
            metrics.increment("messages_duplicate_total")
            return True  # ACK silently
        
        # Transform and dispatch
        transformed = transform_payload(payload, config)
        
        if transformed is None:
            # Ignored (e.g., "sent" status)
            return True
        
        response = dispatch(transformed, config)
        
        # Handle response
        action, should_retry = handle_response(response, message)
        
        if action == "ACK":
            metrics.increment("messages_processed_total")
            return True
        else:
            # Will retry - don't mark as processed yet
            return False
        
    except Exception as e:
        log_error(message, e)
        metrics.increment("transformation_failures_total")
        # ACK to avoid infinite retries on transformation errors
        return True
```

### 6.6 Dead Letter Queue Handling

**Requirement**: Route persistently failed messages to DLQ for investigation

#### 6.6.1 RabbitMQ DLQ Configuration

**Exchange and Queue Setup**:
```
Exchange: inbound-transformer-dlq-exchange
Type: fanout

Queue: inbound-transformer-dlq
Durable: true
```

**Message Properties for DLQ**:
```python
def route_to_dlq(original_message, failure_reason):
    """
    Route message to dead letter queue
    
    Args:
        original_message: Original RabbitMQ message
        failure_reason: Human-readable failure reason
    """
    dlq_message = {
        "original_payload": original_message.body,
        "failure_reason": failure_reason,
        "failure_timestamp": int(time.time()),
        "retry_count": original_message.delivery_info.get("x-delivery-count", 0),
        "original_queue": "inbound-processed",
        "service": "inbound-transformer"
    }
    
    rabbitmq_channel.basic_publish(
        exchange="inbound-transformer-dlq-exchange",
        routing_key="",
        body=json.dumps(dlq_message),
        properties=pika.BasicProperties(
            delivery_mode=2,  # Persistent
            content_type="application/json"
        )
    )
    
    # Acknowledge original message
    original_message.ack()
    
    # Alert
    metrics.increment("messages_dlq_total")
    log_dlq(original_message, failure_reason)
```

#### 6.6.2 DLQ Monitoring

**Alert Conditions**:
```
Alert: "Inbound Transformer DLQ Activity"
Condition: messages_dlq_total > 0 in last 5 minutes
Severity: Warning

Alert: "Inbound Transformer High DLQ Rate"
Condition: messages_dlq_total > 10 in last 5 minutes
Severity: Critical
```

**DLQ Processing**:
```
DLQ messages should be:
1. Logged with full context
2. Stored for investigation
3. Reviewed regularly
4. Optionally replayed after fixes
```

---

## Non-Functional Requirements

### 7.1 Performance Requirements

**Throughput Targets**:
- **Minimum**: 50 messages/second per instance
- **Target**: 300 messages/second per instance
- **Peak**: 500 messages/second per instance (burst)

**Latency Targets**:
- **Transformation Logic**: < 5ms (p99)
- **End-to-End Processing**: < 100ms (p99, excluding Genesys API latency)
- **Idempotency Check**: < 2ms (p99)

**Resource Limits**:
```
CPU: 0.5-2.0 cores per instance
Memory: 256MB-1GB per instance
Network: 10Mbps per instance
```

**Scaling Strategy**:
- Horizontal scaling (add more instances)
- No vertical scaling needed
- Stateless design enables easy scaling
- Load balancing via RabbitMQ consumer count

### 7.2 Availability Requirements

**Uptime Target**: 99.9% (three nines)

**High Availability Design**:
- Multiple service instances (min 2)
- No single point of failure
- Graceful degradation
- Circuit breaker for downstream services

**Failure Modes**:
```
RabbitMQ unavailable: Service waits and retries connection
Genesys API unavailable: Messages retry with backoff, eventually DLQ
Redis unavailable: Fall back to in-memory cache (warning logged)
```

### 7.3 Reliability Requirements

**Message Delivery Guarantees**:
- **At-least-once**: Messages may be reprocessed on failure
- **Idempotent**: Reprocessing is safe
- **Ordered**: Not guaranteed (stateless design)

**Data Consistency**:
- Idempotency prevents duplicates
- State Manager ensures upstream consistency
- Genesys API Service handles downstream deduplication

**Failure Recovery**:
```
Service crash: Messages remain in RabbitMQ, reprocessed on restart
Network partition: Messages retry until success or DLQ
Downstream failure: Exponential backoff prevents overload
```

### 7.4 Statelessness

**No Persistent Storage**:
- No database connections
- No file system writes (except logs)
- No shared memory between instances

**Cache Usage**:
- Redis for idempotency (external, shared)
- In-memory LRU as fallback
- Cache misses are safe (reprocess once)

**Configuration**:
- All config from environment variables
- No config files required
- Secrets via environment or secrets manager

---

## Error Handling & Resilience

### 8.1 Error Categories

**Transient Errors** (Retry):
- Network timeouts
- 5xx HTTP responses
- Connection failures
- Rate limiting (429)
- Temporary auth failures

**Permanent Errors** (Don't Retry):
- Invalid JSON
- Missing required fields
- 4xx HTTP responses (except 429)
- Transformation logic errors
- Invalid data types

**Undefined Errors** (Retry Cautiously):
- Unexpected exceptions
- Unknown HTTP status codes
- Parsing errors

### 8.2 Circuit Breaker Pattern

**Implementation**:
```python
class CircuitBreaker:
    """
    Circuit breaker for Genesys API calls
    
    States:
    - CLOSED: Normal operation
    - OPEN: Block requests, fail fast
    - HALF_OPEN: Allow test request
    """
    
    def __init__(self, failure_threshold=5, timeout=60):
        """
        Args:
            failure_threshold: Failures before opening circuit
            timeout: Seconds before attempting recovery
        """
        self.state = "CLOSED"
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.last_failure_time = None
    
    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        
        if self.state == "OPEN":
            # Check if timeout expired
            if time.time() - self.last_failure_time > self.timeout:
                self.state = "HALF_OPEN"
                log_info("Circuit breaker entering HALF_OPEN state")
            else:
                raise CircuitBreakerOpenError("Circuit breaker is OPEN")
        
        try:
            result = func(*args, **kwargs)
            
            # Success - reset
            if self.state == "HALF_OPEN":
                self.state = "CLOSED"
                self.failure_count = 0
                log_info("Circuit breaker CLOSED (recovered)")
            
            return result
            
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()
            
            if self.failure_count >= self.failure_threshold:
                self.state = "OPEN"
                log_error(f"Circuit breaker OPEN after {self.failure_count} failures")
            
            raise e

# Usage
circuit_breaker = CircuitBreaker(failure_threshold=5, timeout=60)

try:
    response = circuit_breaker.call(dispatch_to_genesys, message, config)
except CircuitBreakerOpenError:
    # Fail fast, NACK message for later retry
    return "NACK", True
```

### 8.3 Graceful Degradation

**Degradation Scenarios**:

1. **Redis Unavailable**:
   ```python
   try:
       is_dup = redis_cache.is_duplicate(key)
   except RedisConnectionError:
       log_warning("Redis unavailable, using in-memory cache")
       is_dup = memory_cache.is_duplicate(key)
       metrics.increment("redis_fallback_total")
   ```

2. **High Latency**:
   ```python
   if response_time > threshold:
       log_warning(f"High latency detected: {response_time}ms")
       metrics.increment("high_latency_total")
       # Continue processing, but alert
   ```

3. **Rate Limiting**:
   ```python
   if response.status_code == 429:
       retry_after = response.headers.get("Retry-After", 60)
       log_info(f"Rate limited, backing off for {retry_after}s")
       time.sleep(retry_after)
       # Retry once, then NACK for later
   ```

### 8.4 Timeout Configuration

**HTTP Client Timeouts**:
```python
HTTP_CONNECT_TIMEOUT = 5  # seconds
HTTP_READ_TIMEOUT = 10     # seconds
HTTP_TOTAL_TIMEOUT = 15    # seconds

http_client = HttpClient(
    connect_timeout=HTTP_CONNECT_TIMEOUT,
    read_timeout=HTTP_READ_TIMEOUT,
    total_timeout=HTTP_TOTAL_TIMEOUT
)
```

**RabbitMQ Timeouts**:
```python
RABBITMQ_CONNECTION_TIMEOUT = 10  # seconds
RABBITMQ_HEARTBEAT = 30           # seconds
```

---

## Security Requirements

### 9.1 Authentication & Authorization

**Service Token**:
```bash
# Environment variable
SERVICE_TOKEN=<jwt-token-or-api-key>

# Used in Authorization header
Authorization: Bearer ${SERVICE_TOKEN}
```

**Token Management**:
- Rotate tokens regularly (90 days)
- Never log token values
- Use secrets manager for storage
- Validate token on startup

### 9.2 Input Validation

**Required Validations**:

1. **JSON Structure**: Well-formed JSON
2. **Required Fields**: All mandatory fields present
3. **Field Types**: Correct data types
4. **Field Lengths**: Within limits
5. **URL Safety**: HTTPS only, no private IPs
6. **Phone Format**: Valid E.164 format
7. **UUID Format**: Valid UUID v4
8. **Timestamp Range**: Not too far in future

**Security Boundaries**:
```python
MAX_BODY_LENGTH = 4096     # characters
MAX_CAPTION_LENGTH = 1024  # characters
MAX_NAME_LENGTH = 256      # characters
MAX_REASON_LENGTH = 512    # characters
MAX_PAYLOAD_SIZE = 2 * 1024 * 1024  # 2MB
```

### 9.3 URL Validation

**Security Checks**:
```python
def validate_url_security(url):
    """
    Comprehensive URL security validation
    
    Prevents:
    - Non-HTTPS URLs
    - Private IP ranges
    - Localhost access
    - Internal hostnames
    - SSRF attacks
    """
    parsed = urlparse(url)
    
    # 1. Protocol check
    if parsed.scheme != "https":
        raise SecurityError("URL must use HTTPS protocol")
    
    # 2. Hostname required
    if not parsed.hostname:
        raise SecurityError("URL must have valid hostname")
    
    # 3. Check for IP addresses
    try:
        ip = ipaddress.ip_address(parsed.hostname)
        
        # Block private ranges
        if ip.is_private:
            raise SecurityError("Private IP ranges not allowed")
        
        # Block loopback
        if ip.is_loopback:
            raise SecurityError("Loopback addresses not allowed")
        
        # Block link-local
        if ip.is_link_local:
            raise SecurityError("Link-local addresses not allowed")
        
        # Block multicast
        if ip.is_multicast:
            raise SecurityError("Multicast addresses not allowed")
        
    except ValueError:
        # Not an IP address, continue with hostname checks
        pass
    
    # 4. Block internal keywords
    hostname_lower = parsed.hostname.lower()
    blocked_keywords = [
        "localhost", "local", "internal", "corp",
        "127.0.0.1", "0.0.0.0", "::1"
    ]
    
    for keyword in blocked_keywords:
        if keyword in hostname_lower:
            raise SecurityError(f"Blocked hostname keyword: {keyword}")
    
    # 5. Block metadata endpoints
    if hostname_lower.startswith("169.254."):
        raise SecurityError("AWS metadata endpoint blocked")
    
    return True
```

### 9.4 Secret Management

**Never Log Secrets**:
```python
def sanitize_log_payload(payload):
    """
    Remove sensitive fields from logs
    
    Fields to redact:
    - Authorization headers
    - Service tokens
    - API keys
    - Possibly phone numbers (PII)
    """
    sanitized = payload.copy()
    
    # Redact headers
    if "headers" in sanitized:
        if "Authorization" in sanitized["headers"]:
            sanitized["headers"]["Authorization"] = "[REDACTED]"
    
    # Optionally redact phone numbers
    if "waId" in sanitized:
        sanitized["waId"] = sanitized["waId"][:3] + "****" + sanitized["waId"][-2:]
    
    return sanitized
```

**Environment Variables**:
```bash
# Required secrets
SERVICE_TOKEN=<secret>
REDIS_PASSWORD=<secret>

# Optional secrets
GENESYS_API_KEY=<secret>
```

---

## Observability & Monitoring

### 10.1 Structured Logging

**Log Format**:
```json
{
  "timestamp": "2023-11-15T03:33:20.123Z",
  "level": "INFO",
  "service": "inbound-transformer",
  "message": "Message processed successfully",
  "tenantId": "uuid-tenant-1111",
  "correlationId": "uuid-1234-5678",
  "messageType": "message",
  "wamid": "wamid.HBg...",
  "processingTimeMs": 45,
  "genesysStatus": 200
}
```

**Log Levels**:
- **DEBUG**: Detailed transformation steps (disabled in production)
- **INFO**: Successful processing, normal operations
- **WARN**: Degraded mode, fallbacks, high latency
- **ERROR**: Processing failures, exceptions
- **CRITICAL**: Service-level failures, DLQ routing

**Key Log Events**:

1. **Message Received**:
   ```json
   {
     "level": "INFO",
     "message": "Message received from queue",
     "messageType": "message",
     "tenantId": "uuid-tenant-1111",
     "correlationId": "uuid-1234"
   }
   ```

2. **Duplicate Detected**:
   ```json
   {
     "level": "INFO",
     "message": "Duplicate message detected",
     "correlationId": "uuid-1234",
     "idempotencyKey": "inbound-transformer:dedup:msg:uuid-1234"
   }
   ```

3. **Transformation Complete**:
   ```json
   {
     "level": "DEBUG",
     "message": "Payload transformed",
     "correlationId": "uuid-1234",
     "inputType": "message",
     "outputType": "Text",
     "hasMedia": true
   }
   ```

4. **Dispatch Success**:
   ```json
   {
     "level": "INFO",
     "message": "Message dispatched successfully",
     "correlationId": "uuid-1234",
     "endpoint": "/genesys/messages/inbound",
     "statusCode": 200,
     "latencyMs": 45
   }
   ```

5. **Dispatch Failure**:
   ```json
   {
     "level": "ERROR",
     "message": "Failed to dispatch message",
     "correlationId": "uuid-1234",
     "endpoint": "/genesys/messages/inbound",
     "statusCode": 500,
     "error": "Internal Server Error",
     "attempt": 3,
     "willRetry": true
   }
   ```

6. **DLQ Routing**:
   ```json
   {
     "level": "ERROR",
     "message": "Message routed to DLQ",
     "correlationId": "uuid-1234",
     "reason": "Max retries exceeded",
     "retryCount": 5,
     "originalPayload": "..."
   }
   ```

### 10.2 Metrics

**Prometheus Metrics**:

```python
# Counter metrics
messages_received_total = Counter(
    "messages_received_total",
    "Total messages received from queue",
    ["tenant_id", "message_type"]
)

messages_processed_total = Counter(
    "messages_processed_total",
    "Total messages successfully processed",
    ["tenant_id", "message_type"]
)

messages_duplicate_total = Counter(
    "messages_duplicate_total",
    "Total duplicate messages detected",
    ["tenant_id", "message_type"]
)

transformation_failures_total = Counter(
    "transformation_failures_total",
    "Total transformation failures",
    ["tenant_id", "error_type"]
)

genesys_dispatch_failures_total = Counter(
    "genesys_dispatch_failures_total",
    "Total Genesys API dispatch failures",
    ["tenant_id", "status_code"]
)

messages_dlq_total = Counter(
    "messages_dlq_total",
    "Total messages routed to DLQ",
    ["tenant_id", "failure_reason"]
)

redis_fallback_total = Counter(
    "redis_fallback_total",
    "Total Redis fallback to in-memory cache"
)

# Histogram metrics
processing_latency_seconds = Histogram(
    "processing_latency_seconds",
    "End-to-end processing latency",
    ["tenant_id", "message_type"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0]
)

transformation_duration_seconds = Histogram(
    "transformation_duration_seconds",
    "Transformation logic duration",
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1]
)

genesys_dispatch_duration_seconds = Histogram(
    "genesys_dispatch_duration_seconds",
    "Genesys API dispatch duration",
    ["status_code"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0]
)

idempotency_check_duration_seconds = Histogram(
    "idempotency_check_duration_seconds",
    "Idempotency cache check duration",
    buckets=[0.001, 0.002, 0.005, 0.01, 0.05]
)

# Gauge metrics
rabbitmq_queue_depth = Gauge(
    "rabbitmq_queue_depth",
    "Current message count in queue"
)

circuit_breaker_state = Gauge(
    "circuit_breaker_state",
    "Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)"
)
```

**Metrics Usage**:
```python
def process_message_with_metrics(message, config):
    """Process message with metrics collection"""
    
    start_time = time.time()
    tenant_id = message.get("tenantId", "unknown")
    message_type = message.get("type", "unknown")
    
    # Increment received counter
    messages_received_total.labels(
        tenant_id=tenant_id,
        message_type=message_type
    ).inc()
    
    try:
        # Check idempotency
        idempotency_start = time.time()
        is_duplicate = check_idempotency(message)
        idempotency_check_duration_seconds.observe(
            time.time() - idempotency_start
        )
        
        if is_duplicate:
            messages_duplicate_total.labels(
                tenant_id=tenant_id,
                message_type=message_type
            ).inc()
            return
        
        # Transform
        transform_start = time.time()
        transformed = transform_payload(message, config)
        transformation_duration_seconds.observe(
            time.time() - transform_start
        )
        
        # Dispatch
        dispatch_start = time.time()
        response = dispatch_to_genesys(transformed, config)
        genesys_dispatch_duration_seconds.labels(
            status_code=response.status_code
        ).observe(time.time() - dispatch_start)
        
        if 200 <= response.status_code < 300:
            messages_processed_total.labels(
                tenant_id=tenant_id,
                message_type=message_type
            ).inc()
        else:
            genesys_dispatch_failures_total.labels(
                tenant_id=tenant_id,
                status_code=response.status_code
            ).inc()
        
    except Exception as e:
        transformation_failures_total.labels(
            tenant_id=tenant_id,
            error_type=type(e).__name__
        ).inc()
        raise
    
    finally:
        # Record total latency
        processing_latency_seconds.labels(
            tenant_id=tenant_id,
            message_type=message_type
        ).observe(time.time() - start_time)
```

### 10.3 Health Checks

**Liveness Probe**:
```python
@app.route("/health/live")
def liveness():
    """
    Liveness check - is the service running?
    
    Returns 200 if service is alive
    """
    return {"status": "alive"}, 200
```

**Readiness Probe**:
```python
@app.route("/health/ready")
def readiness():
    """
    Readiness check - is the service ready to process messages?
    
    Checks:
    - RabbitMQ connection
    - Genesys API reachability
    - Redis connection (if configured)
    
    Returns 200 if ready, 503 if not
    """
    checks = {}
    
    # Check RabbitMQ
    try:
        rabbitmq_channel.queue_declare(
            queue="inbound-processed",
            passive=True
        )
        checks["rabbitmq"] = "OK"
    except Exception as e:
        checks["rabbitmq"] = f"FAILED: {e}"
        return {"status": "not ready", "checks": checks}, 503
    
    # Check Genesys API
    try:
        response = requests.get(
            f"{config['GENESYS_API_BASE_URL']}/health",
            timeout=2
        )
        if response.status_code == 200:
            checks["genesys_api"] = "OK"
        else:
            checks["genesys_api"] = f"FAILED: {response.status_code}"
            return {"status": "not ready", "checks": checks}, 503
    except Exception as e:
        checks["genesys_api"] = f"FAILED: {e}"
        return {"status": "not ready", "checks": checks}, 503
    
    # Check Redis (optional)
    if config.get("REDIS_URL"):
        try:
            redis_client.ping()
            checks["redis"] = "OK"
        except Exception as e:
            checks["redis"] = f"DEGRADED: {e}"
            # Don't fail readiness - Redis is optional
    
    return {"status": "ready", "checks": checks}, 200
```

### 10.4 Distributed Tracing

**Correlation ID Propagation**:
```python
def propagate_correlation_id(original_message):
    """
    Propagate correlation ID through system
    
    Flow:
    1. Extract from input message (internalId)
    2. Include in all logs
    3. Pass to Genesys API (X-Correlation-ID header)
    4. Include in metrics labels
    """
    correlation_id = original_message.get("internalId") or str(uuid.uuid4())
    
    # Set in thread-local context
    context.correlation_id = correlation_id
    
    return correlation_id

def log_with_correlation(level, message, **kwargs):
    """Log with correlation ID"""
    correlation_id = getattr(context, "correlation_id", None)
    
    log_data = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "level": level,
        "service": "inbound-transformer",
        "message": message,
        "correlationId": correlation_id,
        **kwargs
    }
    
    print(json.dumps(log_data))
```

---

## Testing Requirements

### 11.1 Unit Tests

**Test Coverage Goals**: >80% code coverage

**Key Test Scenarios**:

1. **Transformation Tests**:
   ```python
   def test_transform_text_message():
       input_payload = {
           "type": "message",
           "internalId": "uuid-1234",
           "tenantId": "uuid-5678",
           "waId": "919876543210",
           "conversationId": "conv-999",
           "wamid": "wamid.HBg...",
           "contactName": "John Doe",
           "timestamp": 1700000000,
           "payload": {
               "body": "Hello World"
           }
       }
       
       result = transform_message(input_payload, config)
       
       assert result["type"] == "Text"
       assert result["text"] == "Hello World"
       assert result["channel"]["from"]["id"] == "919876543210"
       assert result["channel"]["from"]["nickname"] == "John Doe"
       assert result["channel"]["from"]["firstName"] == "John"
   
   def test_transform_media_message():
       # Test media-only message
       # Test text + media
       # Test caption fallback
       pass
   
   def test_transform_status_event():
       # Test each status type
       # Test ignored "sent" status
       # Test failed with reason
       pass
   ```

2. **Validation Tests**:
   ```python
   def test_validate_missing_required_field():
       invalid_payload = {"type": "message"}
       
       with pytest.raises(MissingFieldError):
           validate_payload(invalid_payload)
   
   def test_validate_invalid_timestamp():
       # Test future timestamp
       # Test negative timestamp
       pass
   
   def test_validate_media_url():
       # Test HTTPS requirement
       # Test private IP rejection
       # Test localhost rejection
       pass
   ```

3. **Idempotency Tests**:
   ```python
   def test_idempotency_key_generation():
       message = {"internalId": "uuid-1234", "type": "message"}
       key = get_message_idempotency_key(message)
       
       assert key == "inbound-transformer:dedup:msg:uuid-1234"
   
   def test_duplicate_detection():
       cache = LRUIdempotencyCache()
       key = "test-key"
       
       assert not cache.is_duplicate(key)  # First time
       assert cache.is_duplicate(key)      # Second time (duplicate)
   ```

4. **Retry Logic Tests**:
   ```python
   def test_exponential_backoff():
       assert calculate_backoff(1) >= 1.0
       assert calculate_backoff(2) >= 2.0
       assert calculate_backoff(5) >= 16.0
   
   def test_retry_on_5xx():
       # Mock 500 response
       # Verify NACK
       # Verify retry
       pass
   
   def test_no_retry_on_4xx():
       # Mock 400 response
       # Verify ACK
       # Verify no retry
       pass
   ```

### 11.2 Integration Tests

**Test Scenarios**:

1. **End-to-End Flow**:
   ```python
   def test_e2e_message_processing():
       # 1. Publish message to RabbitMQ
       # 2. Service consumes and processes
       # 3. Verify call to Genesys API
       # 4. Verify message acknowledged
       pass
   ```

2. **Failure Recovery**:
   ```python
   def test_retry_after_genesys_failure():
       # 1. Mock Genesys API to return 500
       # 2. Publish message
       # 3. Verify retries with backoff
       # 4. Mock API to return 200
       # 5. Verify eventual success
       pass
   
   def test_dlq_after_max_retries():
       # 1. Mock Genesys API to always return 500
       # 2. Publish message
       # 3. Verify max retries
       # 4. Verify DLQ routing
       pass
   ```

3. **Idempotency**:
   ```python
   def test_duplicate_message_handling():
       # 1. Publish message twice
       # 2. Verify processed only once
       # 3. Verify second one ACKed without processing
       pass
   ```

### 11.3 Performance Tests

**Load Testing**:
```python
def test_throughput():
    """
    Test: Service can handle 300 msg/sec
    
    Setup:
    - Start service with 2 instances
    - Publish 30,000 messages to queue
    - Measure processing time
    
    Assert:
    - All messages processed within 100 seconds
    - p99 latency < 100ms
    - No message loss
    """
    pass

def test_latency_under_load():
    """
    Test: Latency remains acceptable under load
    
    Setup:
    - Sustained load of 200 msg/sec
    - Run for 10 minutes
    
    Assert:
    - p50 latency < 50ms
    - p99 latency < 100ms
    - No DLQ messages
    """
    pass
```

### 11.4 Chaos Testing

**Failure Injection**:
```python
def test_rabbitmq_connection_loss():
    """
    Test: Service handles RabbitMQ reconnection
    
    1. Start service
    2. Kill RabbitMQ connection
    3. Wait 10 seconds
    4. Restore connection
    5. Verify service recovers
    """
    pass

def test_genesys_api_downtime():
    """
    Test: Service handles downstream outage
    
    1. Publish messages
    2. Simulate Genesys API down (502)
    3. Verify retries
    4. Restore API
    5. Verify messages processed
    """
    pass
```

---

## Deployment & Operations

### 12.1 Environment Variables

**Required Configuration**:
```bash
# Service Identity
SERVICE_NAME=inbound-transformer
SERVICE_VERSION=1.2.0

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@rabbitmq.internal:5672/vhost
RABBITMQ_QUEUE=inbound-processed
RABBITMQ_PREFETCH_COUNT=10

# Genesys API
GENESYS_API_BASE_URL=http://genesys-api-service.internal:8080
GENESYS_INTEGRATION_ID=integration-uuid-from-genesys
SERVICE_TOKEN=jwt-or-api-key

# Idempotency Cache
REDIS_URL=redis://redis.internal:6379/0
REDIS_PASSWORD=secret
REDIS_CACHE_TTL=86400

# Retry Configuration
MAX_RETRY_ATTEMPTS=5
BASE_RETRY_DELAY=1
MAX_RETRY_DELAY=32

# Feature Flags
IGNORE_SENT_STATUS=true

# Timeouts
HTTP_CONNECT_TIMEOUT=5
HTTP_READ_TIMEOUT=10
HTTP_TOTAL_TIMEOUT=15

# Observability
LOG_LEVEL=INFO
METRICS_PORT=9090
```

**Optional Configuration**:
```bash
# Performance Tuning
WORKER_CONCURRENCY=10
MAX_MESSAGE_SIZE=2097152  # 2MB

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60

# Testing
DRY_RUN=false  # Don't actually dispatch to Genesys
```

### 12.2 Container Configuration

**Dockerfile Example**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY src ./src

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node healthcheck.js

# Expose metrics port
EXPOSE 9090

CMD ["node", "src/index.js"]
```

**Kubernetes Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inbound-transformer
spec:
  replicas: 2  # Minimum for HA
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: inbound-transformer
  template:
    metadata:
      labels:
        app: inbound-transformer
        version: "1.2"
    spec:
      containers:
      - name: inbound-transformer
        image: inbound-transformer:1.2.0
        resources:
          requests:
            memory: "256Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "2000m"
        env:
        - name: SERVICE_NAME
          value: "inbound-transformer"
        - name: RABBITMQ_URL
          valueFrom:
            secretKeyRef:
              name: rabbitmq-credentials
              key: url
        - name: SERVICE_TOKEN
          valueFrom:
            secretKeyRef:
              name: service-tokens
              key: genesys-api-token
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: url
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        ports:
        - containerPort: 9090
          name: metrics
```

### 12.3 Horizontal Scaling

**Scaling Strategy**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: inbound-transformer-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: inbound-transformer
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: rabbitmq_queue_depth
      target:
        type: AverageValue
        averageValue: "100"
```

### 12.4 Monitoring Alerts

**Alert Definitions**:

1. **High Error Rate**:
   ```yaml
   alert: InboundTransformerHighErrorRate
   expr: rate(transformation_failures_total[5m]) > 0.1
   severity: warning
   description: High error rate in message transformation
   ```

2. **Genesys API Failures**:
   ```yaml
   alert: InboundTransformerGenesysAPIFailures
   expr: rate(genesys_dispatch_failures_total[5m]) > 0.05
   severity: critical
   description: High failure rate dispatching to Genesys API
   ```

3. **DLQ Activity**:
   ```yaml
   alert: InboundTransformerDLQActivity
   expr: increase(messages_dlq_total[5m]) > 0
   severity: warning
   description: Messages being routed to dead letter queue
   ```

4. **High Latency**:
   ```yaml
   alert: InboundTransformerHighLatency
   expr: histogram_quantile(0.99, processing_latency_seconds) > 0.1
   severity: warning
   description: p99 latency exceeds 100ms
   ```

5. **Service Down**:
   ```yaml
   alert: InboundTransformerDown
   expr: up{job="inbound-transformer"} == 0
   severity: critical
   description: Inbound Transformer service is down
   ```

### 12.5 Runbook

**Common Issues**:

1. **Service Won't Start**:
   ```
   Symptom: Container crashes on startup
   
   Check:
   - Environment variables configured?
   - RabbitMQ accessible?
   - Redis accessible (if configured)?
   - Service token valid?
   
   Logs:
   kubectl logs deployment/inbound-transformer
   ```

2. **Messages Not Processing**:
   ```
   Symptom: Queue depth increasing
   
   Check:
   - Service instances running?
   - Genesys API reachable?
   - Circuit breaker open?
   - Rate limiting?
   
   Debug:
   kubectl get pods -l app=inbound-transformer
   kubectl exec -it <pod> -- curl localhost:8080/health/ready
   ```

3. **High DLQ Rate**:
   ```
   Symptom: Many messages in DLQ
   
   Investigate:
   - Check DLQ messages for patterns
   - Look for validation errors
   - Check Genesys API status
   - Review failure reasons in logs
   
   Query DLQ:
   rabbitmqadmin get queue=inbound-transformer-dlq count=10
   ```

4. **Performance Degradation**:
   ```
   Symptom: High latency, slow processing
   
   Check:
   - CPU/memory usage
   - RabbitMQ connection count
   - Redis latency
   - Genesys API response times
   
   Scale:
   kubectl scale deployment inbound-transformer --replicas=5
   ```

---

## Implementation Guidelines

### 13.1 Project Structure

**Recommended Layout**:
```
inbound-transformer/
├── src/
│   ├── index.js                 # Entry point
│   ├── config.js                # Configuration loading
│   ├── rabbitmq/
│   │   ├── consumer.js          # RabbitMQ consumer
│   │   └── connection.js        # Connection management
│   ├── transform/
│   │   ├── message.js           # Message transformation
│   │   ├── event.js             # Event transformation
│   │   └── validation.js        # Input validation
│   ├── dispatch/
│   │   ├── client.js            # HTTP client
│   │   ├── retry.js             # Retry logic
│   │   └── circuit-breaker.js   # Circuit breaker
│   ├── cache/
│   │   ├── redis.js             # Redis cache
│   │   └── lru.js               # In-memory cache
│   ├── observability/
│   │   ├── logger.js            # Structured logging
│   │   ├── metrics.js           # Prometheus metrics
│   │   └── health.js            # Health checks
│   └── utils/
│       ├── timestamp.js         # Time utilities
│       ├── security.js          # URL validation
│       └── hash.js              # Hashing functions
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/
│   └── requirements.md          # This document
├── Dockerfile
├── docker-compose.yml           # Local development
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── hpa.yaml
└── package.json
```

### 13.2 Code Style Guidelines

**Key Principles**:

1. **Simplicity**: Prefer simple, readable code over clever solutions
2. **Statelessness**: No global mutable state
3. **Pure Functions**: Transformation logic should be pure functions
4. **Error Handling**: Explicit error handling, no silent failures
5. **Testing**: Write tests first for transformation logic

**Example Patterns**:

```python
# Good: Pure transformation function
def transform_message(input_payload, config):
    """Transform WhatsApp message to Genesys format"""
    return {
        "id": input_payload["internalId"],
        "type": "Text",
        "text": input_payload["payload"]["body"],
        # ...
    }

# Bad: Stateful transformation
class MessageTransformer:
    def __init__(self):
        self.counter = 0
    
    def transform(self, input_payload):
        self.counter += 1  # Side effect!
        return {...}
```

```python
# Good: Explicit error handling
def dispatch_message(message, config):
    try:
        response = http_client.post(url, json=message)
        if not response.ok:
            raise DispatchError(f"HTTP {response.status_code}")
        return response
    except TimeoutError as e:
        raise RetryableError("Timeout") from e

# Bad: Silent failures
def dispatch_message(message, config):
    try:
        response = http_client.post(url, json=message)
        return response
    except:
        pass  # What happened?
```

### 13.3 Dependencies

**Recommended Libraries**:

**Node.js**:
```json
{
  "dependencies": {
    "amqplib": "^0.10.0",
    "axios": "^1.4.0",
    "ioredis": "^5.3.0",
    "prom-client": "^14.2.0",
    "winston": "^3.9.0"
  }
}
```

**Python**:
```toml
[dependencies]
pika = "^1.3.0"
requests = "^2.31.0"
redis = "^4.5.0"
prometheus-client = "^0.17.0"
```

**Go**:
```go
require (
    github.com/streadway/amqp v1.1.0
    github.com/go-redis/redis/v8 v8.11.5
    github.com/prometheus/client_golang v1.16.0
)
```

### 13.4 Development Workflow

**Local Development**:
```bash
# Start dependencies
docker-compose up -d rabbitmq redis

# Run service
npm start  # or: python main.py, go run main.go

# Run tests
npm test

# Check code quality
npm run lint
npm run type-check

# Local load test
npm run load-test
```

**Docker Compose for Local Dev**:
```yaml
version: '3.8'
services:
  rabbitmq:
    image: rabbitmq:3.11-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: dev
      RABBITMQ_DEFAULT_PASS: dev
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  inbound-transformer:
    build: .
    environment:
      RABBITMQ_URL: amqp://dev:dev@rabbitmq:5672/
      REDIS_URL: redis://redis:6379/0
      GENESYS_API_BASE_URL: http://mock-genesys:8080
      LOG_LEVEL: DEBUG
    depends_on:
      - rabbitmq
      - redis
```

---

## Common Pitfalls & Anti-Patterns

### 14.1 Pitfalls to Avoid

**1. Storing State**:
```python
# ❌ BAD: Storing state
class Transformer:
    def __init__(self):
        self.processed_ids = set()  # State!
    
    def process(self, message):
        if message["id"] in self.processed_ids:
            return
        self.processed_ids.add(message["id"])
        # ...

# ✅ GOOD: Stateless with external cache
def process(message, cache):
    key = get_idempotency_key(message)
    if cache.is_duplicate(key):
        return
    # ...
```

**2. Silent Failures**:
```python
# ❌ BAD: Swallowing exceptions
try:
    dispatch_to_genesys(message)
except:
    pass  # Message lost!

# ✅ GOOD: Explicit handling
try:
    dispatch_to_genesys(message)
except RetryableError as e:
    log_error("Dispatch failed, will retry", error=e)
    raise
except PermanentError as e:
    log_error("Dispatch failed permanently", error=e)
    route_to_dlq(message, str(e))
```

**3. Missing Idempotency**:
```python
# ❌ BAD: No deduplication
def process(message):
    transformed = transform(message)
    dispatch(transformed)
    ack(message)

# ✅ GOOD: Idempotent processing
def process(message):
    if is_duplicate(message):
        ack(message)
        return
    
    transformed = transform(message)
    dispatch(transformed)
    ack(message)
```

**4. Hardcoded Values**:
```python
# ❌ BAD: Hardcoded configuration
GENESYS_URL = "http://10.0.1.5:8080"
INTEGRATION_ID = "integration-123"

# ✅ GOOD: Environment-based config
config = {
    "GENESYS_API_BASE_URL": os.getenv("GENESYS_API_BASE_URL"),
    "INTEGRATION_ID": os.getenv("GENESYS_INTEGRATION_ID")
}
```

**5. Unbounded Retries**:
```python
# ❌ BAD: Infinite retries
while True:
    try:
        dispatch(message)
        break
    except:
        time.sleep(1)
        # Retry forever!

# ✅ GOOD: Limited retries with backoff
for attempt in range(MAX_ATTEMPTS):
    try:
        dispatch(message)
        return
    except:
        if attempt < MAX_ATTEMPTS - 1:
            time.sleep(backoff(attempt))
        else:
            route_to_dlq(message)
```

**6. Logging Secrets**:
```python
# ❌ BAD: Logging sensitive data
log.info(f"Dispatching with token: {config['SERVICE_TOKEN']}")
log.debug(f"User phone: {message['waId']}")

# ✅ GOOD: Sanitized logging
log.info("Dispatching to Genesys API")
log.debug(f"User: {mask_phone(message['waId'])}")
```

**7. Blocking Operations**:
```python
# ❌ BAD: Blocking the consumer
def process(message):
    result = blocking_http_call()  # Blocks other messages
    time.sleep(10)  # Blocks other messages
    return result

# ✅ GOOD: Async or concurrent processing
async def process(message):
    result = await async_http_call()
    return result
```

**8. Missing Monitoring**:
```python
# ❌ BAD: No observability
def process(message):
    transformed = transform(message)
    dispatch(transformed)

# ✅ GOOD: Metrics and logging
def process(message):
    start = time.time()
    
    try:
        transformed = transform(message)
        dispatch(transformed)
        metrics.increment("messages_processed")
        log.info("Message processed", correlation_id=message["id"])
    except Exception as e:
        metrics.increment("processing_errors")
        log.error("Processing failed", error=e)
        raise
    finally:
        metrics.observe("processing_latency", time.time() - start)
```

### 14.2 Architecture Anti-Patterns

**1. Coupling to Upstream**:
```python
# ❌ BAD: Tight coupling
def process(message):
    # Assuming upstream structure
    user_name = message["user"]["profile"]["name"]["first"]

# ✅ GOOD: Defensive programming
def process(message):
    contact_name = message.get("contactName")
    first_name = extract_first_name(contact_name) if contact_name else None
```

**2. Business Logic in Transformer**:
```python
# ❌ BAD: Adding business rules
def transform(message):
    # Don't add logic like:
    if message["priority"] == "high":
        # Route differently
        pass
    
    # Or:
    if is_business_hours():
        # Do something different
        pass

# ✅ GOOD: Pure transformation
def transform(message):
    # Just transform structure
    return {
        "id": message["internalId"],
        "text": message["payload"]["body"]
    }
```

**3. Synchronous Chaining**:
```python
# ❌ BAD: Chaining multiple sync calls
def process(message):
    user = fetch_user_profile(message["waId"])
    preferences = fetch_preferences(user["id"])
    history = fetch_history(user["id"])
    # Long synchronous chain

# ✅ GOOD: Simple transformation
def process(message):
    # Use data already in message
    transformed = transform(message)
    dispatch(transformed)
```

---

## Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| **State Manager** | Upstream service that enriches WhatsApp payloads with conversation context |
| **Genesys API Service** | Internal abstraction layer over Genesys Cloud API |
| **Open Messaging** | Genesys messaging protocol specification |
| **WAMID** | WhatsApp Message ID - unique identifier from WhatsApp |
| **waId** | WhatsApp ID - typically the user's phone number in E.164 format |
| **Idempotency** | Property that ensures repeated operations have same effect as single operation |
| **Dead Letter Queue** | Queue for messages that cannot be processed after max retries |
| **Circuit Breaker** | Pattern to prevent cascading failures by stopping requests to failing service |
| **Exponential Backoff** | Retry strategy where delay increases exponentially with each attempt |

### B. Related Documents

- System Design Document
- Genesys Open Messaging Specification
- WhatsApp Business API Documentation
- State Manager Service Documentation
- Genesys API Service Documentation

### C. Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2023-10-01 | Initial version |
| 1.1 | 2023-11-01 | Added circuit breaker pattern |
| 1.2 | 2023-12-01 | Enhanced security requirements, added status event transformation |

### D. Quick Reference

**Key Endpoints**:
```
POST /genesys/messages/inbound  - Send inbound message
POST /genesys/events/inbound    - Send receipt event
GET  /health/live               - Liveness check
GET  /health/ready              - Readiness check
GET  /metrics                   - Prometheus metrics
```

**Environment Variables** (minimum):
```bash
RABBITMQ_URL=amqp://...
REDIS_URL=redis://...
GENESYS_API_BASE_URL=http://...
GENESYS_INTEGRATION_ID=uuid
SERVICE_TOKEN=secret
```

**Key Metrics**:
```
messages_processed_total        - Success count
messages_dlq_total             - Failure count
processing_latency_seconds     - Performance
genesys_dispatch_failures_total - Downstream health
```

---

## Summary

This document provides comprehensive requirements for implementing the Inbound Transformer Service. Key principles:

1. **Stateless Design**: No persistent storage, horizontally scalable
2. **Idempotent Processing**: Safe to retry, deduplication built-in
3. **Deterministic Transformation**: Pure functions, no business logic
4. **Resilient Dispatch**: Retries, circuit breakers, DLQ handling
5. **Observable**: Metrics, logs, traces for debugging
6. **Secure**: Input validation, URL safety, no secret logging

The service must be **predictable and boring** - no surprises, no magic. It transforms messages reliably, handles failures gracefully, and provides visibility into its operations.

For implementation, follow the patterns in this document closely. The architecture has been battle-tested and accounts for real-world failure modes. Deviating from these patterns will likely result in production issues.