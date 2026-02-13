# Phase 2: Core Features

**Priority:** 🔴 Critical (MVP Required)  
**Dependencies:** 01-infrastructure.md  
**Estimated Effort:** 4-5 days  

---

## Overview
Implement the core business logic for credential management, error handling, and message processing. This phase ensures reliable message delivery with proper error recovery.

---

## Tasks

### 2.1 Credential Caching System

#### 2.1.1 Create Credential Cache Service

**Files to Create:**
- `src/services/credential-cache.service.js`

**Implementation Requirements:**
```javascript
class CredentialCacheService {
  constructor(ttl = 900000) // 15 minutes default
  
  // Methods
  async get(tenantId) // Get cached/fetch credentials
  set(tenantId, credentials) // Cache credentials
  invalidate(tenantId) // Remove from cache
  has(tenantId) // Check if cached
  isExpired(tenantId) // Check TTL
  clear() // Clear all cache
}
```

**Cache Structure:**
```javascript
{
  [tenantId]: {
    token: string,
    phoneNumberId: string,
    cachedAt: number,
    ttl: number
  }
}
```

**Features:**
- In-memory Map-based storage
- TTL management (15 minutes default)
- Automatic expiration checking
- Thread-safe operations

**Acceptance Criteria:**
- ✅ Credentials cached for 15 minutes
- ✅ Expired entries automatically ignored
- ✅ Cache can be invalidated per tenant
- ✅ Cache cleared on service restart

---

#### 2.1.2 Update Tenant Service Integration

**Files to Update:**
- `src/services/tenant.service.js`

**Changes:**
1. Integrate credential cache
2. Implement retry logic (3 attempts)
3. Add timeout handling (5s)
4. Proper error classification

**Enhanced Logic:**
```javascript
async getWhatsAppCredentials(tenantId) {
  // 1. Check cache
  const cached = await cache.get(tenantId);
  if (cached && !cache.isExpired(tenantId)) {
    return cached;
  }
  
  // 2. Fetch from Tenant Service with retry
  const credentials = await this._fetchWithRetry(tenantId);
  
  // 3. Cache for 15 minutes
  cache.set(tenantId, credentials);
  
  return credentials;
}

async _fetchWithRetry(tenantId, maxRetries = 3) {
  // Implement exponential backoff retry
}
```

**Error Scenarios:**
| Error | HTTP Code | Action |
|-------|-----------|--------|
| Tenant Not Found | 404 | Throw error (don't cache) |
| Credentials Suspended | 403 | Throw error (don't cache) |
| Service Timeout | 408/504 | Retry 3 times |
| Server Error | 500 | Retry 3 times |

**Acceptance Criteria:**
- ✅ Cache checked before fetching
- ✅ Credentials cached on successful fetch
- ✅ 3 retry attempts on transient errors
- ✅ No caching on 404/403 errors

---

### 2.2 Meta API Error Handling

#### 2.2.1 Create Error Classification Module

**Files to Create:**
- `src/utils/error-classifier.js`

**Implementation Requirements:**
```javascript
class MetaErrorClassifier {
  static classify(error) // Returns error category
  static isRetryable(error) // Boolean
  static isAuthError(error) // Boolean
  static isRateLimitError(error) // Boolean
  static isClientError(error) // Boolean
  static shouldNotify(error) // Boolean for alerting
}
```

**Error Classification Matrix:**
```javascript
const ERROR_TYPES = {
  // Retryable
  META_SERVER_ERROR: { codes: [500, 502, 503, 504], retry: true },
  NETWORK_ERROR: { codes: ['ECONNREFUSED', 'ETIMEDOUT'], retry: true },
  AUTH_ERROR: { codes: [401, 190], retry: true, maxRetries: 1, invalidateCache: true },
  RATE_LIMIT: { codes: [429, 4], retry: true, backoff: 10000 },
  MEDIA_DOWNLOAD_FAILED: { subcode: 2388005, retry: true, maxRetries: 1 },
  
  // Non-retryable
  INVALID_PHONE: { subcode: 2388003, retry: false },
  TEMPLATE_NOT_FOUND: { subcode: 2388001, retry: false, alert: true },
  TEMPLATE_PARAMS_MISMATCH: { subcode: 2388002, retry: false },
  RECIPIENT_NOT_ON_WHATSAPP: { subcode: 2388009, retry: false },
  WINDOW_EXPIRED: { code: 131047, retry: false, notify: true },
  PHONE_NOT_REGISTERED: { subcode: 2388054, retry: false, alert: true }
};
```

**Acceptance Criteria:**
- ✅ All error codes from FRD classified
- ✅ Retryable errors identified correctly
- ✅ Auth errors trigger cache invalidation
- ✅ Critical errors flagged for alerting

---

#### 2.2.2 Create Retry Handler with Exponential Backoff

**Files to Create:**
- `src/utils/retry-handler.js`

**Implementation Requirements:**
```javascript
class RetryHandler {
  static async executeWithRetry(fn, options) {
    // fn: Function to execute
    // options: { maxRetries, baseDelay, errorClassifier }
  }
  
  static calculateBackoff(attempt, baseDelay = 1000) {
    const maxDelay = 60000; // 1 minute
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    return delay + jitter;
  }
}
```

**Backoff Algorithm:**
```
Attempt 1: 1000ms + jitter
Attempt 2: 2000ms + jitter
Attempt 3: 4000ms + jitter
Attempt 4: 8000ms + jitter
Attempt 5: 16000ms + jitter
Attempt 6+: 60000ms + jitter
```

**Acceptance Criteria:**
- ✅ Exponential backoff implemented
- ✅ Jitter added to prevent thundering herd
- ✅ Max delay capped at 60s
- ✅ Retry count configurable
- ✅ Errors classified before retry

---

#### 2.2.3 Update WhatsApp Service with Error Handling

**Files to Update:**
- `src/services/whatsapp.service.js`

**Changes:**
1. Wrap `_makeRequest` with retry handler
2. Parse Meta API errors
3. Classify errors
4. Handle auth errors (invalidate cache)
5. Implement proper logging

**Enhanced `_makeRequest`:**
```javascript
async _makeRequest(tenantId, method, endpoint, data, retryCount = 0) {
  try {
    const credentials = await tenantService.getWhatsAppCredentials(tenantId);
    
    const response = await RetryHandler.executeWithRetry(
      () => this._makeHttpRequest(credentials, method, endpoint, data),
      {
        maxRetries: config.metaApi.maxRetries,
        baseDelay: config.metaApi.retryDelay,
        errorClassifier: MetaErrorClassifier,
        onRetry: (attempt, error) => {
          Logger.warn('Retrying Meta API request', { attempt, error });
        }
      }
    );
    
    return response.data;
    
  } catch (error) {
    const classified = MetaErrorClassifier.classify(error);
    
    // Invalidate cache on auth errors
    if (classified.isAuthError) {
      await credentialCache.invalidate(tenantId);
    }
    
    // Log structured error
    Logger.error('Meta API error', {
      tenantId,
      errorCode: error.response?.data?.error?.code,
      errorSubcode: error.response?.data?.error?.error_subcode,
      errorType: classified.type,
      retryable: classified.retryable
    });
    
    throw error;
  }
}
```

**Acceptance Criteria:**
- ✅ All Meta API calls use retry handler
- ✅ Errors classified and logged
- ✅ Auth errors invalidate cache
- ✅ Retryable errors retry with backoff
- ✅ Non-retryable errors fail fast

---

### 2.3 Message Processing Pipeline

#### 2.3.1 Create Message Processor

**Files to Create:**
- `src/processors/message.processor.js`

**Implementation Requirements:**
```javascript
class MessageProcessor {
  async process(message) {
    // 1. Extract metadata and payload
    const { metadata, wabaPayload } = message;
    
    // 2. Validate message structure
    this._validate(metadata, wabaPayload);
    
    // 3. Send to Meta API via WhatsApp service
    const result = await this._sendToMeta(
      metadata.tenantId,
      metadata.phoneNumberId,
      wabaPayload
    );
    
    // 4. Log success with WAMID
    this._logSuccess(metadata, result);
    
    return result;
  }
  
  async _sendToMeta(tenantId, phoneNumberId, payload) {
    // Route to appropriate method based on payload.type
  }
  
  _validate(metadata, payload) {
    // Validate required fields
  }
  
  _logSuccess(metadata, result) {
    // Log with WAMID for tracking
  }
}
```

**Message Type Routing:**
```javascript
switch (wabaPayload.type) {
  case 'text':
    return whatsappService.sendText(...);
  case 'template':
    return whatsappService.sendTemplate(...);
  case 'image':
    return whatsappService.sendImage(...);
  // ... other types
}
```

**Acceptance Criteria:**
- ✅ Message validation implemented
- ✅ Type-based routing works
- ✅ Success logged with WAMID
- ✅ Errors propagated with context

---

#### 2.3.2 Update Message Queue Consumer

**Files to Update:**
- `src/consumers/message-queue.consumer.js`

**Integration with Processor:**
```javascript
async processMessage(msg) {
  try {
    // 1. Parse message
    const payload = JSON.parse(msg.content.toString());
    
    // 2. Process message
    const result = await messageProcessor.process(payload);
    
    // 3. ACK on success
    await this.acknowledgeMessage(msg);
    
    Logger.info('Message processed successfully', {
      internalId: payload.metadata.internalId,
      wamid: result.messages[0].id
    });
    
  } catch (error) {
    await this.handleError(msg, error);
  }
}

async handleError(msg, error) {
  const payload = JSON.parse(msg.content.toString());
  const classified = MetaErrorClassifier.classify(error);
  
  if (classified.retryable) {
    // NACK with requeue
    await this.rejectMessage(msg, true);
  } else {
    // NACK without requeue (goes to DLQ)
    await this.rejectMessage(msg, false);
  }
  
  Logger.error('Message processing failed', {
    internalId: payload.metadata.internalId,
    errorType: classified.type,
    retryable: classified.retryable
  });
}
```

**Acceptance Criteria:**
- ✅ Processor integrated with consumer
- ✅ Success → ACK
- ✅ Retryable error → NACK with requeue
- ✅ Non-retryable error → NACK to DLQ
- ✅ All errors logged with context

---

### 2.4 Dead Letter Queue Configuration

#### 2.4.1 Configure DLQ in RabbitMQ Service

**Files to Update:**
- `src/services/rabbitmq.service.js`

**DLQ Setup:**
```javascript
async setupQueues() {
  // 1. Create DLX and DLQ
  await channel.assertExchange('whatsapp-dlx', 'topic', { durable: true });
  await channel.assertQueue('outbound-failed', { durable: true });
  await channel.bindQueue('outbound-failed', 'whatsapp-dlx', 'outbound.failed');
  
  // 2. Configure main queue with DLX
  await channel.assertQueue('outbound-processed', {
    durable: true,
    deadLetterExchange: 'whatsapp-dlx',
    deadLetterRoutingKey: 'outbound.failed',
    messageTtl: 86400000 // 24 hours
  });
}
```

**Acceptance Criteria:**
- ✅ DLX exchange created
- ✅ DLQ queue created
- ✅ Main queue configured with DLX
- ✅ Failed messages route to DLQ

---

## Verification Plan

### Unit Tests
```bash
npm test -- src/services/credential-cache.service.test.js
npm test -- src/utils/error-classifier.test.js
npm test -- src/utils/retry-handler.test.js
npm test -- src/processors/message.processor.test.js
```

**Test Scenarios:**
- ✅ Credential caching and expiration
- ✅ Error classification for all error codes
- ✅ Retry backoff calculation
- ✅ Message processing success path
- ✅ Message processing error paths

### Integration Tests
```bash
# Test credential caching
npm test -- tests/integration/credential-cache.test.js

# Test error handling
npm test -- tests/integration/error-handling.test.js

# Test DLQ routing
npm test -- tests/integration/dlq.test.js
```

**Scenarios:**
- ✅ Credentials cached and reused
- ✅ Cache invalidated on 401 error
- ✅ Retryable errors retry correctly
- ✅ Non-retryable errors go to DLQ
- ✅ DLQ receives failed messages

### Manual Testing
```bash
# 1. Test successful message flow
curl -X POST http://localhost:15672/api/exchanges/%2Fwhatsapp/whatsapp-exchange/publish \
  -u guest:guest \
  -H "Content-Type: application/json" \
  -d '{
    "routing_key": "outbound.processed.test-tenant",
    "payload": "<valid_message_json>"
  }'

# Expected: Message delivered, ACK'd, WAMID logged

# 2. Test error handling (invalid phone)
# Publish message with invalid phone number
# Expected: Message NACK'd to DLQ

# 3. Test retry logic (simulate 500 error)
# Mock Meta API to return 500
# Expected: Message retries 3 times then DLQ
```

---

## Dependencies Introduced
None (uses existing dependencies)

## Files Created
- `src/services/credential-cache.service.js`
- `src/utils/error-classifier.js`
- `src/utils/retry-handler.js`
- `src/processors/message.processor.js`

## Files Modified
- `src/services/tenant.service.js`
- `src/services/whatsapp.service.js`
- `src/consumers/message-queue.consumer.js`
- `src/services/rabbitmq.service.js`

## Breaking Changes
None

---

## Next Steps
After completing this phase → Proceed to **03-reliability.md** (Tenant isolation + Rate limiting)
