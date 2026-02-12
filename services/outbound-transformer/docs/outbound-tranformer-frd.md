# Outbound Transformer Service - Functional Requirements Document

**Version:** 1.2 (Enterprise Hardened - LLM Optimized)  
**Service Name:** `outbound-transformer`  
**Purpose:** Message transformation pipeline between Genesys Cloud and WhatsApp Business Platform  
**Architecture Pattern:** Stateless, event-driven transformation service

---

## Table of Contents
1. [Service Overview](#1-service-overview)
2. [Architecture Context](#2-architecture-context)
3. [Data Contracts](#3-data-contracts)
4. [Functional Requirements](#4-functional-requirements)
5. [Validation Rules](#5-validation-rules)
6. [Error Handling](#6-error-handling)
7. [Performance Requirements](#7-performance-requirements)
8. [Observability](#8-observability)
9. [Implementation Guidelines](#9-implementation-guidelines)

---

## 1. Service Overview

### 1.1 Primary Purpose
The **Outbound Transformer Service** is a dedicated transformation layer that converts enriched outbound messages from Genesys Cloud into WhatsApp Business Platform compatible payloads.

### 1.2 Service Boundaries

**What This Service DOES:**
- Consumes enriched messages from RabbitMQ queue `outbound-processed`
- Transforms Genesys Open Messaging JSON → WhatsApp Graph API JSON
- Validates media URLs, MIME types, and WhatsApp constraints
- Enforces idempotency to prevent duplicate sends
- Routes transformed messages to `outbound-ready` queue or directly to WhatsApp API Service
- Handles Dead Letter Queue (DLQ) routing for failed transformations

**What This Service DOES NOT DO:**
- ❌ Store conversation state or history
- ❌ Perform identity resolution or customer lookup
- ❌ Make direct calls to Meta Graph API (unless in pipeline mode)
- ❌ Implement business logic or routing decisions
- ❌ Manage WhatsApp Business Account configuration
- ❌ Handle inbound messages (separate service)

### 1.3 Processing Mode
**Architecture:** Stateless, deterministic transformer  
**Concurrency:** Multi-threaded message processing  
**Deployment:** Horizontally scalable (multiple instances)

---

## 2. Architecture Context

### 2.1 System Dependencies

| Component | Type | Purpose | Connection Details |
|-----------|------|---------|-------------------|
| **RabbitMQ** | Message Broker | Source of outbound messages | Queue: `outbound-processed`<br>Exchange: `outbound.exchange` |
| **WhatsApp API Service** | Downstream Service | Destination for transformed messages | Queue: `outbound-ready` (recommended)<br>OR REST: `POST /whatsapp/send` |
| **Object Storage** | Storage Backend | Media file hosting | MinIO (internal) or S3<br>Must generate public signed URLs |
| **Redis** | Cache | Idempotency deduplication | Key pattern: `idempotency:outbound:{internalId}`<br>TTL: 24 hours |
| **Prometheus** | Metrics | Performance monitoring | Metrics endpoint: `/metrics` |
| **Structured Logger** | Logging | Audit trail and debugging | JSON format with correlation IDs |

### 2.2 Message Flow Diagram

```
┌─────────────────┐
│ State Manager   │
│ (Upstream)      │
└────────┬────────┘
         │
         │ Enriched Message
         ▼
┌─────────────────────────────────┐
│ RabbitMQ: outbound-processed    │
└────────┬────────────────────────┘
         │
         │ Consume
         ▼
┌─────────────────────────────────┐
│ Outbound Transformer Service    │
│                                 │
│ 1. Validate Schema              │
│ 2. Check Idempotency (Redis)    │
│ 3. Transform to WhatsApp Format │
│ 4. Validate Media URLs          │
│ 5. Enforce WhatsApp Rules       │
└────────┬────────────────────────┘
         │
         │ Success
         ▼
┌─────────────────────────────────┐
│ RabbitMQ: outbound-ready        │
│ OR                              │
│ WhatsApp API Service (REST)     │
└─────────────────────────────────┘

         │ Failure (after retries)
         ▼
┌─────────────────────────────────┐
│ RabbitMQ: outbound-transformer-dlq │
└─────────────────────────────────┘
```

---

## 3. Data Contracts

### 3.1 Input Schema (From State Manager)

**Source Queue:** `outbound-processed`  
**Message Format:** JSON  
**Content-Type:** `application/json`

**Full Input Schema:**
```json
{
  "internalId": "uuid-msg-123",           // Required: Unique message identifier (UUID v4)
  "tenantId": "uuid-5678",                // Required: Tenant/Organization identifier
  "conversationId": "genesys-conv-uuid",  // Required: Genesys conversation ID
  "genesysId": "genesys-msg-uuid",        // Required: Genesys message ID (for correlation)
  "waId": "919876543210",                 // Required: WhatsApp ID (E.164 format, no +)
  "phoneNumberId": "100000001",           // Required: WhatsApp Business Phone Number ID
  "timestamp": 1700000000,                // Required: Unix epoch seconds
  "type": "message",                      // Required: Always "message" for outbound
  "payload": {                            // Required: Message content
    "text": "Hello Customer",             // Optional: Text content (max 4096 chars)
    "media": {                            // Optional: Media attachment
      "url": "https://minio.internal/media-outbound/file.jpg",  // Required if media present
      "mime_type": "image/jpeg",          // Required if media present
      "filename": "support-guide.jpg"     // Optional but recommended for documents
    }
  }
}
```

**Field Validation Rules:**

| Field | Type | Required | Constraints | Validation |
|-------|------|----------|-------------|------------|
| `internalId` | String (UUID) | Yes | UUID v4 format | Regex: `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` |
| `tenantId` | String (UUID) | Yes | UUID v4 format | Same as internalId |
| `conversationId` | String | Yes | Non-empty | Length: 1-255 chars |
| `genesysId` | String | Yes | Non-empty | Length: 1-255 chars |
| `waId` | String | Yes | E.164 format, no + prefix | Regex: `^[1-9][0-9]{6,14}$` |
| `phoneNumberId` | String | Yes | Numeric string | Regex: `^[0-9]+$` |
| `timestamp` | Integer | Yes | Unix epoch seconds | Range: 1000000000 - 9999999999 |
| `type` | String | Yes | Must be "message" | Enum: ["message"] |
| `payload` | Object | Yes | Must contain text OR media | Not empty |
| `payload.text` | String | No | If present, 1-4096 chars | Trimmed, non-empty |
| `payload.media` | Object | No | If present, requires url + mime_type | See media validation |

### 3.2 Output Schema (To WhatsApp API Service)

**Destination Queue:** `outbound-ready` (recommended)  
**Alternative:** REST API `POST /whatsapp/send`  
**Message Format:** JSON  
**Content-Type:** `application/json`

**Full Output Schema:**
```json
{
  "metadata": {
    "tenantId": "uuid-5678",              // Tenant identifier for routing
    "phoneNumberId": "100000001",         // WhatsApp Business Phone Number ID
    "internalId": "uuid-msg-123",         // Original message ID for tracking
    "correlationId": "genesys-msg-uuid"   // Genesys message ID for correlation
  },
  "wabaPayload": {
    "messaging_product": "whatsapp",      // Always "whatsapp"
    "recipient_type": "individual",       // Always "individual"
    "to": "919876543210",                 // Recipient WhatsApp ID
    "type": "text|image|video|document|audio",  // Message type
    
    // For text messages:
    "text": {
      "body": "Hello Customer"
    },
    
    // For image messages:
    "image": {
      "link": "https://public-url/file.jpg",
      "caption": "Hello Customer"         // Optional, max 1024 chars
    },
    
    // For video messages:
    "video": {
      "link": "https://public-url/file.mp4",
      "caption": "Hello Customer"         // Optional, max 1024 chars
    },
    
    // For document messages:
    "document": {
      "link": "https://public-url/file.pdf",
      "filename": "support-guide.pdf",    // Strongly recommended
      "caption": "Hello Customer"         // Optional, max 1024 chars
    },
    
    // For audio messages:
    "audio": {
      "link": "https://public-url/file.aac"
      // No caption support for audio
    }
  }
}
```

**Output Message Headers (RabbitMQ):**
```
X-Tenant-ID: uuid-5678
X-Correlation-ID: genesys-msg-uuid
X-Message-Type: outbound
X-Timestamp: 1700000000
Content-Type: application/json
```

### 3.3 MIME Type to WhatsApp Type Mapping

**Supported Media Types:**

| MIME Type | WhatsApp Type | Max File Size | Notes |
|-----------|---------------|---------------|-------|
| `image/jpeg` | `image` | 5 MB | Recommended format |
| `image/png` | `image` | 5 MB | Supported |
| `video/mp4` | `video` | 16 MB | H.264 codec recommended |
| `video/3gpp` | `video` | 16 MB | Supported |
| `application/pdf` | `document` | 100 MB | Most common document type |
| `application/vnd.ms-powerpoint` | `document` | 100 MB | PPT files |
| `application/msword` | `document` | 100 MB | DOC files |
| `application/vnd.ms-excel` | `document` | 100 MB | XLS files |
| `application/vnd.openxmlformats-officedocument.*` | `document` | 100 MB | Office Open XML (DOCX, XLSX, PPTX) |
| `text/plain` | `document` | 100 MB | Text files |
| `audio/aac` | `audio` | 16 MB | Recommended audio format |
| `audio/mp4` | `audio` | 16 MB | M4A files |
| `audio/mpeg` | `audio` | 16 MB | MP3 files |
| `audio/amr` | `audio` | 16 MB | AMR files |
| `audio/ogg` | `audio` | 16 MB | OGG files (Opus codec) |

**Unsupported MIME Types - Fallback Behavior:**

Configuration option: `UNSUPPORTED_MIME_BEHAVIOR`

| Behavior | Description | Implementation |
|----------|-------------|----------------|
| `reject` | Reject message, send to DLQ | Log error, NACK message, route to DLQ |
| `convert_to_document` | Treat as generic document | Map to `document` type, use original filename |
| `text_fallback` | Send text only, drop media | Send text message, log warning about dropped media |

---

## 4. Functional Requirements

### 4.1 Message Consumption (REQ-OUT-01)

**Requirement ID:** REQ-OUT-01  
**Priority:** Critical  
**Description:** Consume messages from RabbitMQ queue with proper acknowledgment

**Processing Steps:**

1. **Connect to RabbitMQ**
   - Queue: `outbound-processed`
   - Prefetch count: 10 (configurable)
   - Auto-ack: Disabled (manual ACK required)

2. **Deserialize Message**
   ```python
   # Pseudo-code
   try:
       message = json.loads(body)
   except json.JSONDecodeError as e:
       log_error("Invalid JSON", error=e, raw_body=body)
       channel.basic_ack(delivery_tag)  # ACK to remove from queue
       return
   ```

3. **Validate Required Fields**
   - Check presence: `tenantId`, `waId`, `phoneNumberId`, `internalId`, `conversationId`, `genesysId`, `timestamp`, `type`, `payload`
   - If any required field missing:
     - Log error with field name
     - ACK message (invalid, cannot retry)
     - Increment metric: `outbound_invalid_messages_total`

4. **Idempotency Check**
   ```python
   # Pseudo-code
   cache_key = f"idempotency:outbound:{message['internalId']}"
   if redis.exists(cache_key):
       log_info("Duplicate message detected", internal_id=message['internalId'])
       channel.basic_ack(delivery_tag)  # ACK silently
       increment_metric("outbound_duplicate_messages_total")
       return
   
   # Set idempotency marker
   redis.setex(cache_key, ttl=86400, value="processed")  # 24 hour TTL
   ```

**Failure Scenarios:**

| Scenario | Action | ACK/NACK | Metrics |
|----------|--------|----------|---------|
| Invalid JSON | Log error | ACK | `outbound_invalid_messages_total` |
| Missing required field | Log error | ACK | `outbound_invalid_messages_total` |
| Duplicate `internalId` | Log info | ACK | `outbound_duplicate_messages_total` |
| Redis connection error | Retry (process anyway if cache unavailable) | See retry policy | `outbound_cache_errors_total` |

---

### 4.2 Text Message Transformation (REQ-OUT-02)

**Requirement ID:** REQ-OUT-02  
**Priority:** Critical  
**Description:** Transform text-only messages to WhatsApp format

**Condition:**
- `payload.text` is present AND non-empty after trimming
- `payload.media` is null or undefined

**Transformation Logic:**

```python
# Pseudo-code
def transform_text_message(input_message):
    text = input_message['payload']['text'].strip()
    
    # Validate text length
    if len(text) == 0:
        raise ValidationError("Text is empty after trimming")
    
    if len(text) > 4096:
        raise ValidationError(f"Text exceeds max length: {len(text)} > 4096")
    
    # Build output
    output = {
        "metadata": {
            "tenantId": input_message['tenantId'],
            "phoneNumberId": input_message['phoneNumberId'],
            "internalId": input_message['internalId'],
            "correlationId": input_message['genesysId']
        },
        "wabaPayload": {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": input_message['waId'],
            "type": "text",
            "text": {
                "body": text
            }
        }
    }
    
    return output
```

**Validation Rules:**

| Rule | Validation | Error Handling |
|------|------------|----------------|
| Text not empty | `len(text.strip()) > 0` | Reject, log, ACK |
| Max length | `len(text) <= 4096` | Reject, log, ACK |
| Unicode support | Allow all valid UTF-8 | Log warning if contains unsupported chars |
| Whitespace normalization | Trim leading/trailing | Applied automatically |

**Examples:**

**Input:**
```json
{
  "internalId": "msg-001",
  "tenantId": "tenant-123",
  "waId": "919876543210",
  "phoneNumberId": "100000001",
  "payload": {
    "text": "  Hello Customer  "
  }
}
```

**Output:**
```json
{
  "metadata": {...},
  "wabaPayload": {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "919876543210",
    "type": "text",
    "text": {
      "body": "Hello Customer"
    }
  }
}
```

---

### 4.3 Media Message Transformation (REQ-OUT-03)

**Requirement ID:** REQ-OUT-03  
**Priority:** Critical  
**Description:** Transform media messages to WhatsApp format with proper URL handling

**Conditions:**
- `payload.media` is present
- `payload.media.url` is present and valid
- `payload.media.mime_type` is present

**Step 1: Determine WhatsApp Message Type**

```python
# Pseudo-code
def get_whatsapp_type(mime_type):
    MIME_TYPE_MAP = {
        'image/jpeg': 'image',
        'image/png': 'image',
        'video/mp4': 'video',
        'video/3gpp': 'video',
        'application/pdf': 'document',
        'audio/aac': 'audio',
        'audio/mp4': 'audio',
        'audio/mpeg': 'audio',
        'audio/amr': 'audio',
        'audio/ogg': 'audio',
        # Add all supported types from table above
    }
    
    whatsapp_type = MIME_TYPE_MAP.get(mime_type.lower())
    
    if whatsapp_type is None:
        # Handle unsupported MIME type based on config
        return handle_unsupported_mime(mime_type)
    
    return whatsapp_type
```

**Step 2: Validate and Transform Media URL**

```python
# Pseudo-code
def validate_and_transform_url(url, tenant_id, internal_id):
    # Parse URL
    parsed = urlparse(url)
    
    # Rule 1: Must be HTTPS
    if parsed.scheme != 'https':
        raise ValidationError(f"URL must be HTTPS: {url}")
    
    # Rule 2: Must not be private IP
    ip = socket.gethostbyname(parsed.hostname)
    if is_private_ip(ip):
        raise ValidationError(f"URL resolves to private IP: {ip}")
    
    # Rule 3: Check if internal storage URL
    if is_internal_storage_url(url):
        # Generate public signed URL
        public_url = generate_signed_url(
            url=url,
            tenant_id=tenant_id,
            expiration_seconds=600,  # 10 minutes
            internal_id=internal_id
        )
        return public_url
    
    # Rule 4: Validate URL is reachable (optional HEAD request)
    if config.VALIDATE_URL_ACCESSIBILITY:
        validate_url_accessible(url)
    
    return url

def is_internal_storage_url(url):
    internal_domains = [
        'minio.internal',
        'localhost',
        '127.0.0.1',
        config.INTERNAL_STORAGE_DOMAIN
    ]
    parsed = urlparse(url)
    return any(domain in parsed.hostname for domain in internal_domains)

def generate_signed_url(url, tenant_id, expiration_seconds, internal_id):
    # Implementation depends on storage backend
    # For MinIO/S3:
    # 1. Parse internal URL to get bucket + object key
    # 2. Generate presigned URL with expiration
    # 3. Ensure URL is publicly accessible
    # 4. Log URL generation for audit
    
    signed_url = storage_client.presigned_get_object(
        bucket_name=extract_bucket(url),
        object_name=extract_object_key(url),
        expires=timedelta(seconds=expiration_seconds)
    )
    
    log_info("Generated signed URL", 
             internal_id=internal_id,
             original_url=url,
             signed_url=signed_url,
             expiration=expiration_seconds)
    
    return signed_url
```

**Step 3: Handle Caption Logic**

```python
# Pseudo-code
def get_caption(text, whatsapp_type):
    # Audio does not support captions
    if whatsapp_type == 'audio':
        if text:
            log_warning("Caption not supported for audio, will be sent as separate message")
            return None
        return None
    
    # Other types support captions
    if text:
        caption = text.strip()
        if len(caption) > 1024:
            log_warning(f"Caption exceeds 1024 chars, truncating: {len(caption)}")
            caption = caption[:1024]
        return caption
    
    return None
```

**Step 4: Build Media Payload**

```python
# Pseudo-code
def transform_media_message(input_message):
    media = input_message['payload']['media']
    text = input_message['payload'].get('text', '').strip()
    
    # Determine WhatsApp type
    whatsapp_type = get_whatsapp_type(media['mime_type'])
    
    # Validate and transform URL
    public_url = validate_and_transform_url(
        url=media['url'],
        tenant_id=input_message['tenantId'],
        internal_id=input_message['internalId']
    )
    
    # Get caption
    caption = get_caption(text, whatsapp_type)
    
    # Build media object
    media_object = {
        "link": public_url
    }
    
    # Add caption if supported and present
    if caption and whatsapp_type in ['image', 'video', 'document']:
        media_object['caption'] = caption
    
    # Add filename for documents
    if whatsapp_type == 'document':
        filename = media.get('filename') or extract_filename_from_url(public_url)
        if filename:
            media_object['filename'] = filename
    
    # Build output
    output = {
        "metadata": {
            "tenantId": input_message['tenantId'],
            "phoneNumberId": input_message['phoneNumberId'],
            "internalId": input_message['internalId'],
            "correlationId": input_message['genesysId']
        },
        "wabaPayload": {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": input_message['waId'],
            "type": whatsapp_type,
            whatsapp_type: media_object
        }
    }
    
    return output, send_separate_text_for_audio(text, whatsapp_type)

def send_separate_text_for_audio(text, whatsapp_type):
    # If audio + text, return text message to send separately
    if whatsapp_type == 'audio' and text:
        return True
    return False
```

**Audio + Text Special Handling:**

Configuration: `AUDIO_TEXT_BEHAVIOR`

| Behavior | Description | Implementation |
|----------|-------------|----------------|
| `separate_message` | Send audio, then separate text message | Create two output messages |
| `discard_text` | Send audio only, ignore text | Log warning, send audio only |
| `text_only` | Send text only, ignore audio | Log warning, send text only |

**Example Transformation (Image with Caption):**

**Input:**
```json
{
  "internalId": "msg-002",
  "tenantId": "tenant-123",
  "waId": "919876543210",
  "phoneNumberId": "100000001",
  "payload": {
    "text": "Check out this guide",
    "media": {
      "url": "https://minio.internal/bucket/guide.jpg",
      "mime_type": "image/jpeg",
      "filename": "user-guide.jpg"
    }
  }
}
```

**Output:**
```json
{
  "metadata": {
    "tenantId": "tenant-123",
    "phoneNumberId": "100000001",
    "internalId": "msg-002",
    "correlationId": "genesys-msg-uuid"
  },
  "wabaPayload": {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "919876543210",
    "type": "image",
    "image": {
      "link": "https://public-storage.example.com/bucket/guide.jpg?signature=...",
      "caption": "Check out this guide"
    }
  }
}
```

---

### 4.4 Dispatch to WhatsApp API Service (REQ-OUT-04)

**Requirement ID:** REQ-OUT-04  
**Priority:** Critical  
**Description:** Forward transformed messages to WhatsApp API Service

**Mode 1: Publish to Queue (Recommended)**

**Configuration:**
- Queue: `outbound-ready`
- Exchange: `outbound.exchange` (topic exchange)
- Routing Key: `outbound.ready.{tenantId}`
- Delivery Mode: Persistent (2)

**Implementation:**
```python
# Pseudo-code
def dispatch_via_queue(transformed_message):
    headers = {
        'X-Tenant-ID': transformed_message['metadata']['tenantId'],
        'X-Correlation-ID': transformed_message['metadata']['correlationId'],
        'X-Message-Type': 'outbound',
        'X-Timestamp': str(int(time.time())),
        'Content-Type': 'application/json'
    }
    
    routing_key = f"outbound.ready.{transformed_message['metadata']['tenantId']}"
    
    channel.basic_publish(
        exchange='outbound.exchange',
        routing_key=routing_key,
        body=json.dumps(transformed_message),
        properties=pika.BasicProperties(
            delivery_mode=2,  # Persistent
            headers=headers,
            content_type='application/json'
        )
    )
    
    log_info("Message dispatched to queue",
             internal_id=transformed_message['metadata']['internalId'],
             queue='outbound-ready')
    
    increment_metric("outbound_messages_dispatched_total",
                     labels={'tenant_id': transformed_message['metadata']['tenantId']})
```

**Mode 2: Direct HTTP Call (Pipeline Mode - Optional)**

**Configuration:**
- Endpoint: `POST {WHATSAPP_API_BASE_URL}/whatsapp/send`
- Timeout: 5 seconds
- Retry: 3 attempts with exponential backoff

**Implementation:**
```python
# Pseudo-code
def dispatch_via_http(transformed_message):
    url = f"{config.WHATSAPP_API_BASE_URL}/whatsapp/send"
    headers = {
        'Content-Type': 'application/json',
        'X-Tenant-ID': transformed_message['metadata']['tenantId'],
        'X-Correlation-ID': transformed_message['metadata']['correlationId']
    }
    
    for attempt in range(1, 4):  # 3 attempts
        try:
            response = requests.post(
                url=url,
                json=transformed_message,
                headers=headers,
                timeout=5
            )
            
            if 200 <= response.status_code < 300:
                log_info("Message dispatched via HTTP",
                         internal_id=transformed_message['metadata']['internalId'],
                         status_code=response.status_code)
                return 'ack'  # Success
            
            elif 400 <= response.status_code < 500:
                log_error("Client error from WhatsApp API",
                          status_code=response.status_code,
                          response_body=response.text)
                return 'ack'  # Don't retry client errors
            
            elif 500 <= response.status_code < 600:
                log_warning(f"Server error on attempt {attempt}",
                            status_code=response.status_code)
                if attempt < 3:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    continue
                return 'nack'  # Retry via queue redelivery
            
        except requests.Timeout:
            log_warning(f"Timeout on attempt {attempt}")
            if attempt < 3:
                time.sleep(2 ** attempt)
                continue
            return 'nack'
        
        except Exception as e:
            log_error(f"Unexpected error on attempt {attempt}", error=e)
            return 'nack'
    
    return 'nack'
```

**HTTP Response Handling:**

| Status Code | Retry | ACK/NACK | Reason |
|-------------|-------|----------|--------|
| 200-299 | No | ACK | Success |
| 400 | No | ACK | Bad request (client error, won't succeed on retry) |
| 401 | No | ACK | Unauthorized (config issue, not message issue) |
| 429 | Yes | NACK | Rate limited (will succeed later) |
| 500-599 | Yes | NACK | Server error (transient) |
| Timeout | Yes | NACK | Network issue (transient) |

---

### 4.5 Idempotency Enforcement (REQ-OUT-05)

**Requirement ID:** REQ-OUT-05  
**Priority:** Critical  
**Description:** Prevent duplicate message delivery to WhatsApp

**Idempotency Key:** `internalId` field from input message

**Storage:** Redis cache with TTL

**Implementation:**

```python
# Pseudo-code
def check_idempotency(internal_id):
    cache_key = f"idempotency:outbound:{internal_id}"
    
    try:
        if redis.exists(cache_key):
            # Message already processed
            log_info("Duplicate message detected", internal_id=internal_id)
            increment_metric("outbound_duplicate_messages_total")
            return True  # Is duplicate
        
        # Not a duplicate, mark as processing
        # Use SETNX to handle race conditions
        success = redis.setnx(cache_key, json.dumps({
            'processed_at': time.time(),
            'status': 'processing'
        }))
        
        if not success:
            # Another instance processed this between check and set
            log_info("Concurrent duplicate detected", internal_id=internal_id)
            return True
        
        # Set TTL
        redis.expire(cache_key, 86400)  # 24 hours
        
        return False  # Not a duplicate
    
    except redis.ConnectionError as e:
        # Cache unavailable - log and continue processing
        # Accept risk of duplicate for availability
        log_error("Redis connection error during idempotency check",
                  error=e,
                  internal_id=internal_id)
        increment_metric("outbound_cache_errors_total")
        return False  # Process anyway

def mark_completed(internal_id):
    cache_key = f"idempotency:outbound:{internal_id}"
    try:
        redis.setex(
            cache_key,
            86400,  # 24 hours
            json.dumps({
                'processed_at': time.time(),
                'status': 'completed'
            })
        )
    except Exception as e:
        log_error("Failed to mark message as completed", error=e)
```

**Idempotency Window:** 24 hours  
**Rationale:** WhatsApp has 24-hour session window; duplicates beyond this are unlikely

**Edge Cases:**

| Scenario | Handling |
|----------|----------|
| Redis unavailable | Log error, process message (favor availability) |
| Race condition | SETNX handles atomically |
| TTL expires during processing | Next check will create new entry (safe) |
| Same message after 24h | Processed as new (acceptable) |

---

### 4.6 Dead Letter Queue Handling (REQ-OUT-06)

**Requirement ID:** REQ-OUT-06  
**Priority:** High  
**Description:** Route persistently failed messages to DLQ for manual investigation

**DLQ Configuration:**
- Queue: `outbound-transformer-dlq`
- Max Retries: 3 attempts
- Retry Delay: Exponential backoff (2s, 4s, 8s)

**Triggers for DLQ:**
- Transformation errors after max retries
- Downstream service unavailable after max retries
- Unrecoverable validation errors (after logging)

**DLQ Message Format:**
```json
{
  "original_message": { /* full input message */ },
  "error_details": {
    "error_type": "TransformationError",
    "error_message": "Unsupported MIME type: application/x-unknown",
    "stack_trace": "...",
    "retry_count": 3,
    "first_attempt_timestamp": 1700000000,
    "last_attempt_timestamp": 1700000024
  },
  "metadata": {
    "tenant_id": "uuid-5678",
    "internal_id": "uuid-msg-123",
    "dlq_timestamp": 1700000030,
    "service": "outbound-transformer",
    "service_version": "1.2.0"
  }
}
```

**Implementation:**
```python
# Pseudo-code
def route_to_dlq(original_message, error, retry_count):
    dlq_message = {
        "original_message": original_message,
        "error_details": {
            "error_type": type(error).__name__,
            "error_message": str(error),
            "stack_trace": traceback.format_exc(),
            "retry_count": retry_count,
            "first_attempt_timestamp": get_first_attempt_time(original_message),
            "last_attempt_timestamp": int(time.time())
        },
        "metadata": {
            "tenant_id": original_message.get('tenantId'),
            "internal_id": original_message.get('internalId'),
            "dlq_timestamp": int(time.time()),
            "service": "outbound-transformer",
            "service_version": config.SERVICE_VERSION
        }
    }
    
    channel.basic_publish(
        exchange='',
        routing_key='outbound-transformer-dlq',
        body=json.dumps(dlq_message),
        properties=pika.BasicProperties(
            delivery_mode=2,
            content_type='application/json'
        )
    )
    
    log_error("Message routed to DLQ",
              internal_id=original_message.get('internalId'),
              error_type=type(error).__name__,
              retry_count=retry_count)
    
    increment_metric("outbound_dlq_messages_total",
                     labels={'error_type': type(error).__name__})
    
    # Emit alert for DLQ routing
    if config.ALERT_ON_DLQ:
        emit_alert("message_to_dlq", severity="warning", message=dlq_message)
```

**No Silent Drops Policy:**
- Every message must be either successfully processed OR routed to DLQ
- Logging alone is insufficient
- DLQ ensures audit trail and recovery capability

---

## 5. Validation Rules

### 5.1 Input Validation Checklist

**Schema Validation:**
```python
# Pseudo-code
def validate_input_message(message):
    errors = []
    
    # Required fields
    required_fields = ['internalId', 'tenantId', 'conversationId', 
                       'genesysId', 'waId', 'phoneNumberId', 
                       'timestamp', 'type', 'payload']
    
    for field in required_fields:
        if field not in message:
            errors.append(f"Missing required field: {field}")
    
    # UUID validation
    if 'internalId' in message and not is_valid_uuid(message['internalId']):
        errors.append(f"Invalid UUID format for internalId: {message['internalId']}")
    
    if 'tenantId' in message and not is_valid_uuid(message['tenantId']):
        errors.append(f"Invalid UUID format for tenantId: {message['tenantId']}")
    
    # WhatsApp ID validation (E.164 without +)
    if 'waId' in message:
        if not re.match(r'^[1-9][0-9]{6,14}$', message['waId']):
            errors.append(f"Invalid WhatsApp ID format: {message['waId']}")
    
    # Phone Number ID validation
    if 'phoneNumberId' in message:
        if not re.match(r'^[0-9]+$', message['phoneNumberId']):
            errors.append(f"Invalid Phone Number ID format: {message['phoneNumberId']}")
    
    # Timestamp validation
    if 'timestamp' in message:
        if not isinstance(message['timestamp'], int):
            errors.append("Timestamp must be integer")
        elif not (1000000000 <= message['timestamp'] <= 9999999999):
            errors.append(f"Timestamp out of valid range: {message['timestamp']}")
    
    # Type validation
    if 'type' in message and message['type'] != 'message':
        errors.append(f"Invalid type: {message['type']}, must be 'message'")
    
    # Payload validation
    if 'payload' in message:
        payload = message['payload']
        has_text = 'text' in payload and payload['text']
        has_media = 'media' in payload and payload['media']
        
        if not has_text and not has_media:
            errors.append("Payload must contain either text or media")
        
        # Text validation
        if has_text:
            text = str(payload['text']).strip()
            if len(text) == 0:
                errors.append("Text is empty after trimming")
            elif len(text) > 4096:
                errors.append(f"Text exceeds max length: {len(text)} > 4096")
        
        # Media validation
        if has_media:
            media = payload['media']
            if 'url' not in media:
                errors.append("Media object missing required field: url")
            if 'mime_type' not in media:
                errors.append("Media object missing required field: mime_type")
    
    if errors:
        raise ValidationError(errors)
    
    return True
```

### 5.2 URL Validation Rules

```python
# Pseudo-code
def validate_url(url):
    # Parse URL
    try:
        parsed = urlparse(url)
    except Exception:
        raise ValidationError(f"Invalid URL format: {url}")
    
    # Must have scheme
    if not parsed.scheme:
        raise ValidationError(f"URL missing scheme: {url}")
    
    # Must be HTTPS
    if parsed.scheme != 'https':
        raise ValidationError(f"URL must use HTTPS: {url}")
    
    # Must have hostname
    if not parsed.hostname:
        raise ValidationError(f"URL missing hostname: {url}")
    
    # Check for private IP
    try:
        ip = socket.gethostbyname(parsed.hostname)
        if is_private_ip(ip):
            raise ValidationError(f"URL resolves to private IP: {ip}")
    except socket.gaierror:
        raise ValidationError(f"Cannot resolve hostname: {parsed.hostname}")
    
    # Must not be localhost
    if parsed.hostname in ['localhost', '127.0.0.1', '0.0.0.0']:
        raise ValidationError(f"URL cannot be localhost: {url}")
    
    return True

def is_private_ip(ip_str):
    ip = ipaddress.ip_address(ip_str)
    return ip.is_private or ip.is_loopback or ip.is_link_local
```

### 5.3 WhatsApp Business Platform Constraints

**Message Constraints:**

| Constraint | Value | Enforcement |
|------------|-------|-------------|
| Text max length | 4096 characters | Hard limit, reject if exceeded |
| Caption max length | 1024 characters | Hard limit, truncate or reject |
| Media URL max length | 2048 characters | Hard limit, reject if exceeded |
| Filename max length | 240 characters | Recommended, log warning if exceeded |

**24-Hour Session Window Validation (Optional):**

```python
# Pseudo-code
def validate_session_window(wa_id, tenant_id):
    # Check if there's an active 24-hour session
    # This requires state from conversation history (external service)
    
    if config.ENFORCE_SESSION_WINDOW:
        last_inbound_time = get_last_inbound_message_time(wa_id, tenant_id)
        
        if last_inbound_time is None:
            # No previous inbound message = no session
            log_warning("No active session window",
                        wa_id=wa_id,
                        recommendation="Use message template")
            return False
        
        time_since_last_inbound = time.time() - last_inbound_time
        
        if time_since_last_inbound > 86400:  # 24 hours
            log_warning("Session window expired",
                        wa_id=wa_id,
                        hours_since_inbound=time_since_last_inbound / 3600)
            return False
        
        return True
    
    return True  # Don't enforce if disabled
```

**Note:** Session window validation requires external state and may be handled by upstream services.

---

## 6. Error Handling

### 6.1 Error Classification

**Error Categories:**

| Category | Retry | ACK/NACK | DLQ | Examples |
|----------|-------|----------|-----|----------|
| **Client Error** | No | ACK | Yes | Invalid JSON, missing fields, bad UUID |
| **Validation Error** | No | ACK | Yes | Unsupported MIME, text too long, invalid URL |
| **Transient Error** | Yes | NACK | After max retries | Redis unavailable, HTTP 5xx, timeout |
| **Configuration Error** | No | ACK | Yes | Missing storage credentials, invalid config |

### 6.2 Retry Strategy

**Retry Policy:**
- Max retries: 3
- Backoff: Exponential (2s, 4s, 8s)
- Jitter: ±20% to prevent thundering herd

```python
# Pseudo-code
def retry_with_backoff(func, max_retries=3):
    for attempt in range(1, max_retries + 1):
        try:
            return func()
        except RetryableError as e:
            if attempt == max_retries:
                raise
            
            base_delay = 2 ** attempt  # 2, 4, 8 seconds
            jitter = random.uniform(-0.2, 0.2) * base_delay
            delay = base_delay + jitter
            
            log_warning(f"Retrying after {delay:.2f}s",
                        attempt=attempt,
                        max_retries=max_retries,
                        error=str(e))
            
            time.sleep(delay)
```

### 6.3 Error Response Format

**Structured Error Logging:**
```json
{
  "timestamp": "2024-02-12T10:30:45.123Z",
  "level": "ERROR",
  "service": "outbound-transformer",
  "version": "1.2.0",
  "error_type": "ValidationError",
  "error_message": "Unsupported MIME type: application/x-unknown",
  "context": {
    "internal_id": "uuid-msg-123",
    "tenant_id": "uuid-5678",
    "wa_id": "919876543210",
    "mime_type": "application/x-unknown",
    "stage": "media_transformation"
  },
  "stack_trace": "..."
}
```

---

## 7. Performance Requirements

### 7.1 Throughput Targets

| Metric | Minimum | Target | Notes |
|--------|---------|--------|-------|
| Messages/second (per instance) | 50 | 300 | Text messages |
| Messages/second (media) | 20 | 100 | Includes URL validation |
| Concurrent connections | 10 | 50 | RabbitMQ prefetch |

**Scaling Strategy:**
- Horizontal: Deploy multiple instances
- Vertical: Increase worker threads per instance
- Queue-based: Natural load distribution

### 7.2 Latency Targets

| Operation | Target | Maximum |
|-----------|--------|---------|
| Message consumption | < 1ms | 5ms |
| Schema validation | < 1ms | 3ms |
| Text transformation | < 1ms | 5ms |
| Media transformation | < 10ms | 50ms |
| URL validation | < 5ms | 20ms |
| Signed URL generation | < 10ms | 30ms |
| Queue publish | < 5ms | 20ms |
| **Total (text)** | **< 10ms** | **50ms** |
| **Total (media)** | **< 30ms** | **100ms** |

**Latency excludes:**
- Network latency to downstream services
- WhatsApp API processing time
- Queue delivery time

### 7.3 Resource Limits

**Memory:**
- Per instance: 512 MB - 2 GB
- Message buffer: Max 100 messages in memory
- Cache: 50 MB for idempotency keys

**CPU:**
- Per instance: 1-4 cores
- Target utilization: < 70%

**Network:**
- Bandwidth: 10 Mbps minimum
- Connections: Max 100 concurrent

---

## 8. Observability

### 8.1 Metrics (Prometheus Format)

**Message Processing Metrics:**
```
# Counter: Total messages processed
outbound_messages_processed_total{tenant_id="", type="text|image|video|document|audio", status="success|failure"}

# Counter: Invalid messages
outbound_invalid_messages_total{reason="invalid_json|missing_field|validation_error"}

# Counter: Duplicate messages
outbound_duplicate_messages_total{tenant_id=""}

# Counter: Media messages processed
outbound_media_processed_total{tenant_id="", media_type="image|video|document|audio"}

# Counter: Transformation failures
outbound_transformation_failures_total{tenant_id="", error_type=""}

# Counter: Dispatch failures
outbound_dispatch_failures_total{tenant_id="", error_type=""}

# Counter: DLQ messages
outbound_dlq_messages_total{tenant_id="", error_type=""}

# Counter: Cache errors
outbound_cache_errors_total{operation="get|set|delete"}

# Histogram: Transformation latency
outbound_transformation_latency_seconds{type="text|media"}

# Histogram: End-to-end latency
outbound_e2e_latency_seconds{type="text|media"}

# Gauge: Current queue depth
outbound_queue_depth{queue="outbound-processed|outbound-ready|outbound-transformer-dlq"}
```

### 8.2 Structured Logging

**Log Levels:**
- DEBUG: Detailed transformation steps
- INFO: Successful processing, dispatch
- WARN: Retries, degraded operation
- ERROR: Failed transformations, unrecoverable errors

**Required Fields in All Logs:**
```json
{
  "timestamp": "ISO-8601",
  "level": "INFO|WARN|ERROR",
  "service": "outbound-transformer",
  "version": "1.2.0",
  "tenant_id": "",
  "internal_id": "",
  "wa_id": "",
  "correlation_id": "",
  "message": "",
  "context": {}
}
```

### 8.3 Health Check Endpoint

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy|degraded|unhealthy",
  "version": "1.2.0",
  "checks": {
    "rabbitmq": {
      "status": "healthy",
      "latency_ms": 5
    },
    "redis": {
      "status": "healthy",
      "latency_ms": 2
    },
    "storage": {
      "status": "healthy",
      "latency_ms": 10
    }
  },
  "metrics": {
    "messages_processed_last_minute": 150,
    "avg_latency_ms": 25,
    "error_rate_percent": 0.5
  }
}
```

---

## 9. Implementation Guidelines

### 9.1 Code Structure Recommendations

```
outbound-transformer/
├── src/
│   ├── main.py                 # Application entry point
│   ├── config.py               # Configuration management
│   ├── models/
│   │   ├── input_message.py    # Input schema models
│   │   └── output_message.py   # Output schema models
│   ├── services/
│   │   ├── consumer.py         # RabbitMQ consumer
│   │   ├── transformer.py      # Core transformation logic
│   │   ├── validator.py        # Validation logic
│   │   ├── media_handler.py    # Media URL handling
│   │   ├── dispatcher.py       # Message dispatch
│   │   └── idempotency.py      # Idempotency cache
│   ├── utils/
│   │   ├── logger.py           # Structured logging
│   │   ├── metrics.py          # Prometheus metrics
│   │   └── url_utils.py        # URL parsing/validation
│   └── tests/
│       ├── unit/
│       └── integration/
├── config/
│   ├── config.yaml             # Configuration file
│   └── mime_types.yaml         # MIME type mappings
├── docker/
│   └── Dockerfile
├── kubernetes/
│   ├── deployment.yaml
│   └── service.yaml
└── README.md
```

### 9.2 Configuration Management

**Environment Variables:**
```bash
# RabbitMQ
RABBITMQ_HOST=rabbitmq.default.svc.cluster.local
RABBITMQ_PORT=5672
RABBITMQ_USER=transformer
RABBITMQ_PASSWORD=***
RABBITMQ_VHOST=/
RABBITMQ_PREFETCH_COUNT=10

# Queues
QUEUE_INPUT=outbound-processed
QUEUE_OUTPUT=outbound-ready
QUEUE_DLQ=outbound-transformer-dlq

# Redis
REDIS_HOST=redis.default.svc.cluster.local
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=***
IDEMPOTENCY_TTL_SECONDS=86400

# Storage
STORAGE_TYPE=minio  # or s3
STORAGE_ENDPOINT=https://minio.example.com
STORAGE_ACCESS_KEY=***
STORAGE_SECRET_KEY=***
SIGNED_URL_EXPIRATION_SECONDS=600

# WhatsApp API (for pipeline mode)
WHATSAPP_API_BASE_URL=http://whatsapp-api-service:8080
PIPELINE_MODE_ENABLED=false

# Behavior Configuration
UNSUPPORTED_MIME_BEHAVIOR=reject  # reject|convert_to_document|text_fallback
AUDIO_TEXT_BEHAVIOR=separate_message  # separate_message|discard_text|text_only
VALIDATE_URL_ACCESSIBILITY=false
ENFORCE_SESSION_WINDOW=false

# Performance
MAX_RETRIES=3
WORKER_THREADS=10
MAX_MESSAGE_BUFFER_SIZE=100

# Observability
LOG_LEVEL=INFO
METRICS_PORT=9090
HEALTH_CHECK_PORT=8080

# Alerts
ALERT_ON_DLQ=true
```

### 9.3 Testing Strategy

**Unit Tests:**
- Input validation logic
- Transformation logic (text, media)
- MIME type mapping
- URL validation and transformation
- Idempotency checking
- Error handling

**Integration Tests:**
- RabbitMQ message flow
- Redis cache operations
- Storage signed URL generation
- End-to-end transformation pipeline

**Test Cases to Cover:**
```python
# Pseudo test cases
def test_text_message_transformation():
    """Test basic text message transformation"""
    
def test_image_with_caption():
    """Test image message with caption"""
    
def test_document_without_filename():
    """Test document with auto-generated filename"""
    
def test_audio_with_text_separate_message():
    """Test audio + text creates two messages"""
    
def test_unsupported_mime_type_rejection():
    """Test unsupported MIME type is rejected"""
    
def test_internal_url_signed_url_generation():
    """Test internal URL converts to signed URL"""
    
def test_private_ip_rejection():
    """Test URLs resolving to private IPs are rejected"""
    
def test_idempotency_duplicate_detection():
    """Test duplicate messages are ACKed without processing"""
    
def test_max_retries_route_to_dlq():
    """Test failures route to DLQ after max retries"""
    
def test_text_exceeds_max_length():
    """Test text over 4096 chars is rejected"""
    
def test_empty_text_and_no_media_rejection():
    """Test messages with neither text nor media are rejected"""
```

### 9.4 Deployment Checklist

**Pre-Deployment:**
- [ ] Configuration files reviewed and validated
- [ ] RabbitMQ queues created
- [ ] Redis cache accessible
- [ ] Storage credentials configured
- [ ] Metrics endpoint accessible
- [ ] Health check endpoint responding
- [ ] Unit tests passing (100% coverage for core logic)
- [ ] Integration tests passing

**Post-Deployment:**
- [ ] Monitor metrics dashboard
- [ ] Check DLQ for unexpected messages
- [ ] Verify latency targets met
- [ ] Confirm no memory leaks (monitor over 24h)
- [ ] Test graceful shutdown
- [ ] Validate idempotency across restarts

### 9.5 Operational Runbook

**Common Issues:**

| Issue | Diagnosis | Resolution |
|-------|-----------|------------|
| High DLQ rate | Check DLQ messages for patterns | Fix upstream data issues or adjust validation |
| Redis connection errors | Check Redis health | Restart Redis, check network |
| Slow transformation | Check signed URL generation time | Optimize storage client, increase timeout |
| Queue backlog | Check consumer lag | Scale up instances |
| Memory growth | Check for leaks | Review message buffering, restart service |

**Monitoring Dashboards:**
- Message throughput (msg/sec)
- Latency percentiles (p50, p95, p99)
- Error rates by type
- DLQ depth
- Cache hit rate
- Queue depth

---

## 10. Security Considerations

### 10.1 Secrets Management
- Store credentials in secrets manager (Kubernetes Secrets, AWS Secrets Manager)
- Rotate credentials regularly
- Never log credentials or tokens

### 10.2 URL Validation
- Prevent SSRF attacks via private IP blocking
- Validate URL schemes (HTTPS only)
- Consider URL allow-listing for extra security

### 10.3 Data Privacy
- Log minimal PII (hash `waId` in logs if required)
- Respect GDPR/data retention policies
- Secure signed URLs with short expiration

---

## Appendix A: Complete MIME Type Support Matrix

| MIME Type | WhatsApp Type | Max Size | File Extensions | Notes |
|-----------|---------------|----------|----------------|-------|
| `image/jpeg` | image | 5 MB | .jpg, .jpeg | Recommended |
| `image/png` | image | 5 MB | .png | Recommended |
| `image/webp` | image | 5 MB | .webp | Supported |
| `video/mp4` | video | 16 MB | .mp4 | H.264 codec |
| `video/3gpp` | video | 16 MB | .3gp | Basic support |
| `application/pdf` | document | 100 MB | .pdf | Most common |
| `application/vnd.ms-powerpoint` | document | 100 MB | .ppt | Office 97-2003 |
| `application/vnd.openxmlformats-officedocument.presentationml.presentation` | document | 100 MB | .pptx | Office 2007+ |
| `application/msword` | document | 100 MB | .doc | Office 97-2003 |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | document | 100 MB | .docx | Office 2007+ |
| `application/vnd.ms-excel` | document | 100 MB | .xls | Office 97-2003 |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | document | 100 MB | .xlsx | Office 2007+ |
| `text/plain` | document | 100 MB | .txt | Plain text |
| `text/csv` | document | 100 MB | .csv | CSV files |
| `audio/aac` | audio | 16 MB | .aac | Recommended |
| `audio/mp4` | audio | 16 MB | .m4a | M4A format |
| `audio/mpeg` | audio | 16 MB | .mp3 | MP3 format |
| `audio/amr` | audio | 16 MB | .amr | AMR format |
| `audio/ogg` | audio | 16 MB | .ogg | Opus codec |

---

## Appendix B: Error Code Reference

| Error Code | Description | Category | User Action |
|------------|-------------|----------|-------------|
| `E001` | Invalid JSON format | Client | Fix message format |
| `E002` | Missing required field | Client | Add required field |
| `E003` | Invalid UUID format | Client | Use valid UUID v4 |
| `E004` | Invalid WhatsApp ID format | Client | Use E.164 format |
| `E005` | Text exceeds max length | Validation | Shorten text to 4096 chars |
| `E006` | Empty message (no text or media) | Validation | Add content |
| `E007` | Unsupported MIME type | Validation | Use supported media type |
| `E008` | Invalid media URL | Validation | Provide valid HTTPS URL |
| `E009` | Private IP in URL | Validation | Use public URL |
| `E010` | Redis connection failure | Transient | Retry |
| `E011` | Storage service unavailable | Transient | Retry |
| `E012` | Downstream service timeout | Transient | Retry |
| `E013` | Unknown transformation error | Internal | Contact support |

---

This document provides comprehensive specifications for implementing the Outbound Transformer Service with all necessary details for code generation, debugging, and operational management.