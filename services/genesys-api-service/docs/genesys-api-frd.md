# Genesys API Service - Comprehensive Requirements Document

**Version:** 1.1 (Enhanced MVP)  
**Service Name:** `genesys-api-service`  
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
7. [Authentication & Authorization](#authentication--authorization)
8. [Rate Limiting & Throttling](#rate-limiting--throttling)
9. [Error Handling & Resilience](#error-handling--resilience)
10. [Non-Functional Requirements](#non-functional-requirements)
11. [Security Requirements](#security-requirements)
12. [Observability & Monitoring](#observability--monitoring)
13. [Testing Requirements](#testing-requirements)
14. [Deployment & Operations](#deployment--operations)
15. [Implementation Guidelines](#implementation-guidelines)
16. [Common Pitfalls & Anti-Patterns](#common-pitfalls--anti-patterns)

---

## Service Overview

### Purpose
The **Genesys API Service** is a stateless, queue-driven, multi-tenant gateway that delivers enriched WhatsApp inbound messages to Genesys Cloud using the Open Messaging Inbound API. It acts as the critical bridge between internal middleware and the Genesys ecosystem.

### Key Characteristics
- **Stateless**: No persistent storage, horizontally scalable
- **Queue-Driven**: Consumes from RabbitMQ, publishes correlation events
- **Multi-Tenant**: Strict tenant isolation with per-tenant configuration
- **OAuth-Authenticated**: Secure token management with caching
- **Rate-Limit Compliant**: Respects Genesys API throttling limits
- **Resilient**: Retry logic, circuit breakers, graceful degradation

### What This Service DOES
✅ Consume enriched messages from RabbitMQ  
✅ Retrieve and cache OAuth tokens per tenant  
✅ Deliver messages to Genesys Cloud Open Messaging API  
✅ Handle region-specific endpoints dynamically  
✅ Capture conversation IDs and publish correlation events  
✅ Implement rate limiting per tenant and globally  
✅ Handle retries with exponential backoff  
✅ Route failures to dead-letter queue  
✅ Emit metrics and structured logs  

### What This Service DOES NOT DO
❌ Message transformation (handled by Inbound Transformer)  
❌ Identity resolution (handled by State Manager)  
❌ Token generation (handled by Auth Service)  
❌ State storage (stateless by design)  
❌ Direct WhatsApp API interaction  
❌ Business logic or routing decisions  
❌ Agent assignment or routing  

---

## Architecture Context

### Position in Data Flow

```
[Inbound Transformer Service]
        ↓
    RabbitMQ Queue: genesys.outbound.ready
        ↓
[Genesys API Service]  ← THIS SERVICE
        ↓
Genesys Cloud Open Messaging API
        ↓
    Genesys Agent Desktop

Correlation Flow:
[Genesys API Service]
        ↓
    RabbitMQ Queue: correlation-events
        ↓
    [State Manager Service]
```

### Upstream Dependencies
- **Inbound Transformer Service**: Produces Genesys-formatted messages
- **RabbitMQ**: Message broker providing `genesys.outbound.ready` queue
- **Auth Service**: Provides OAuth tokens for Genesys API
- **Redis**: Token cache and deduplication

### Downstream Dependencies
- **Genesys Cloud API**: External delivery endpoint (region-specific)
- **State Manager Service**: Consumes correlation events

### Service Boundaries
- **Input Boundary**: RabbitMQ consumer on `genesys.outbound.ready`
- **Output Boundary**: HTTPS client to Genesys Cloud + RabbitMQ publisher
- **No Direct Database**: All state via Redis cache

---

## Core Responsibilities

### 1. Message Consumption (REQ-IN-07)

**Trigger**: Message arrives in `genesys.outbound.ready` queue

**Steps**:
1. Deserialize JSON payload
2. Validate schema and required fields
3. Extract tenant ID
4. Retrieve tenant configuration
5. Check for duplicates (idempotency)
6. Proceed to authentication and delivery

**Validation Rules**:
- `metadata.tenantId` must be present (UUID format)
- `genesysPayload.id` must be present (UUID format)
- `genesysPayload.direction` must be "Inbound"
- `genesysPayload` must be valid JSON object

**Tenant Configuration Required**:
- OAuth client ID
- OAuth client secret
- Genesys region (e.g., "usw2.pure.cloud")
- Rate limit settings
- Retry configuration

### 2. Authentication (REQ-AUTH-02)

**Token Retrieval**:
- Call Auth Service `POST /api/v1/token`
- Payload: `{"tenantId": "...", "type": "genesys"}`
- Auth Service handles OAuth exchange, caching, and refresh.

**Cache Key Structure**:
```
genesys:token:{tenantId}
```

**Token Metadata**:
- Access token value
- Expiry timestamp
- Token type (Bearer)
- Scope

### 3. Message Delivery (REQ-IN-08)

**HTTP Request**:
- Method: POST
- URL: `https://api.{region}.genesys.cloud/api/v2/conversations/messages/inbound/open`
- Headers: Authorization (Bearer token), Content-Type
- Body: Genesys payload from message
- Timeout: 5 seconds (configurable)

**Response Handling**:
- 200-299: Success, extract conversation ID
- 400-499: Client errors, specific handling per code
- 500-599: Server errors, retry with backoff
- Timeout: Retry with backoff

### 4. Conversation Correlation (REQ-STATE-04)

**On Success**:
- Extract conversation ID from Genesys response
- Extract communication ID from response
- Publish correlation event to `correlation-events` queue
- Enable State Manager to update mapping

**Correlation Event Purpose**:
- Link WhatsApp message ID to Genesys conversation
- Enable bi-directional message routing
- Support conversation continuity

### 5. Rate Limiting & Throttling

**Genesys Limits**:
- Typical: ~300 requests/minute per OAuth client
- Varies by Genesys edition and configuration
- 429 responses indicate limit exceeded

**Implementation Requirements**:
- Per-tenant rate limiting (token bucket)
- Global rate limiting (prevent single tenant saturation)
- Respect Retry-After headers
- Queue pausing when throttled
- Fair scheduling across tenants

### 6. Idempotency & Deduplication

**Duplicate Prevention**:
- Store processed WhatsApp message IDs
- Use Redis with TTL (24 hours recommended)
- Reject duplicates before API call
- Prevent duplicate conversation creation in Genesys

**Deduplication Key**:
```
genesys:dedupe:{tenantId}:{whatsapp_message_id}
```

---

## Technology Stack & Dependencies

### Required Components

| Component | Purpose | Version/Type | Configuration |
|-----------|---------|--------------|---------------|
| **RabbitMQ** | Message broker | 3.11+ | Queue: `genesys.outbound.ready`, Exchange: `inbound`, Correlation Queue: `correlation-events` |
| **Auth Service** | OAuth token provider | Internal | Endpoint: `POST /api/v1/token` |
| **Redis** | Token cache & deduplication | 6.0+ | TTL support, Namespaces: `genesys:token:*`, `genesys:dedupe:*` |
| **Genesys Cloud API** | External delivery | Open Messaging API | Region-specific endpoints |
| **Prometheus** | Metrics | 2.x | Scrape endpoint: `/metrics` |
| **Logging System** | Log aggregation | - | Format: JSON, Level: INFO minimum |

### Language & Runtime Recommendations
- **Node.js** (20+): Good async I/O, OAuth libraries
- **Go**: High performance, excellent concurrency
- **Python** (3.9+): Rapid development, requests library
- **Java/Kotlin** (11+): Enterprise-grade, Spring Boot ecosystem

### Key Libraries Needed
- **AMQP Client**: RabbitMQ connection
- **HTTP Client**: Genesys API calls (with timeout, retry)
- **OAuth Client**: Token retrieval
- **Redis Client**: Caching and deduplication
- **JSON Parser**: Payload processing
- **Logging**: Structured JSON output
- **Metrics**: Prometheus client
- **Rate Limiter**: Token bucket implementation
- **UUID Validation**: Tenant and message ID validation

---

## Data Contracts

### 5.1 Input Schema - Enriched Message from Inbound Transformer

**Source**: Inbound Transformer via RabbitMQ `genesys.outbound.ready` queue

```json
{
  "metadata": {
    "tenantId": "uuid-tenant-1111-2222-3333",
    "whatsapp_message_id": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
    "timestamp": "2023-11-15T03:33:20.000Z",
    "retryCount": 0,
    "correlationId": "uuid-1234-5678-9abc-def0"
  },
  "genesysPayload": {
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
}
```

**Field Specifications**:

#### Metadata Section

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `tenantId` | string | Yes | UUID v4 format | Organization identifier |
| `whatsapp_message_id` | string | Yes | Starts with `wamid.` | WhatsApp message ID for deduplication |
| `timestamp` | string | Yes | ISO 8601 UTC | Message processing timestamp |
| `retryCount` | integer | No | Default: 0 | Number of retry attempts |
| `correlationId` | string | Yes | UUID v4 format | Request tracing ID |

#### Genesys Payload Section

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | string | Yes | UUID v4 format | Message identifier |
| `channel` | object | Yes | Valid structure | Channel information |
| `type` | string | Yes | "Text" or "Receipt" | Message type |
| `text` | string | Conditional | Required for Text type | Message content |
| `direction` | string | Yes | Must be "Inbound" | Message direction |

**Validation Rules**:
1. `metadata.tenantId` must be valid UUID
2. `genesysPayload.id` must be valid UUID
3. `genesysPayload.direction` must be exactly "Inbound"
4. `genesysPayload` must be a non-empty object
5. If `genesysPayload.type` is "Text", `text` field must be present

**Validation Pseudo-code**:
```python
def validate_input_payload(payload):
    """
    Validate input message structure
    
    Raises:
        ValidationError: If validation fails
    """
    # Check metadata section
    if "metadata" not in payload:
        raise ValidationError("Missing metadata section")
    
    metadata = payload["metadata"]
    
    if "tenantId" not in metadata:
        raise ValidationError("Missing metadata.tenantId")
    
    if not is_uuid(metadata["tenantId"]):
        raise ValidationError("metadata.tenantId must be valid UUID")
    
    if "whatsapp_message_id" not in metadata:
        raise ValidationError("Missing metadata.whatsapp_message_id")
    
    # Check genesysPayload section
    if "genesysPayload" not in payload:
        raise ValidationError("Missing genesysPayload section")
    
    genesys_payload = payload["genesysPayload"]
    
    if "id" not in genesys_payload:
        raise ValidationError("Missing genesysPayload.id")
    
    if not is_uuid(genesys_payload["id"]):
        raise ValidationError("genesysPayload.id must be valid UUID")
    
    if "direction" not in genesys_payload:
        raise ValidationError("Missing genesysPayload.direction")
    
    if genesys_payload["direction"] != "Inbound":
        raise ValidationError(f"Invalid direction: {genesys_payload['direction']}")
    
    if genesys_payload.get("type") == "Text" and "text" not in genesys_payload:
        raise ValidationError("Text type requires text field")
    
    return True
```

### 5.2 Tenant Configuration Schema

**Source**: Configuration service or environment variables

```json
{
  "tenantId": "uuid-tenant-1111-2222-3333",
  "genesys": {
    "region": "usw2.pure.cloud",
    "oauthClientId": "client-id-from-genesys",
    "oauthClientSecret": "secret-from-genesys",
    "integrationId": "integration-uuid-from-genesys",
    "rateLimits": {
      "requestsPerMinute": 300,
      "burstSize": 50
    },
    "retry": {
      "maxAttempts": 5,
      "baseDelayMs": 1000,
      "maxDelayMs": 32000
    },
    "timeout": {
      "connectMs": 5000,
      "readMs": 10000
    }
  }
}
```

**Field Specifications**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | string | Yes | Tenant identifier |
| `genesys.region` | string | Yes | Genesys Cloud region (e.g., "usw2.pure.cloud") |
| `genesys.oauthClientId` | string | Yes | OAuth client ID from Genesys |
| `genesys.oauthClientSecret` | string | Yes | OAuth client secret (stored securely) |
| `genesys.integrationId` | string | Yes | Open Messaging integration ID |
| `genesys.rateLimits.requestsPerMinute` | integer | No | Rate limit (default: 300) |
| `genesys.rateLimits.burstSize` | integer | No | Burst capacity (default: 50) |
| `genesys.retry.maxAttempts` | integer | No | Max retry attempts (default: 5) |
| `genesys.retry.baseDelayMs` | integer | No | Base retry delay (default: 1000) |
| `genesys.retry.maxDelayMs` | integer | No | Max retry delay (default: 32000) |

**Region Format**:
- Format: `{region}.{environment}.cloud`
- Examples: 
  - US West: `usw2.pure.cloud`
  - US East: `use2.us-gov-pure.cloud`
  - Europe: `euw2.pure.cloud`
  - Australia: `apse2.pure.cloud`

**Configuration Loading**:
```python
def load_tenant_config(tenant_id, config_source):
    """
    Load tenant configuration
    
    Args:
        tenant_id: Tenant identifier
        config_source: Configuration provider (DB, file, env)
    
    Returns:
        TenantConfig object
        
    Raises:
        ConfigurationError: If config not found or invalid
    """
    config = config_source.get(tenant_id)
    
    if not config:
        raise ConfigurationError(f"No configuration for tenant: {tenant_id}")
    
    # Validate required fields
    required_fields = [
        "genesys.region",
        "genesys.oauthClientId",
        "genesys.oauthClientSecret",
        "genesys.integrationId"
    ]
    
    for field in required_fields:
        if not get_nested(config, field):
            raise ConfigurationError(f"Missing required field: {field}")
    
    return config
```

### 5.3 Output Request - Genesys API Call

**Destination**: Genesys Cloud Open Messaging Inbound API

**Request Format**:
```
POST https://api.{region}.genesys.cloud/api/v2/conversations/messages/inbound/open
Authorization: Bearer {accessToken}
Content-Type: application/json

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

**Request Construction**:
```python
def construct_genesys_request(message, tenant_config, access_token):
    """
    Build HTTP request for Genesys API
    
    Args:
        message: Input message from queue
        tenant_config: Tenant configuration
        access_token: OAuth token
        
    Returns:
        dict with url, headers, body, timeout
    """
    region = tenant_config["genesys"]["region"]
    url = f"https://api.{region}.genesys.cloud/api/v2/conversations/messages/inbound/open"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Correlation-ID": message["metadata"]["correlationId"]
    }
    
    body = message["genesysPayload"]
    
    timeout = {
        "connect": tenant_config["genesys"]["timeout"]["connectMs"] / 1000,
        "read": tenant_config["genesys"]["timeout"]["readMs"] / 1000
    }
    
    return {
        "url": url,
        "headers": headers,
        "body": body,
        "timeout": timeout
    }
```

### 5.4 Genesys API Response Schema

**Success Response (200 OK)**:
```json
{
  "id": "conversation-uuid-7890-abcd-ef12",
  "communicationId": "communication-uuid-3456-7890-abcd",
  "startTime": "2023-11-15T03:33:21.234Z",
  "participants": [
    {
      "id": "participant-uuid",
      "purpose": "customer"
    }
  ]
}
```

**Field Specifications**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Genesys conversation ID (UUID) |
| `communicationId` | string | Communication session ID (UUID) |
| `startTime` | string | Conversation start timestamp (ISO 8601) |
| `participants` | array | Participant information (optional) |

**Error Response (4xx/5xx)**:
```json
{
  "message": "Error description",
  "code": "ERROR_CODE",
  "status": 400,
  "contextId": "context-uuid",
  "details": []
}
```

**Response Parsing**:
```python
def parse_genesys_response(response):
    """
    Parse Genesys API response
    
    Args:
        response: HTTP response object
        
    Returns:
        Parsed response data
        
    Raises:
        GenesysAPIError: If response indicates error
    """
    if 200 <= response.status_code < 300:
        data = response.json()
        
        if "id" not in data:
            raise GenesysAPIError("Missing conversation ID in response")
        
        return {
            "conversation_id": data["id"],
            "communication_id": data.get("communicationId"),
            "start_time": data.get("startTime")
        }
    
    else:
        # Error response
        try:
            error_data = response.json()
            error_message = error_data.get("message", "Unknown error")
            error_code = error_data.get("code", "UNKNOWN")
        except:
            error_message = response.text
            error_code = "PARSE_ERROR"
        
        raise GenesysAPIError(
            f"API error: {error_message}",
            status_code=response.status_code,
            error_code=error_code
        )
```

### 5.5 Output Event - Correlation Message

**Destination**: RabbitMQ `correlation-events` queue

```json
{
  "tenantId": "uuid-tenant-1111-2222-3333",
  "conversationId": "conversation-uuid-7890-abcd-ef12",
  "communicationId": "communication-uuid-3456-7890-abcd",
  "whatsapp_message_id": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
  "status": "created",
  "timestamp": "2023-11-15T03:33:21.234Z",
  "correlationId": "uuid-1234-5678-9abc-def0"
}
```

**Field Specifications**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | string | Yes | Tenant identifier |
| `conversationId` | string | Yes | Genesys conversation ID |
| `communicationId` | string | Yes | Genesys communication ID |
| `whatsapp_message_id` | string | Yes | Original WhatsApp message ID |
| `status` | string | Yes | "created" (future: "updated", "closed") |
| `timestamp` | string | Yes | Event timestamp (ISO 8601) |
| `correlationId` | string | Yes | Original correlation ID |

**Event Publishing**:
```python
def publish_correlation_event(message, genesys_response, rabbitmq_channel):
    """
    Publish correlation event to queue
    
    Args:
        message: Original input message
        genesys_response: Parsed Genesys response
        rabbitmq_channel: RabbitMQ channel
    """
    event = {
        "tenantId": message["metadata"]["tenantId"],
        "conversationId": genesys_response["conversation_id"],
        "communicationId": genesys_response["communication_id"],
        "whatsapp_message_id": message["metadata"]["whatsapp_message_id"],
        "status": "created",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "correlationId": message["metadata"]["correlationId"]
    }
    
    rabbitmq_channel.basic_publish(
        exchange="correlation",
        routing_key="correlation.created",
        body=json.dumps(event),
        properties=pika.BasicProperties(
            delivery_mode=2,  # Persistent
            content_type="application/json",
            correlation_id=event["correlationId"]
        )
    )
    
    log_info(
        "Correlation event published",
        tenant_id=event["tenantId"],
        conversation_id=event["conversationId"],
        correlation_id=event["correlationId"]
    )
    
    metrics.increment("correlation_events_published_total", {
        "tenant_id": event["tenantId"]
    })
```

---

## Functional Requirements

### 6.1 Message Consumption Flow (REQ-IN-07)

**Requirement**: Consume and validate messages from RabbitMQ

**Implementation Steps**:

1. **Connect to RabbitMQ**
   ```python
   connection = pika.BlockingConnection(
       pika.ConnectionParameters(
           host=config["RABBITMQ_HOST"],
           credentials=pika.PlainCredentials(
               config["RABBITMQ_USER"],
               config["RABBITMQ_PASSWORD"]
           ),
           heartbeat=30
       )
   )
   
   channel = connection.channel()
   channel.basic_qos(prefetch_count=10)  # Limit in-flight messages
   ```

2. **Consume Messages**
   ```python
   def consume_messages():
       """Main message consumption loop"""
       channel.basic_consume(
           queue="genesys.outbound.ready",
           on_message_callback=handle_message,
           auto_ack=False  # Manual acknowledgment
       )
       
       log_info("Starting message consumption")
       channel.start_consuming()
   ```

3. **Message Handler**
   ```python
   def handle_message(channel, method, properties, body):
       """
       Process individual message
       
       Args:
           channel: RabbitMQ channel
           method: Delivery method
           properties: Message properties
           body: Message body (bytes)
       """
       start_time = time.time()
       
       try:
           # 1. Deserialize
           payload = json.loads(body)
           
           # 2. Validate
           validate_input_payload(payload)
           
           # 3. Extract tenant ID
           tenant_id = payload["metadata"]["tenantId"]
           
           # 4. Load tenant config
           tenant_config = load_tenant_config(tenant_id)
           
           # 5. Check idempotency
           if is_duplicate(payload, tenant_config):
               log_info("Duplicate message detected", 
                       whatsapp_message_id=payload["metadata"]["whatsapp_message_id"])
               channel.basic_ack(delivery_tag=method.delivery_tag)
               return
           
           # 6. Process message
           success = process_message(payload, tenant_config)
           
           if success:
               # ACK message
               channel.basic_ack(delivery_tag=method.delivery_tag)
               metrics.increment("messages_processed_total", {"tenant_id": tenant_id})
           else:
               # NACK for retry
               channel.basic_nack(
                   delivery_tag=method.delivery_tag,
                   requeue=True
               )
               metrics.increment("messages_retried_total", {"tenant_id": tenant_id})
           
       except ValidationError as e:
           # Invalid message - send to DLQ
           log_error("Validation failed", error=str(e), body=body)
           route_to_dlq(body, f"Validation error: {e}")
           channel.basic_ack(delivery_tag=method.delivery_tag)
           metrics.increment("validation_failures_total")
       
       except ConfigurationError as e:
           # Unknown tenant - send to DLQ + alert
           log_error("Configuration error", error=str(e))
           route_to_dlq(body, f"Config error: {e}")
           channel.basic_ack(delivery_tag=method.delivery_tag)
           alert("Unknown tenant", tenant_id=payload.get("metadata", {}).get("tenantId"))
           metrics.increment("config_errors_total")
       
       except Exception as e:
           # Unexpected error - retry
           log_error("Unexpected error processing message", error=str(e), traceback=traceback.format_exc())
           channel.basic_nack(
               delivery_tag=method.delivery_tag,
               requeue=True
           )
           metrics.increment("unexpected_errors_total")
       
       finally:
           latency = time.time() - start_time
           metrics.observe("message_processing_duration_seconds", latency, {"tenant_id": tenant_id})
   ```

**Error Scenarios**:

| Error Type | Action | Rationale |
|------------|--------|-----------|
| Invalid JSON | Route to DLQ + ACK | Cannot process, permanent failure |
| Missing required field | Route to DLQ + ACK | Invalid input, permanent failure |
| Unknown tenant | Route to DLQ + ACK + Alert | Configuration issue, needs investigation |
| Duplicate message | ACK silently | Already processed |
| Genesys 4xx error | Route to DLQ + ACK | Client error, won't succeed on retry |
| Genesys 5xx error | NACK (requeue) | Temporary failure, retry |
| Timeout | NACK (requeue) | Network issue, retry |
| Max retries exceeded | Route to DLQ + ACK | Persistent failure |

### 6.2 Idempotency Check

**Requirement**: Prevent duplicate message processing

**Implementation**:
```python
def is_duplicate(payload, tenant_config):
    """
    Check if message has already been processed
    
    Args:
        payload: Input message
        tenant_config: Tenant configuration
        
    Returns:
        True if duplicate, False if new
    """
    tenant_id = payload["metadata"]["tenantId"]
    whatsapp_message_id = payload["metadata"]["whatsapp_message_id"]
    
    # Generate deduplication key
    dedupe_key = f"genesys:dedupe:{tenant_id}:{whatsapp_message_id}"
    
    # Check Redis
    try:
        # SET if not exists, with TTL
        ttl = 86400  # 24 hours
        result = redis_client.set(dedupe_key, "1", ex=ttl, nx=True)
        
        # nx=True returns None if key already existed
        if result is None:
            return True  # Duplicate
        else:
            return False  # New
    
    except RedisError as e:
        log_warning("Redis error in deduplication check", error=str(e))
        # Fail open - allow processing
        # Better to process duplicate than lose message
        return False
```

**Deduplication Cache**:
- **Key Format**: `genesys:dedupe:{tenantId}:{whatsapp_message_id}`
- **Value**: Simple flag "1"
- **TTL**: 24 hours (configurable)
- **Failure Mode**: Fail open (process message if Redis unavailable)

### 6.3 Main Processing Logic

**Requirement**: Orchestrate authentication, delivery, and correlation

**Implementation**:
```python
def process_message(payload, tenant_config):
    """
    Main message processing logic
    
    Args:
        payload: Input message
        tenant_config: Tenant configuration
        
    Returns:
        True if successful, False if retry needed
    """
    tenant_id = payload["metadata"]["tenantId"]
    correlation_id = payload["metadata"]["correlationId"]
    
    # Set correlation context for logging
    set_correlation_context(correlation_id, tenant_id)
    
    try:
        # Step 1: Get OAuth token
        access_token = get_access_token(tenant_id, tenant_config)
        
        # Step 2: Check rate limit
        if not check_rate_limit(tenant_id, tenant_config):
            log_warning("Rate limit exceeded, will retry later")
            return False  # Retry later
        
        # Step 3: Send to Genesys
        genesys_response = send_to_genesys(
            payload,
            tenant_config,
            access_token
        )
        
        # Step 4: Publish correlation event
        publish_correlation_event(payload, genesys_response)
        
        log_info("Message processed successfully",
                conversation_id=genesys_response["conversation_id"])
        
        return True
    
    except TokenRetrievalError as e:
        log_error("Failed to get access token", error=str(e))
        # Retry - token service may be temporarily down
        return False
    
    except GenesysAPIError as e:
        if e.status_code == 401:
            # Invalid token - invalidate cache and retry
            log_warning("Token invalid, invalidating cache")
            invalidate_token_cache(tenant_id)
            return False
        
        elif e.status_code == 429:
            # Rate limited - back off
            log_warning("Rate limited by Genesys API")
            apply_rate_limit_backoff(tenant_id, e.retry_after)
            return False
        
        elif 400 <= e.status_code < 500:
            # Client error - permanent failure
            log_error("Genesys API client error", status=e.status_code, error=str(e))
            route_to_dlq(payload, f"Genesys API error: {e}")
            return True  # Don't retry
        
        elif 500 <= e.status_code < 600:
            # Server error - retry
            log_error("Genesys API server error", status=e.status_code, error=str(e))
            return False
        
        else:
            # Unknown error - retry
            log_error("Unexpected Genesys API error", status=e.status_code, error=str(e))
            return False
    
    except TimeoutError as e:
        log_warning("Genesys API timeout", error=str(e))
        return False  # Retry
    
    except Exception as e:
        log_error("Unexpected error in processing", error=str(e))
        return False  # Retry
```

---

## Authentication & Authorization

### 7.1 OAuth Token Management (REQ-AUTH-02)

**OAuth Flow**: Client Credentials Grant

**Token Lifecycle**:
1. Check cache for valid token
2. If not found/expired, request new token from Auth Service
3. Cache token with TTL
4. Use token for Genesys API calls
5. Invalidate on 401 errors
6. Refresh before expiration

**Implementation**:

```python
def get_access_token(tenant_id, tenant_config):
    """
    Get valid OAuth access token for tenant
    
    Args:
        tenant_id: Tenant identifier
        tenant_config: Tenant configuration
        
    Returns:
        Access token string
        
    Raises:
        TokenRetrievalError: If token cannot be obtained
    """
    # Check cache first
    cache_key = f"genesys:token:{tenant_id}"
    
    try:
        cached_token = redis_client.get(cache_key)
        
        if cached_token:
            token_data = json.loads(cached_token)
            
            # Check if token is still valid (with 5 min buffer)
            expiry = token_data["expiry"]
            if time.time() < expiry - 300:  # 5 min buffer
                log_debug("Using cached token", tenant_id=tenant_id)
                metrics.increment("token_cache_hits_total", {"tenant_id": tenant_id})
                return token_data["access_token"]
            else:
                log_debug("Cached token expired", tenant_id=tenant_id)
    
    except RedisError as e:
        log_warning("Redis error fetching cached token", error=str(e))
        # Continue to fetch new token
    
    # Fetch new token
    log_info("Fetching new OAuth token", tenant_id=tenant_id)
    metrics.increment("token_cache_misses_total", {"tenant_id": tenant_id})
    
    token_data = fetch_token_from_auth_service(tenant_id, tenant_config)
    
    # Cache token
    try:
        ttl = token_data["expires_in"] - 300  # Cache for slightly less than expiry
        redis_client.setex(
            cache_key,
            ttl,
            json.dumps(token_data)
        )
        log_debug("Token cached", tenant_id=tenant_id, ttl=ttl)
    except RedisError as e:
        log_warning("Failed to cache token", error=str(e))
        # Continue - token is still valid
    
    return token_data["access_token"]


def fetch_token_from_auth_service(tenant_id, tenant_config):
    """
    Request OAuth token from Auth Service
    
    Args:
        tenant_id: Tenant identifier
        tenant_config: Tenant configuration
        
    Returns:
        Token data dict with access_token, expires_in, expiry
        
    Raises:
        TokenRetrievalError: If request fails
    """
    auth_service_url = config["AUTH_SERVICE_URL"]
    
    request_data = {
        "grant_type": "client_credentials",
        "client_id": tenant_config["genesys"]["oauthClientId"],
        "client_secret": tenant_config["genesys"]["oauthClientSecret"]
    }
    
    try:
        response = requests.post(
            f"{auth_service_url}/api/v1/token",
            json=request_data,
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Calculate absolute expiry time
            expires_in = data.get("expires_in", 3600)  # Default 1 hour
            expiry = time.time() + expires_in
            
            token_data = {
                "access_token": data["access_token"],
                "token_type": data.get("token_type", "Bearer"),
                "expires_in": expires_in,
                "expiry": expiry
            }
            
            log_info("OAuth token obtained", tenant_id=tenant_id, expires_in=expires_in)
            metrics.increment("tokens_obtained_total", {"tenant_id": tenant_id})
            
            return token_data
        
        else:
            error_msg = f"Auth service returned {response.status_code}"
            log_error("Token fetch failed", tenant_id=tenant_id, error=error_msg)
            metrics.increment("token_fetch_failures_total", {"tenant_id": tenant_id})
            raise TokenRetrievalError(error_msg)
    
    except RequestException as e:
        log_error("Auth service request failed", error=str(e))
        metrics.increment("token_fetch_failures_total", {"tenant_id": tenant_id})
        raise TokenRetrievalError(f"Request failed: {e}")


def invalidate_token_cache(tenant_id):
    """
    Invalidate cached token (e.g., after 401 error)
    
    Args:
        tenant_id: Tenant identifier
    """
    cache_key = f"genesys:token:{tenant_id}"
    
    try:
        redis_client.delete(cache_key)
        log_info("Token cache invalidated", tenant_id=tenant_id)
        metrics.increment("tokens_invalidated_total", {"tenant_id": tenant_id})
    except RedisError as e:
        log_warning("Failed to invalidate token cache", error=str(e))
```

**Token Cache Structure**:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "expiry": 1700000000
}
```

**Cache Key**: `genesys:token:{tenantId}`  
**TTL**: `expires_in - 300` seconds (5 minute buffer)  
**Invalidation**: On 401 errors from Genesys API

---

## Rate Limiting & Throttling

### 8.1 Multi-Level Rate Limiting

**Rate Limit Levels**:
1. **Per-Tenant**: Enforce tenant-specific limits
2. **Global**: Prevent single tenant from saturating service
3. **Genesys-Imposed**: Respect 429 responses

**Genesys API Limits**:
- Typical: ~300 requests/minute per OAuth client
- Varies by Genesys edition (CX1, CX2, CX3)
- 429 responses include `Retry-After` header

### 8.2 Token Bucket Implementation

**Algorithm**: Token Bucket (per-tenant)

**Implementation**:
```python
class TokenBucket:
    """
    Token bucket rate limiter
    
    Tokens refill at constant rate.
    Each request consumes one token.
    """
    
    def __init__(self, rate, capacity):
        """
        Args:
            rate: Tokens per second
            capacity: Maximum token capacity (burst size)
        """
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_refill = time.time()
        self.lock = threading.Lock()
    
    def consume(self, tokens=1):
        """
        Try to consume tokens
        
        Args:
            tokens: Number of tokens to consume
            
        Returns:
            True if allowed, False if rate limited
        """
        with self.lock:
            # Refill tokens
            now = time.time()
            elapsed = now - self.last_refill
            refill_amount = elapsed * self.rate
            
            self.tokens = min(self.capacity, self.tokens + refill_amount)
            self.last_refill = now
            
            # Check if we have enough tokens
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            else:
                return False


class RateLimiter:
    """
    Per-tenant rate limiter using token buckets
    """
    
    def __init__(self):
        self.buckets = {}  # tenant_id -> TokenBucket
        self.lock = threading.Lock()
    
    def check_limit(self, tenant_id, tenant_config):
        """
        Check if request is allowed for tenant
        
        Args:
            tenant_id: Tenant identifier
            tenant_config: Tenant configuration
            
        Returns:
            True if allowed, False if rate limited
        """
        # Get or create bucket for tenant
        with self.lock:
            if tenant_id not in self.buckets:
                rate_limit = tenant_config["genesys"]["rateLimits"]["requestsPerMinute"]
                burst_size = tenant_config["genesys"]["rateLimits"]["burstSize"]
                
                # Convert rate to tokens per second
                tokens_per_second = rate_limit / 60.0
                
                self.buckets[tenant_id] = TokenBucket(
                    rate=tokens_per_second,
                    capacity=burst_size
                )
        
        # Try to consume token
        bucket = self.buckets[tenant_id]
        allowed = bucket.consume(tokens=1)
        
        if not allowed:
            log_warning("Rate limit exceeded", tenant_id=tenant_id)
            metrics.increment("rate_limit_exceeded_total", {"tenant_id": tenant_id})
        
        return allowed


# Global rate limiter instance
rate_limiter = RateLimiter()


def check_rate_limit(tenant_id, tenant_config):
    """
    Check rate limit for tenant
    
    Args:
        tenant_id: Tenant identifier
        tenant_config: Tenant configuration
        
    Returns:
        True if allowed, False if rate limited
    """
    return rate_limiter.check_limit(tenant_id, tenant_config)
```

### 8.3 Genesys 429 Handling

**When Genesys returns 429**:
1. Extract `Retry-After` header (seconds)
2. Apply backoff for tenant
3. NACK message for requeue
4. Temporarily block tenant requests

**Implementation**:
```python
class BackoffManager:
    """
    Manage backoff periods for rate-limited tenants
    """
    
    def __init__(self):
        self.backoffs = {}  # tenant_id -> expiry_time
        self.lock = threading.Lock()
    
    def apply_backoff(self, tenant_id, duration):
        """
        Apply backoff for tenant
        
        Args:
            tenant_id: Tenant identifier
            duration: Backoff duration in seconds
        """
        with self.lock:
            expiry = time.time() + duration
            self.backoffs[tenant_id] = expiry
            
        log_info("Backoff applied", tenant_id=tenant_id, duration=duration)
        metrics.gauge("tenant_backoff_seconds", duration, {"tenant_id": tenant_id})
    
    def is_backed_off(self, tenant_id):
        """
        Check if tenant is in backoff period
        
        Args:
            tenant_id: Tenant identifier
            
        Returns:
            True if backed off, False if ready
        """
        with self.lock:
            if tenant_id not in self.backoffs:
                return False
            
            expiry = self.backoffs[tenant_id]
            
            if time.time() < expiry:
                return True  # Still backed off
            else:
                # Backoff expired, remove
                del self.backoffs[tenant_id]
                return False


# Global backoff manager
backoff_manager = BackoffManager()


def apply_rate_limit_backoff(tenant_id, retry_after):
    """
    Apply backoff after 429 response
    
    Args:
        tenant_id: Tenant identifier
        retry_after: Retry-After value from response (seconds or HTTP date)
    """
    # Parse retry_after (can be seconds or HTTP date)
    try:
        duration = int(retry_after)
    except (ValueError, TypeError):
        # Try parsing as HTTP date
        try:
            retry_date = parsedate_to_datetime(retry_after)
            duration = (retry_date - datetime.now(timezone.utc)).total_seconds()
            duration = max(0, duration)
        except:
            # Default to 60 seconds
            duration = 60
    
    # Apply backoff with minimum 60 seconds
    duration = max(60, duration)
    
    backoff_manager.apply_backoff(tenant_id, duration)
    
    log_warning("Rate limit backoff applied",
               tenant_id=tenant_id,
               duration=duration)


def check_backoff(tenant_id):
    """
    Check if tenant is in backoff period
    
    Args:
        tenant_id: Tenant identifier
        
    Returns:
        True if ready, False if backed off
    """
    if backoff_manager.is_backed_off(tenant_id):
        log_debug("Tenant in backoff period", tenant_id=tenant_id)
        return False
    
    return True
```

### 8.4 Global Rate Limiting

**Purpose**: Prevent single tenant from consuming all resources

**Implementation**:
```python
# Global rate limiter (shared across all tenants)
global_rate_limiter = TokenBucket(
    rate=500 / 60,  # 500 requests per minute globally
    capacity=100     # 100 burst
)


def check_global_rate_limit():
    """
    Check global rate limit (across all tenants)
    
    Returns:
        True if allowed, False if globally rate limited
    """
    allowed = global_rate_limiter.consume(tokens=1)
    
    if not allowed:
        log_warning("Global rate limit exceeded")
        metrics.increment("global_rate_limit_exceeded_total")
    
    return allowed
```

**Integration in Processing**:
```python
def process_message(payload, tenant_config):
    tenant_id = payload["metadata"]["tenantId"]
    
    # Check backoff period
    if not check_backoff(tenant_id):
        log_debug("Tenant in backoff, requeueing")
        return False  # Retry later
    
    # Check global rate limit
    if not check_global_rate_limit():
        log_warning("Global rate limit hit, requeueing")
        return False  # Retry later
    
    # Check tenant rate limit
    if not check_rate_limit(tenant_id, tenant_config):
        log_warning("Tenant rate limit hit, requeueing")
        return False  # Retry later
    
    # Proceed with processing
    # ...
```

---

## Error Handling & Resilience

### 9.1 Retry Strategy

**Exponential Backoff with Jitter**:
```python
def calculate_backoff(attempt, tenant_config):
    """
    Calculate backoff delay for retry attempt
    
    Args:
        attempt: Retry attempt number (1-indexed)
        tenant_config: Tenant configuration
        
    Returns:
        Delay in seconds
    """
    base_delay = tenant_config["genesys"]["retry"]["baseDelayMs"] / 1000
    max_delay = tenant_config["genesys"]["retry"]["maxDelayMs"] / 1000
    
    # Exponential: base * 2^(attempt-1)
    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
    
    # Add jitter: ±0-1000ms
    jitter = random.uniform(0, 1.0)
    
    return delay + jitter


def send_to_genesys_with_retry(payload, tenant_config, access_token):
    """
    Send message to Genesys with retry logic
    
    Args:
        payload: Message payload
        tenant_config: Tenant configuration
        access_token: OAuth token
        
    Returns:
        Genesys response
        
    Raises:
        GenesysAPIError: If all retries exhausted
    """
    max_attempts = tenant_config["genesys"]["retry"]["maxAttempts"]
    retry_count = payload["metadata"].get("retryCount", 0)
    
    for attempt in range(1, max_attempts + 1):
        try:
            response = send_to_genesys(payload, tenant_config, access_token)
            return response
        
        except GenesysAPIError as e:
            # Check if error is retriable
            if not is_retriable_error(e):
                raise  # Don't retry
            
            if attempt < max_attempts:
                delay = calculate_backoff(attempt, tenant_config)
                log_warning(f"Genesys API error, retrying in {delay}s",
                          attempt=attempt,
                          max_attempts=max_attempts,
                          error=str(e))
                
                time.sleep(delay)
                metrics.increment("genesys_retries_total", {
                    "tenant_id": payload["metadata"]["tenantId"],
                    "attempt": attempt
                })
            else:
                # Max retries exhausted
                log_error("Max retries exhausted",
                         attempt=attempt,
                         error=str(e))
                raise
        
        except (TimeoutError, ConnectionError) as e:
            if attempt < max_attempts:
                delay = calculate_backoff(attempt, tenant_config)
                log_warning(f"Network error, retrying in {delay}s",
                          attempt=attempt,
                          error=str(e))
                
                time.sleep(delay)
            else:
                raise GenesysAPIError(f"Network error after {max_attempts} attempts: {e}")


def is_retriable_error(error):
    """
    Determine if error is retriable
    
    Args:
        error: GenesysAPIError
        
    Returns:
        True if should retry, False otherwise
    """
    if not isinstance(error, GenesysAPIError):
        return True  # Unexpected errors are retriable
    
    status_code = error.status_code
    
    # Retriable: 5xx, 408, 429
    if 500 <= status_code < 600:
        return True
    
    if status_code == 408:  # Request Timeout
        return True
    
    if status_code == 429:  # Rate Limited
        return True
    
    if status_code == 401:  # Unauthorized (token might be refreshed)
        return True
    
    # Non-retriable: 4xx (except above)
    return False
```

### 9.2 Circuit Breaker Pattern

**Purpose**: Prevent cascading failures when Genesys is down

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
    
    def __init__(self, failure_threshold=10, timeout=60):
        """
        Args:
            failure_threshold: Consecutive failures before opening
            timeout: Seconds before attempting recovery
        """
        self.state = "CLOSED"
        self.failure_count = 0
        self.success_count = 0
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.last_failure_time = None
        self.lock = threading.Lock()
    
    def call(self, func, *args, **kwargs):
        """
        Execute function with circuit breaker protection
        
        Args:
            func: Function to execute
            *args, **kwargs: Function arguments
            
        Returns:
            Function result
            
        Raises:
            CircuitBreakerOpenError: If circuit is open
            Original exception: If function fails
        """
        with self.lock:
            if self.state == "OPEN":
                # Check if timeout expired
                if time.time() - self.last_failure_time > self.timeout:
                    self.state = "HALF_OPEN"
                    self.success_count = 0
                    log_info("Circuit breaker entering HALF_OPEN state")
                else:
                    raise CircuitBreakerOpenError("Circuit breaker is OPEN")
        
        try:
            result = func(*args, **kwargs)
            
            # Success
            with self.lock:
                if self.state == "HALF_OPEN":
                    self.success_count += 1
                    
                    # After 3 successes, close circuit
                    if self.success_count >= 3:
                        self.state = "CLOSED"
                        self.failure_count = 0
                        log_info("Circuit breaker CLOSED (recovered)")
                
                elif self.state == "CLOSED":
                    # Reset failure count on success
                    self.failure_count = 0
            
            return result
        
        except Exception as e:
            with self.lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.state == "HALF_OPEN":
                    # Failed during recovery attempt
                    self.state = "OPEN"
                    log_error("Circuit breaker reopened after failure in HALF_OPEN")
                
                elif self.failure_count >= self.failure_threshold:
                    self.state = "OPEN"
                    log_error(f"Circuit breaker OPEN after {self.failure_count} failures")
                    metrics.increment("circuit_breaker_opened_total")
            
            raise


# Per-region circuit breakers
circuit_breakers = {}  # region -> CircuitBreaker


def get_circuit_breaker(region):
    """Get circuit breaker for region"""
    if region not in circuit_breakers:
        circuit_breakers[region] = CircuitBreaker(
            failure_threshold=10,
            timeout=60
        )
    return circuit_breakers[region]


def send_to_genesys(payload, tenant_config, access_token):
    """
    Send message to Genesys with circuit breaker protection
    
    Args:
        payload: Message payload
        tenant_config: Tenant configuration
        access_token: OAuth token
        
    Returns:
        Genesys response
    """
    region = tenant_config["genesys"]["region"]
    circuit_breaker = get_circuit_breaker(region)
    
    try:
        response = circuit_breaker.call(
            _send_to_genesys_internal,
            payload,
            tenant_config,
            access_token
        )
        return response
    
    except CircuitBreakerOpenError:
        log_error("Circuit breaker open, failing fast", region=region)
        metrics.increment("circuit_breaker_rejected_total", {"region": region})
        raise GenesysAPIError("Circuit breaker open", status_code=503)


def _send_to_genesys_internal(payload, tenant_config, access_token):
    """
    Internal implementation of Genesys API call
    """
    request = construct_genesys_request(payload, tenant_config, access_token)
    
    response = requests.post(
        request["url"],
        headers=request["headers"],
        json=request["body"],
        timeout=(request["timeout"]["connect"], request["timeout"]["read"])
    )
    
    if 200 <= response.status_code < 300:
        return parse_genesys_response(response)
    else:
        raise GenesysAPIError(
            f"API error: {response.text}",
            status_code=response.status_code
        )
```

### 9.3 HTTP Status Code Handling

**Comprehensive Error Matrix**:

| Status Code | Category | Action | Retriable |
|-------------|----------|--------|-----------|
| 200-299 | Success | Parse response, publish correlation | N/A |
| 400 | Bad Request | Log + DLQ | No |
| 401 | Unauthorized | Invalidate token + retry once | Yes (once) |
| 403 | Forbidden | Log + Alert + DLQ | No |
| 404 | Not Found | Log + DLQ | No |
| 408 | Request Timeout | Retry with backoff | Yes |
| 429 | Rate Limited | Apply backoff + retry | Yes |
| 500 | Internal Server Error | Retry with backoff | Yes |
| 502 | Bad Gateway | Retry with backoff | Yes |
| 503 | Service Unavailable | Retry with backoff | Yes |
| 504 | Gateway Timeout | Retry with backoff | Yes |
| Timeout | Network | Retry with backoff | Yes |
| Connection Error | Network | Retry with backoff | Yes |

**Implementation**:
```python
def handle_genesys_response(response, payload, tenant_config):
    """
    Handle Genesys API response
    
    Args:
        response: HTTP response
        payload: Original message
        tenant_config: Tenant configuration
        
    Returns:
        Parsed response or raises exception
    """
    status_code = response.status_code
    tenant_id = payload["metadata"]["tenantId"]
    
    if 200 <= status_code < 300:
        # Success
        log_info("Genesys API success", status_code=status_code)
        metrics.increment("genesys_success_total", {"tenant_id": tenant_id})
        return parse_genesys_response(response)
    
    elif status_code == 400:
        # Bad Request - permanent failure
        error_msg = extract_error_message(response)
        log_error("Genesys API bad request", error=error_msg)
        metrics.increment("genesys_4xx_errors_total", {
            "tenant_id": tenant_id,
            "status_code": "400"
        })
        route_to_dlq(payload, f"Bad request: {error_msg}")
        raise GenesysAPIError(error_msg, status_code=400, retriable=False)
    
    elif status_code == 401:
        # Unauthorized - invalidate token and retry
        log_warning("Genesys API unauthorized, token may be expired")
        metrics.increment("genesys_4xx_errors_total", {
            "tenant_id": tenant_id,
            "status_code": "401"
        })
        invalidate_token_cache(tenant_id)
        raise GenesysAPIError("Unauthorized", status_code=401, retriable=True)
    
    elif status_code == 403:
        # Forbidden - configuration issue
        error_msg = extract_error_message(response)
        log_error("Genesys API forbidden", error=error_msg)
        metrics.increment("genesys_4xx_errors_total", {
            "tenant_id": tenant_id,
            "status_code": "403"
        })
        alert("Genesys API forbidden error", tenant_id=tenant_id, error=error_msg)
        route_to_dlq(payload, f"Forbidden: {error_msg}")
        raise GenesysAPIError(error_msg, status_code=403, retriable=False)
    
    elif status_code == 404:
        # Not Found - configuration issue
        error_msg = extract_error_message(response)
        log_error("Genesys API not found", error=error_msg)
        metrics.increment("genesys_4xx_errors_total", {
            "tenant_id": tenant_id,
            "status_code": "404"
        })
        route_to_dlq(payload, f"Not found: {error_msg}")
        raise GenesysAPIError(error_msg, status_code=404, retriable=False)
    
    elif status_code == 408:
        # Request Timeout - retry
        log_warning("Genesys API request timeout")
        metrics.increment("genesys_4xx_errors_total", {
            "tenant_id": tenant_id,
            "status_code": "408"
        })
        raise GenesysAPIError("Request timeout", status_code=408, retriable=True)
    
    elif status_code == 429:
        # Rate Limited - apply backoff and retry
        retry_after = response.headers.get("Retry-After", "60")
        log_warning("Genesys API rate limited", retry_after=retry_after)
        metrics.increment("genesys_rate_limited_total", {"tenant_id": tenant_id})
        apply_rate_limit_backoff(tenant_id, retry_after)
        raise GenesysAPIError("Rate limited", status_code=429, retriable=True)
    
    elif 500 <= status_code < 600:
        # Server Error - retry
        error_msg = extract_error_message(response)
        log_error("Genesys API server error",
                 status_code=status_code,
                 error=error_msg)
        metrics.increment("genesys_5xx_errors_total", {
            "tenant_id": tenant_id,
            "status_code": str(status_code)
        })
        raise GenesysAPIError(error_msg, status_code=status_code, retriable=True)
    
    else:
        # Unexpected status code
        error_msg = extract_error_message(response)
        log_error("Genesys API unexpected status",
                 status_code=status_code,
                 error=error_msg)
        metrics.increment("genesys_unexpected_status_total", {
            "tenant_id": tenant_id,
            "status_code": str(status_code)
        })
        raise GenesysAPIError(error_msg, status_code=status_code, retriable=True)


def extract_error_message(response):
    """Extract error message from response"""
    try:
        data = response.json()
        return data.get("message", response.text)
    except:
        return response.text
```

### 9.4 Dead Letter Queue

**DLQ Routing**:
```python
def route_to_dlq(payload, reason):
    """
    Route message to dead letter queue
    
    Args:
        payload: Original message or raw bytes
        reason: Human-readable failure reason
    """
    dlq_message = {
        "original_payload": payload if isinstance(payload, dict) else payload.decode(),
        "failure_reason": reason,
        "failure_timestamp": datetime.utcnow().isoformat() + "Z",
        "service": "genesys-api-service",
        "tenant_id": payload.get("metadata", {}).get("tenantId") if isinstance(payload, dict) else None
    }
    
    try:
        rabbitmq_channel.basic_publish(
            exchange="dlq",
            routing_key="genesys-api.dlq",
            body=json.dumps(dlq_message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent
                content_type="application/json"
            )
        )
        
        log_error("Message routed to DLQ", reason=reason)
        metrics.increment("messages_dlq_total", {
            "tenant_id": dlq_message.get("tenant_id", "unknown")
        })
    
    except Exception as e:
        log_error("Failed to route to DLQ", error=str(e))
        # This is critical - alert
        alert("DLQ routing failed", error=str(e))
```

---

## Non-Functional Requirements

### 10.1 Performance Requirements

**Throughput Targets**:
- **Multi-Tenant**: 1000+ messages/minute aggregate
- **Per Instance**: 100-200 messages/minute
- **Average Processing**: < 100ms (excluding Genesys API latency)

**Latency Targets**:
- **Authentication**: < 50ms (cached) or < 200ms (fresh token)
- **Rate Limit Check**: < 5ms
- **Total Processing**: < 100ms internal + Genesys API latency

**Resource Limits**:
```
CPU: 0.5-2.0 cores per instance
Memory: 512MB-2GB per instance
Network: 20Mbps per instance
```

### 10.2 Scalability

**Horizontal Scaling**:
- Multiple consumer instances
- Stateless design enables easy scaling
- Load balancing via RabbitMQ consumer count
- No coordination required between instances

**Scaling Triggers**:
```
Scale up when:
- Queue depth > 100 messages for > 5 minutes
- CPU usage > 70%
- Processing latency p95 > 200ms

Scale down when:
- Queue depth < 10 for > 10 minutes
- CPU usage < 30%
```

### 10.3 Reliability

**Uptime Target**: 99.9% (three nines)

**High Availability**:
- Multiple service instances (min 2)
- No single point of failure
- Circuit breakers prevent cascading failures
- Graceful degradation

**Data Durability**:
- RabbitMQ persistent messages
- Redis optional (degrades gracefully if unavailable)
- Dead letter queue for failed messages

**Failure Recovery**:
```
Service crash: Messages remain in queue, reprocessed on restart
Network partition: Messages retry until success or DLQ
Genesys outage: Circuit breaker opens, messages requeue
Redis outage: Service continues without cache (fresh tokens each time)
```

### 10.4 Consistency Guarantees

**Message Processing**:
- **At-least-once delivery**: Messages may be reprocessed
- **Idempotent**: Deduplication prevents duplicate conversations
- **Ordered**: Not guaranteed (stateless design)

**Token Caching**:
- **Eventually consistent**: Token cache may be stale
- **Self-healing**: Invalid tokens detected via 401 errors

**Correlation Events**:
- **Best-effort**: Published after successful delivery
- **Not guaranteed**: If service crashes after delivery but before publish

---

## Security Requirements

### 11.1 Authentication Security

**OAuth Token Storage**:
- Tokens stored in Redis with encryption at rest
- Never logged or exposed externally
- TTL prevents long-lived token exposure

**Secrets Management**:
```python
def load_secrets():
    """
    Load secrets from secure store
    
    Supports:
    - Environment variables (dev)
    - AWS Secrets Manager (prod)
    - HashiCorp Vault (prod)
    """
    if config["ENVIRONMENT"] == "production":
        # Load from secrets manager
        secrets_client = boto3.client("secretsmanager")
        response = secrets_client.get_secret_value(
            SecretId=config["SECRETS_ARN"]
        )
        secrets = json.loads(response["SecretString"])
    else:
        # Load from environment (dev only)
        secrets = {
            "RABBITMQ_PASSWORD": os.getenv("RABBITMQ_PASSWORD"),
            "REDIS_PASSWORD": os.getenv("REDIS_PASSWORD")
        }
    
    return secrets
```

### 11.2 Network Security

**HTTPS Only**:
- All external calls use HTTPS
- TLS 1.2 minimum
- Certificate validation enabled

**Connection Security**:
```python
# Genesys API client configuration
session = requests.Session()
session.verify = True  # Validate certificates
session.headers.update({
    "User-Agent": "genesys-api-service/1.1"
})

# Disable insecure SSL warnings in production
if config["ENVIRONMENT"] != "production":
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
```

### 11.3 Tenant Isolation

**Strict Boundaries**:
- Each tenant has own OAuth credentials
- Rate limits enforced per tenant
- No cross-tenant data access
- Tenant ID validated on every request

**Configuration Isolation**:
```python
def validate_tenant_access(payload, tenant_config):
    """
    Ensure payload tenant matches config tenant
    
    Args:
        payload: Input message
        tenant_config: Loaded tenant configuration
        
    Raises:
        SecurityError: If tenant mismatch
    """
    payload_tenant = payload["metadata"]["tenantId"]
    config_tenant = tenant_config["tenantId"]
    
    if payload_tenant != config_tenant:
        raise SecurityError(
            f"Tenant mismatch: payload={payload_tenant}, config={config_tenant}"
        )
```

### 11.4 Logging Security

**Sensitive Data Redaction**:
```python
def sanitize_log_payload(payload):
    """
    Remove sensitive fields from logs
    
    Redacted fields:
    - OAuth tokens
    - Client secrets
    - Phone numbers (optional, based on PII policy)
    """
    sanitized = copy.deepcopy(payload)
    
    # Redact tokens
    if "access_token" in sanitized:
        sanitized["access_token"] = "[REDACTED]"
    
    # Redact secrets in config
    if "oauthClientSecret" in sanitized.get("config", {}):
        sanitized["config"]["oauthClientSecret"] = "[REDACTED]"
    
    # Optionally redact phone numbers
    if config.get("REDACT_PHONE_NUMBERS"):
        genesys_payload = sanitized.get("genesysPayload", {})
        channel = genesys_payload.get("channel", {})
        from_info = channel.get("from", {})
        
        if "id" in from_info:
            phone = from_info["id"]
            from_info["id"] = phone[:3] + "****" + phone[-2:]
    
    return sanitized
```

---

## Observability & Monitoring

### 12.1 Structured Logging

**Log Format**:
```json
{
  "timestamp": "2023-11-15T03:33:20.123Z",
  "level": "INFO",
  "service": "genesys-api-service",
  "message": "Message delivered successfully",
  "tenantId": "uuid-tenant-1111",
  "correlationId": "uuid-1234-5678",
  "conversationId": "conversation-uuid-7890",
  "whatsappMessageId": "wamid.HBg...",
  "genesysRegion": "usw2.pure.cloud",
  "latencyMs": 145,
  "genesysStatus": 200
}
```

**Log Levels**:
- **DEBUG**: Detailed flow, token cache hits/misses (disabled in prod)
- **INFO**: Successful operations, normal flow
- **WARN**: Rate limits, backoffs, degraded mode
- **ERROR**: Processing failures, API errors
- **CRITICAL**: Service-level failures, DLQ issues

**Key Log Events**:

1. **Message Received**:
   ```json
   {
     "level": "INFO",
     "message": "Message received from queue",
     "tenantId": "uuid-tenant-1111",
     "correlationId": "uuid-1234"
   }
   ```

2. **Token Retrieved**:
   ```json
   {
     "level": "INFO",
     "message": "OAuth token obtained",
     "tenantId": "uuid-tenant-1111",
     "cached": false,
     "expiresIn": 3600
   }
   ```

3. **Genesys API Call**:
   ```json
   {
     "level": "INFO",
     "message": "Sending to Genesys API",
     "tenantId": "uuid-tenant-1111",
     "region": "usw2.pure.cloud",
     "messageType": "Text"
   }
   ```

4. **Conversation Created**:
   ```json
   {
     "level": "INFO",
     "message": "Conversation created in Genesys",
     "tenantId": "uuid-tenant-1111",
     "conversationId": "conversation-uuid-7890",
     "communicationId": "communication-uuid-3456"
   }
   ```

5. **Correlation Published**:
   ```json
   {
     "level": "INFO",
     "message": "Correlation event published",
     "tenantId": "uuid-tenant-1111",
     "conversationId": "conversation-uuid-7890"
   }
   ```

### 12.2 Metrics

**Prometheus Metrics**:

```python
# Counter metrics
messages_received_total = Counter(
    "messages_received_total",
    "Total messages received from queue",
    ["tenant_id"]
)

messages_processed_total = Counter(
    "messages_processed_total",
    "Total messages successfully processed",
    ["tenant_id"]
)

messages_duplicate_total = Counter(
    "messages_duplicate_total",
    "Total duplicate messages detected",
    ["tenant_id"]
)

validation_failures_total = Counter(
    "validation_failures_total",
    "Total validation failures"
)

config_errors_total = Counter(
    "config_errors_total",
    "Total configuration errors"
)

token_cache_hits_total = Counter(
    "token_cache_hits_total",
    "Total token cache hits",
    ["tenant_id"]
)

token_cache_misses_total = Counter(
    "token_cache_misses_total",
    "Total token cache misses",
    ["tenant_id"]
)

tokens_obtained_total = Counter(
    "tokens_obtained_total",
    "Total OAuth tokens obtained",
    ["tenant_id"]
)

tokens_invalidated_total = Counter(
    "tokens_invalidated_total",
    "Total tokens invalidated",
    ["tenant_id"]
)

token_fetch_failures_total = Counter(
    "token_fetch_failures_total",
    "Total token fetch failures",
    ["tenant_id"]
)

rate_limit_exceeded_total = Counter(
    "rate_limit_exceeded_total",
    "Total rate limit exceeded events",
    ["tenant_id"]
)

global_rate_limit_exceeded_total = Counter(
    "global_rate_limit_exceeded_total",
    "Total global rate limit exceeded events"
)

genesys_success_total = Counter(
    "genesys_success_total",
    "Total successful Genesys API calls",
    ["tenant_id"]
)

genesys_4xx_errors_total = Counter(
    "genesys_4xx_errors_total",
    "Total Genesys 4xx errors",
    ["tenant_id", "status_code"]
)

genesys_5xx_errors_total = Counter(
    "genesys_5xx_errors_total",
    "Total Genesys 5xx errors",
    ["tenant_id", "status_code"]
)

genesys_rate_limited_total = Counter(
    "genesys_rate_limited_total",
    "Total Genesys rate limit responses",
    ["tenant_id"]
)

genesys_retries_total = Counter(
    "genesys_retries_total",
    "Total Genesys API retries",
    ["tenant_id", "attempt"]
)

correlation_events_published_total = Counter(
    "correlation_events_published_total",
    "Total correlation events published",
    ["tenant_id"]
)

messages_dlq_total = Counter(
    "messages_dlq_total",
    "Total messages routed to DLQ",
    ["tenant_id"]
)

circuit_breaker_opened_total = Counter(
    "circuit_breaker_opened_total",
    "Total circuit breaker opens"
)

circuit_breaker_rejected_total = Counter(
    "circuit_breaker_rejected_total",
    "Total requests rejected by circuit breaker",
    ["region"]
)

# Histogram metrics
message_processing_duration_seconds = Histogram(
    "message_processing_duration_seconds",
    "End-to-end message processing duration",
    ["tenant_id"],
    buckets=[0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

token_fetch_duration_seconds = Histogram(
    "token_fetch_duration_seconds",
    "OAuth token fetch duration",
    buckets=[0.05, 0.1, 0.2, 0.5, 1.0]
)

genesys_api_duration_seconds = Histogram(
    "genesys_api_duration_seconds",
    "Genesys API call duration",
    ["tenant_id", "status_code"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

rate_limit_check_duration_seconds = Histogram(
    "rate_limit_check_duration_seconds",
    "Rate limit check duration",
    buckets=[0.001, 0.005, 0.01, 0.05]
)

# Gauge metrics
rabbitmq_queue_depth = Gauge(
    "rabbitmq_queue_depth",
    "Current message count in queue"
)

tenant_backoff_seconds = Gauge(
    "tenant_backoff_seconds",
    "Current backoff duration for tenant",
    ["tenant_id"]
)

circuit_breaker_state = Gauge(
    "circuit_breaker_state",
    "Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)",
    ["region"]
)
```

### 12.3 Health Checks

**Liveness Probe**:
```python
@app.route("/health/live")
def liveness():
    """
    Liveness check - is the service running?
    
    Returns 200 if service is alive
    """
    return {"status": "alive", "service": "genesys-api-service"}, 200
```

**Readiness Probe**:
```python
@app.route("/health/ready")
def readiness():
    """
    Readiness check - is the service ready to process messages?
    
    Checks:
    - RabbitMQ connection
    - Auth service reachability
    - Redis connection (warning only)
    
    Returns 200 if ready, 503 if not
    """
    checks = {}
    ready = True
    
    # Check RabbitMQ
    try:
        rabbitmq_channel.queue_declare(
            queue="inbound-processed",
            passive=True
        )
        checks["rabbitmq"] = "OK"
    except Exception as e:
        checks["rabbitmq"] = f"FAILED: {e}"
        ready = False
    
    # Check Auth Service
    try:
        response = requests.get(
            f"{config['AUTH_SERVICE_URL']}/health",
            timeout=2
        )
        if response.status_code == 200:
            checks["auth_service"] = "OK"
        else:
            checks["auth_service"] = f"FAILED: {response.status_code}"
            ready = False
    except Exception as e:
        checks["auth_service"] = f"FAILED: {e}"
        ready = False
    
    # Check Redis (degraded OK)
    try:
        redis_client.ping()
        checks["redis"] = "OK"
    except Exception as e:
        checks["redis"] = f"DEGRADED: {e}"
        # Don't fail readiness - Redis is optional
    
    status = "ready" if ready else "not ready"
    http_code = 200 if ready else 503
    
    return {"status": status, "checks": checks}, http_code
```

### 12.4 Distributed Tracing

**Correlation ID Propagation**:
```python
def set_correlation_context(correlation_id, tenant_id):
    """
    Set correlation context for current request
    
    Propagates through:
    - All log messages
    - HTTP headers to downstream services
    - Metrics labels (where appropriate)
    """
    context.correlation_id = correlation_id
    context.tenant_id = tenant_id


def get_correlation_context():
    """Get current correlation context"""
    return {
        "correlation_id": getattr(context, "correlation_id", None),
        "tenant_id": getattr(context, "tenant_id", None)
    }


def log_with_context(level, message, **kwargs):
    """Log with correlation context"""
    ctx = get_correlation_context()
    
    log_data = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "level": level,
        "service": "genesys-api-service",
        "message": message,
        "correlationId": ctx["correlation_id"],
        "tenantId": ctx["tenant_id"],
        **kwargs
    }
    
    print(json.dumps(log_data))
```

---

## Testing Requirements

### 13.1 Unit Tests

**Test Coverage Goals**: >80% code coverage

**Key Test Scenarios**:

1. **Validation Tests**:
   ```python
   def test_validate_valid_payload():
       payload = create_valid_payload()
       assert validate_input_payload(payload) == True
   
   def test_validate_missing_tenant_id():
       payload = create_valid_payload()
       del payload["metadata"]["tenantId"]
       
       with pytest.raises(ValidationError):
           validate_input_payload(payload)
   
   def test_validate_invalid_direction():
       payload = create_valid_payload()
       payload["genesysPayload"]["direction"] = "Outbound"
       
       with pytest.raises(ValidationError):
           validate_input_payload(payload)
   ```

2. **Token Management Tests**:
   ```python
   def test_token_cache_hit():
       tenant_id = "test-tenant"
       cached_token = {
           "access_token": "test-token",
           "expiry": time.time() + 3600
       }
       redis_client.set(f"genesys:token:{tenant_id}", json.dumps(cached_token))
       
       token = get_access_token(tenant_id, tenant_config)
       
       assert token == "test-token"
       assert metrics.get("token_cache_hits_total") == 1
   
   def test_token_cache_miss():
       tenant_id = "test-tenant"
       # No cached token
       
       with mock.patch("fetch_token_from_auth_service") as mock_fetch:
           mock_fetch.return_value = {
               "access_token": "new-token",
               "expires_in": 3600,
               "expiry": time.time() + 3600
           }
           
           token = get_access_token(tenant_id, tenant_config)
           
           assert token == "new-token"
           assert mock_fetch.called
           assert metrics.get("token_cache_misses_total") == 1
   ```

3. **Rate Limiting Tests**:
   ```python
   def test_rate_limit_allows_within_limit():
       tenant_id = "test-tenant"
       rate_limiter = RateLimiter()
       
       # Should allow requests within limit
       for i in range(10):
           assert rate_limiter.check_limit(tenant_id, tenant_config) == True
   
   def test_rate_limit_blocks_over_limit():
       tenant_id = "test-tenant"
       config = {
           "genesys": {
               "rateLimits": {
                   "requestsPerMinute": 10,
                   "burstSize": 5
               }
           }
       }
       rate_limiter = RateLimiter()
       
       # Exhaust tokens
       for i in range(5):
           rate_limiter.check_limit(tenant_id, config)
       
       # Next request should be blocked
       assert rate_limiter.check_limit(tenant_id, config) == False
   ```

4. **Circuit Breaker Tests**:
   ```python
   def test_circuit_breaker_opens_after_failures():
       cb = CircuitBreaker(failure_threshold=3, timeout=60)
       
       # Simulate failures
       for i in range(3):
           try:
               cb.call(failing_function)
           except:
               pass
       
       assert cb.state == "OPEN"
   
   def test_circuit_breaker_half_open_after_timeout():
       cb = CircuitBreaker(failure_threshold=3, timeout=1)
       
       # Open circuit
       for i in range(3):
           try:
               cb.call(failing_function)
           except:
               pass
       
       assert cb.state == "OPEN"
       
       # Wait for timeout
       time.sleep(1.1)
       
       # Next call should enter HALF_OPEN
       try:
           cb.call(failing_function)
       except:
           pass
       
       assert cb.state == "HALF_OPEN" or cb.state == "OPEN"
   ```

### 13.2 Integration Tests

**Test Scenarios**:

1. **End-to-End Flow**:
   ```python
   def test_e2e_message_processing():
       # 1. Publish message to RabbitMQ
       message = create_valid_message()
       publish_to_queue("inbound-processed", message)
       
       # 2. Mock Auth Service
       mock_auth_service.add_response(200, {
           "access_token": "test-token",
           "expires_in": 3600
       })
       
       # 3. Mock Genesys API
       mock_genesys_api.add_response(200, {
           "id": "conv-123",
           "communicationId": "comm-456"
       })
       
       # 4. Wait for processing
       time.sleep(2)
       
       # 5. Verify Genesys API called
       assert mock_genesys_api.call_count == 1
       
       # 6. Verify correlation event published
       correlation_event = consume_from_queue("correlation-events")
       assert correlation_event["conversationId"] == "conv-123"
   ```

2. **Retry After 5xx Error**:
   ```python
   def test_retry_after_genesys_5xx():
       message = create_valid_message()
       
       # Mock token
       mock_auth_service.add_response(200, {"access_token": "token"})
       
       # Mock Genesys to return 500 twice, then 200
       mock_genesys_api.add_responses([
           (500, {"message": "Internal error"}),
           (500, {"message": "Internal error"}),
           (200, {"id": "conv-123", "communicationId": "comm-456"})
       ])
       
       publish_to_queue("inbound-processed", message)
       time.sleep(5)
       
       # Verify 3 calls (2 retries + 1 success)
       assert mock_genesys_api.call_count == 3
       
       # Verify success metrics
       assert metrics.get("genesys_success_total") == 1
       assert metrics.get("genesys_retries_total") == 2
   ```

3. **Rate Limit Handling**:
   ```python
   def test_handle_genesys_429():
       message = create_valid_message()
       
       # Mock token
       mock_auth_service.add_response(200, {"access_token": "token"})
       
       # Mock Genesys to return 429 with Retry-After
       mock_genesys_api.add_response(429, 
           body={"message": "Rate limited"},
           headers={"Retry-After": "60"}
       )
       
       publish_to_queue("inbound-processed", message)
       time.sleep(1)
       
       # Verify message was NACKed (will be retried)
       assert mock_genesys_api.call_count == 1
       assert metrics.get("genesys_rate_limited_total") == 1
       
       # Verify backoff applied
       tenant_id = message["metadata"]["tenantId"]
       assert backoff_manager.is_backed_off(tenant_id) == True
   ```

### 13.3 Performance Tests

**Load Testing**:
```python
def test_throughput():
    """
    Test: Service can handle 1000 msg/min
    
    Setup:
    - Start service with 3 instances
    - Publish 1000 messages to queue
    - Measure processing time
    
    Assert:
    - All messages processed within 60 seconds
    - p95 latency < 200ms
    - No message loss
    """
    pass

def test_sustained_load():
    """
    Test: Service handles sustained load
    
    Setup:
    - Sustained load of 500 msg/min
    - Run for 30 minutes
    
    Assert:
    - No memory leaks
    - Latency remains stable
    - No DLQ messages
    """
    pass
```

---

## Deployment & Operations

### 14.1 Environment Variables

**Required Configuration**:
```bash
# Service Identity
SERVICE_NAME=genesys-api-service
SERVICE_VERSION=1.1.0
ENVIRONMENT=production

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@rabbitmq.internal:5672/vhost
RABBITMQ_QUEUE=inbound-processed
RABBITMQ_PREFETCH_COUNT=10
RABBITMQ_CORRELATION_QUEUE=correlation-events

# Auth Service
AUTH_SERVICE_URL=http://auth-service.internal:8080

# Redis
REDIS_URL=redis://redis.internal:6379/0
REDIS_PASSWORD=secret
TOKEN_CACHE_TTL=3600
DEDUPE_CACHE_TTL=86400

# Genesys
DEFAULT_REGION=usw2.pure.cloud
DEFAULT_TIMEOUT_CONNECT_MS=5000
DEFAULT_TIMEOUT_READ_MS=10000

# Rate Limiting
GLOBAL_RATE_LIMIT_RPM=500
DEFAULT_TENANT_RATE_LIMIT_RPM=300

# Retry Configuration
MAX_RETRY_ATTEMPTS=5
BASE_RETRY_DELAY_MS=1000
MAX_RETRY_DELAY_MS=32000

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=10
CIRCUIT_BREAKER_TIMEOUT=60

# Observability
LOG_LEVEL=INFO
METRICS_PORT=9090
REDACT_PHONE_NUMBERS=true
```

**Tenant Configuration** (loaded from config service):
```json
{
  "tenants": [
    {
      "tenantId": "uuid-tenant-1111",
      "genesys": {
        "region": "usw2.pure.cloud",
        "oauthClientId": "client-id-1",
        "oauthClientSecret": "secret-1",
        "integrationId": "integration-id-1",
        "rateLimits": {
          "requestsPerMinute": 300,
          "burstSize": 50
        }
      }
    }
  ]
}
```

### 14.2 Container Configuration

**Dockerfile Example**:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src ./src

# Create non-root user
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python src/healthcheck.py

# Expose metrics port
EXPOSE 9090

CMD ["python", "-u", "src/main.py"]
```

**Kubernetes Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: genesys-api-service
spec:
  replicas: 3  # Minimum for HA
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: genesys-api-service
  template:
    metadata:
      labels:
        app: genesys-api-service
        version: "1.1"
    spec:
      containers:
      - name: genesys-api-service
        image: genesys-api-service:1.1.0
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        env:
        - name: SERVICE_NAME
          value: "genesys-api-service"
        - name: RABBITMQ_URL
          valueFrom:
            secretKeyRef:
              name: rabbitmq-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: url
        - name: AUTH_SERVICE_URL
          value: "http://auth-service:8080"
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

### 14.3 Monitoring Alerts

**Alert Definitions**:

1. **High Error Rate**:
   ```yaml
   alert: GenesysAPIHighErrorRate
   expr: rate(genesys_4xx_errors_total[5m]) + rate(genesys_5xx_errors_total[5m]) > 0.1
   severity: warning
   description: High error rate in Genesys API calls
   ```

2. **Token Fetch Failures**:
   ```yaml
   alert: GenesysAPITokenFetchFailures
   expr: rate(token_fetch_failures_total[5m]) > 0.05
   severity: critical
   description: High failure rate fetching OAuth tokens
   ```

3. **Circuit Breaker Open**:
   ```yaml
   alert: GenesysAPICircuitBreakerOpen
   expr: circuit_breaker_state > 1
   severity: critical
   description: Circuit breaker open for Genesys API
   ```

4. **High DLQ Rate**:
   ```yaml
   alert: GenesysAPIHighDLQRate
   expr: rate(messages_dlq_total[5m]) > 0.05
   severity: warning
   description: High rate of messages to DLQ
   ```

5. **Service Down**:
   ```yaml
   alert: GenesysAPIServiceDown
   expr: up{job="genesys-api-service"} == 0
   severity: critical
   description: Genesys API service is down
   ```

### 14.4 Runbook

**Common Issues**:

1. **Messages Not Processing**:
   ```
   Symptom: Queue depth increasing
   
   Check:
   - Service instances running?
   - Auth service reachable?
   - Genesys API reachable?
   - Circuit breaker open?
   - Rate limits exhausted?
   
   Debug:
   kubectl get pods -l app=genesys-api-service
   kubectl logs -l app=genesys-api-service --tail=100
   ```

2. **High 401 Error Rate**:
   ```
   Symptom: Many token validation failures
   
   Check:
   - Auth service status
   - Tenant OAuth credentials valid?
   - Token cache corruption?
   
   Fix:
   - Flush Redis token cache
   - Restart Auth service
   - Verify OAuth credentials in config
   ```

3. **Circuit Breaker Open**:
   ```
   Symptom: All requests failing fast
   
   Check:
   - Genesys Cloud status page
   - Network connectivity to Genesys
   - Recent Genesys maintenance?
   
   Action:
   - Wait for circuit breaker timeout (60s)
   - If Genesys is down, scale down service to save resources
   - Alert Genesys support if prolonged
   ```

---

## Implementation Guidelines

### 15.1 Project Structure

**Recommended Layout**:
```
genesys-api-service/
├── src/
│   ├── main.py                  # Entry point
│   ├── config.py                # Configuration loading
│   ├── rabbitmq/
│   │   ├── consumer.py          # Message consumer
│   │   ├── publisher.py         # Correlation event publisher
│   │   └── connection.py        # Connection management
│   ├── auth/
│   │   ├── token_manager.py     # OAuth token management
│   │   └── cache.py             # Token caching
│   ├── genesys/
│   │   ├── client.py            # Genesys API client
│   │   ├── retry.py             # Retry logic
│   │   └── circuit_breaker.py   # Circuit breaker
│   ├── rate_limit/
│   │   ├── token_bucket.py      # Token bucket algorithm
│   │   ├── limiter.py           # Rate limiter
│   │   └── backoff.py           # Backoff manager
│   ├── validation/
│   │   └── validator.py         # Input validation
│   ├── observability/
│   │   ├── logger.py            # Structured logging
│   │   ├── metrics.py           # Prometheus metrics
│   │   └── health.py            # Health checks
│   └── utils/
│       ├── deduplication.py     # Duplicate detection
│       └── dlq.py               # Dead letter queue
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/
│   └── requirements.md          # This document
├── Dockerfile
├── docker-compose.yml
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── hpa.yaml
└── requirements.txt
```

### 15.2 Code Style Guidelines

**Key Principles**:

1. **Multi-Tenant Awareness**: Always validate tenant context
2. **Statelessness**: No global mutable state except caches
3. **Idempotency**: Deduplication on every request
4. **Error Handling**: Explicit handling, no silent failures
5. **Testing**: High test coverage for critical paths

---

## Common Pitfalls & Anti-Patterns

### 16.1 Pitfalls to Avoid

**1. Missing Tenant Validation**:
```python
# ❌ BAD: Assuming tenant in payload matches config
def process(payload, config):
    # Directly use config without validation
    token = get_token(config["tenantId"])

# ✅ GOOD: Validate tenant match
def process(payload, config):
    validate_tenant_access(payload, config)
    token = get_token(config["tenantId"])
```

**2. Token Leakage in Logs**:
```python
# ❌ BAD: Logging token
log.info(f"Using token: {access_token}")

# ✅ GOOD: Redact sensitive data
log.info("Using cached token", cached=True)
```

**3. Ignoring Rate Limits**:
```python
# ❌ BAD: No rate limit checking
def process(message):
    send_to_genesys(message)

# ✅ GOOD: Check rate limits
def process(message):
    if not check_rate_limit(tenant_id):
        return False  # Retry later
    send_to_genesys(message)
```

**4. Missing Idempotency**:
```python
# ❌ BAD: No deduplication
def process(message):
    send_to_genesys(message)
    publish_correlation(message)

# ✅ GOOD: Check for duplicates
def process(message):
    if is_duplicate(message):
        return True
    send_to_genesys(message)
    publish_correlation(message)
```

**5. Incorrect 401 Handling**:
```python
# ❌ BAD: Treating 401 as permanent failure
if response.status_code == 401:
    route_to_dlq(message)

# ✅ GOOD: Invalidate token and retry
if response.status_code == 401:
    invalidate_token_cache(tenant_id)
    raise RetryableError("Token expired")
```

**6. Hardcoded Regions**:
```python
# ❌ BAD: Hardcoded region
url = "https://api.usw2.pure.cloud/..."

# ✅ GOOD: Dynamic region from config
region = tenant_config["genesys"]["region"]
url = f"https://api.{region}.genesys.cloud/..."
```

---

## Summary

This document provides comprehensive requirements for implementing the Genesys API Service. Key principles:

1. **Multi-Tenant Architecture**: Strict tenant isolation, per-tenant configuration
2. **OAuth Token Management**: Secure caching, automatic refresh, 401 handling
3. **Rate Limiting**: Per-tenant and global limits, respect Genesys throttling
4. **Resilient Delivery**: Retries, circuit breakers, backoff strategies
5. **Idempotent Processing**: Deduplication prevents duplicate conversations
6. **Conversation Correlation**: Link WhatsApp ↔ Genesys conversations
7. **Observable**: Comprehensive metrics, structured logs, health checks

The service must be **reliable and secure** - it's the critical gateway to Genesys Cloud. Proper error handling, rate limiting, and tenant isolation are essential for production stability.

For implementation, follow the patterns in this document closely. The architecture accounts for real-world Genesys API behavior, rate limits, and failure modes.