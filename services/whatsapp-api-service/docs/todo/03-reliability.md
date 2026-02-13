# Phase 3: Reliability & Tenant Isolation

**Priority:** 🟠 High (MVP Required)  
**Dependencies:** 02-core-features.md  
**Estimated Effort:** 3-4 days  

---

## Overview
Implement tenant isolation mechanisms and reliability features to ensure one tenant's failures don't impact others and the service can handle production load safely.

---

## Tasks

### 3.1 Per-Tenant Circuit Breakers

#### 3.1.1 Create Circuit Breaker Service

**Files to Create:**
- `src/services/circuit-breaker.service.js`

**Implementation Requirements:**
```javascript
class CircuitBreakerService {
  constructor(threshold = 5, timeout = 60000) {
    this.breakers = new Map();  // tenantId -> CircuitBreaker
    this.threshold = threshold;  // failures before opening
    this.timeout = timeout;      // milliseconds before half-open
  }
  
  // Methods
  async execute(tenantId, fn) // Execute with circuit protection
  recordSuccess(tenantId)
  recordFailure(tenantId)
  getState(tenantId) // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  reset(tenantId)
  getStats(tenantId)
}
```

**Circuit Breaker States:**
```
CLOSED (normal) → failures++ → OPEN (failing) → timeout → HALF_OPEN (testing) → success → CLOSED
                                                                              → failure → OPEN
```

**Breaker Structure:**
```javascript
{
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN',
  failureCount: number,
  lastFailureTime: number,
  threshold: 5,        // open after 5 failures
  timeout: 60000       // try again after 1 minute
}
```

**Acceptance Criteria:**
- ✅ Circuit opens after 5 consecutive failures
- ✅ Circuit enters half-open after 1 minute
- ✅ Successful call in half-open closes circuit
- ✅ Failed call in half-open reopens circuit
- ✅ Each tenant has independent breaker

---

#### 3.1.2 Integrate Circuit Breaker with WhatsApp Service

**Files to Update:**
- `src/services/whatsapp.service.js`

**Enhanced `_makeRequest`:**
```javascript
async _makeRequest(tenantId, method, endpoint, data) {
  // Wrap in circuit breaker
  return circuitBreaker.execute(tenantId, async () => {
    // Existing retry logic and API call
    return this._makeHttpRequest(...);
  });
}
```

**Error Handling:**
```javascript
// On success
circuitBreaker.recordSuccess(tenantId);

// On failure
circuitBreaker.recordFailure(tenantId);

// If circuit is open
throw new CircuitBreakerOpenError(
  `Circuit breaker open for tenant ${tenantId}`
);
```

**Acceptance Criteria:**
- ✅ All Meta API calls protected by circuit breaker
- ✅ Open circuits reject requests immediately
- ✅ Failures isolated per tenant
- ✅ Circuit state logged

---

### 3.2 Per-Tenant Rate Limiting

#### 3.2.1 Create Rate Limiter Service

**Files to Create:**
- `src/services/rate-limiter.service.js`

**Implementation Requirements:**
```javascript
class RateLimiterService {
  constructor() {
    this.limiters = new Map();  // tenantId -> RateLimiter
  }
  
  // Methods
  async checkRateLimit(tenantId) // Returns true if allowed
  consumeToken(tenantId)
  getOrCreateLimiter(tenantId)
  refillTokens(tenantId)
  getAvailableTokens(tenantId)
}
```

**Token Bucket Algorithm:**
```javascript
{
  tokens: 80,              // current tokens
  maxTokens: 80,           // Meta Tier 2 limit
  refillRate: 80 / 60,     // 80 msg/min = 1.33/sec
  lastRefill: timestamp
}
```

**Token Refill Logic:**
```javascript
const elapsed = (now - lastRefill) / 1000;  // seconds
const tokensToAdd = elapsed * refillRate;
tokens = Math.min(tokens + tokensToAdd, maxTokens);
```

**Acceptance Criteria:**
- ✅ Token bucket implemented per tenant
- ✅ Tokens refill at 1.33/second (80/min)
- ✅ Max 80 tokens (Tier 2 limit)
- ✅ Rate limit checked before sending
- ✅ Independent limits per tenant

---

#### 3.2.2 Integrate Rate Limiter with Message Processor

**Files to Update:**
- `src/processors/message.processor.js`

**Rate Limit Check Before Sending:**
```javascript
async process(message) {
  const { metadata, wabaPayload } = message;
  
  // 1. Check rate limit
  const allowed = await rateLimiter.checkRateLimit(metadata.tenantId);
  
  if (!allowed) {
    throw new RateLimitExceededError(
      `Rate limit exceeded for tenant ${metadata.tenantId}`
    );
  }
  
  // 2. Consume token
  rateLimiter.consumeToken(metadata.tenantId);
  
  // 3. Process message...
}
```

**Rate Limit Error Handling:**
```javascript
// In consumer error handler
if (error instanceof RateLimitExceededError) {
  // NACK with delay (requeue after 10 seconds)
  const delay = 10000;
  await this.rejectMessage(msg, true, delay);
  
  Logger.warn('Rate limit exceeded', {
    tenantId: metadata.tenantId,
    delayMs: delay
  });
}
```

**Acceptance Criteria:**
- ✅ Rate limit checked before message processing
- ✅ Token consumed on allowed requests
- ✅ Rate limit errors trigger delayed requeue
- ✅ No impact on other tenants

---

### 3.3 Enhanced Logging

#### 3.3.1 Update Logger with Structured Logging

**Files to Update:**
- `src/utils/logger.js`

**Enhanced Log Structure:**
```javascript
{
  timestamp: '2024-02-12T10:30:00.000Z',
  level: 'INFO' | 'WARN' | 'ERROR',
  service: 'whatsapp-api-service',
  version: '1.1.0',
  event: string,
  tenantId?: string,
  internalId?: string,
  wamid?: string,
  duration?: number,
  errorCode?: string,
  errorSubcode?: string,
  fbtrace?: string,
  retryCount?: number,
  circuitState?: string,
  rateLimit?: { available: number, max: number }
}
```

**Key Events to Log:**
```javascript
// Success
Logger.info('message_delivered', {
  tenantId,
  internalId,
  wamid,
  duration: 250
});

// Auth error
Logger.error('meta_api_auth_error', {
  tenantId,
  internalId,
  errorCode: 190,
  fbtrace: 'ABC123',
  cacheInvalidated: true
});

// Circuit breaker
Logger.warn('circuit_breaker_opened', {
  tenantId,
  failureCount: 5,
  state: 'OPEN'
});

// Rate limit
Logger.warn('rate_limit_exceeded', {
  tenantId,
  available: 0,
  max: 80,
  delayMs: 10000
});
```

**Acceptance Criteria:**
- ✅ All logs in structured JSON format
- ✅ Key events logged (delivery, errors, circuit, rate limit)
- ✅ Sensitive data (tokens) never logged
- ✅ WAMID logged for successful deliveries
- ✅ Error codes and fbtrace logged

---

#### 3.3.2 Implement Log Sanitization

**Files to Create:**
- `src/utils/log-sanitizer.js`

**Implementation:**
```javascript
function sanitizeLog(obj) {
  const sensitive = [
    'token', 'accessToken', 'systemUserAccessToken', 
    'password', 'secret', 'authorization'
  ];
  
  return Object.keys(obj).reduce((acc, key) => {
    if (sensitive.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      acc[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      acc[key] = sanitizeLog(obj[key]);
    } else {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
}
```

**Apply to Logger:**
```javascript
class Logger {
  static log(level, message, data) {
    const sanitized = logSanitizer.sanitize(data);
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...sanitized
    }));
  }
}
```

**Acceptance Criteria:**
- ✅ Tokens never appear in logs
- ✅ Passwords redacted
- ✅ Other sensitive fields redacted
- ✅ Nested objects sanitized

---

### 3.4 Backpressure Mechanism

#### 3.4.1 Implement Queue Backpressure

**Files to Update:**
- `src/consumers/message-queue.consumer.js`

**Backpressure Logic:**
```javascript
async checkBackpressure() {
  const queueDepth = await rabbitmqService.getQueueDepth();
  
  if (queueDepth > 1000) {
    // Reduce prefetch count
    await this.setPrefetchCount(5);
    Logger.warn('High queue depth, reducing prefetch', { queueDepth });
  } else if (queueDepth < 100) {
    // Restore prefetch count
    await this.setPrefetchCount(10);
  }
}
```

**Dynamic Prefetch Adjustment:**
```javascript
// Check backpressure every 30 seconds
setInterval(() => this.checkBackpressure(), 30000);
```

**Acceptance Criteria:**
- ✅ Queue depth monitored
- ✅ Prefetch reduced when queue > 1000
- ✅ Prefetch restored when queue < 100
- ✅ Changes logged

---

## Verification Plan

### Unit Tests
```bash
npm test -- src/services/circuit-breaker.service.test.js
npm test -- src/services/rate-limiter.service.test.js
npm test -- src/utils/log-sanitizer.test.js
```

**Test Scenarios:**
- ✅ Circuit breaker state transitions
- ✅ Token bucket refill logic
- ✅ Rate limit enforcement
- ✅ Log sanitization

### Integration Tests
```bash
npm test -- tests/integration/tenant-isolation.test.js
```

**Scenarios:**
- ✅ Tenant A rate limited → Tenant B unaffected
- ✅ Tenant A circuit open → Tenant B unaffected
- ✅ Concurrent requests from multiple tenants

### Load Testing
```bash
npm test -- tests/load/rate-limit.test.js
```

**Test:**
- Send 100 messages/sec for one tenant
- Expected: Rate limit enforced at 80/min
- Verify: Messages queued, no Meta API throttling

### Manual Testing
```bash
# 1. Test circuit breaker
# Send 5 failing messages for tenant A
# Expected: Circuit opens, subsequent messages rejected

# 2. Test rate limiting
# Send 100 messages quickly for tenant A
# Expected: Rate limited at 80/min

# 3. Test tenant isolation
# Open circuit for tenant A, send message for tenant B
# Expected: Tenant B message succeeds
```

---

## Dependencies Introduced
None

## Files Created
- `src/services/circuit-breaker.service.js`
- `src/services/rate-limiter.service.js`
- `src/utils/log-sanitizer.js`

## Files Modified
- `src/services/whatsapp.service.js`
- `src/processors/message.processor.js`
- `src/consumers/message-queue.consumer.js`
- `src/utils/logger.js`

## Breaking Changes
None

---

## Next Steps
After completing this phase → Proceed to **04-observability.md** (Metrics + Health checks)
