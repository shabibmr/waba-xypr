# Phase 5: Testing & Quality Assurance

**Priority:** 🟢 Low (Quality Assurance)  
**Dependencies:** 01, 02, 03, 04  
**Estimated Effort:** 5-7 days  

---

## Overview
Implement comprehensive test coverage as specified in FRD Section 6. This ensures code quality, reliability, and confidence in deployments.

---

## Tasks

### 5.1 Unit Tests

#### 5.1.1 Test Infrastructure Setup

**Files to Update:**
- `jest.config.js`

**Enhanced Configuration:**
```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: ['**/tests/unit/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup.js']
};
```

---

#### 5.1.2 Service Tests

**Files to Create:**
- `tests/unit/services/rabbitmq.service.test.js`
- `tests/unit/services/credential-cache.service.test.js`
- `tests/unit/services/circuit-breaker.service.test.js`
- `tests/unit/services/rate-limiter.service.test.js`
- `tests/unit/services/whatsapp.service.test.js`

**Example: Credential Cache Tests**
```javascript
describe('CredentialCacheService', () => {
  test('should cache credentials with TTL', async () => {
    const cache = new CredentialCacheService(1000); // 1s TTL
    
    const credentials = { token: 'abc', phoneNumberId: '123' };
    cache.set('tenant-1', credentials);
    
    expect(cache.get('tenant-1')).toEqual(credentials);
  });
  
  test('should expire credentials after TTL', async () => {
    const cache = new CredentialCacheService(100); // 100ms TTL
    
    cache.set('tenant-1', { token: 'abc' });
    await new Promise(r => setTimeout(r, 150));
    
    expect(cache.isExpired('tenant-1')).toBe(true);
  });
  
  test('should invalidate specific tenant', () => {
    const cache = new CredentialCacheService();
    cache.set('tenant-1', { token: 'abc' });
    cache.set('tenant-2', { token: 'def' });
    
    cache.invalidate('tenant-1');
    
    expect(cache.has('tenant-1')).toBe(false);
    expect(cache.has('tenant-2')).toBe(true);
  });
});
```

**Coverage Target:** 80% minimum

---

#### 5.1.3 Utility Tests

**Files to Create:**
- `tests/unit/utils/error-classifier.test.js`
- `tests/unit/utils/retry-handler.test.js`
- `tests/unit/utils/log-sanitizer.test.js`

**Example: Error Classifier Tests**
```javascript
describe('MetaErrorClassifier', () => {
  test('should classify 401 as auth error', () => {
    const error = { response: { status: 401, data: { error: { code: 190 } } } };
    
    const classified = MetaErrorClassifier.classify(error);
    
    expect(classified.type).toBe('AUTH_ERROR');
    expect(classified.retryable).toBe(true);
    expect(classified.invalidateCache).toBe(true);
  });
  
  test('should classify 2388003 as non-retryable', () => {
    const error = {
      response: {
        status: 400,
        data: { error: { code: 100, error_subcode: 2388003 } }
      }
    };
    
    const classified = MetaErrorClassifier.classify(error);
    
    expect(classified.type).toBe('INVALID_PHONE');
    expect(classified.retryable).toBe(false);
  });
  
  test('should classify 500 as retryable', () => {
    const error = { response: { status: 500 } };
    
    const classified = MetaErrorClassifier.classify(error);
    
    expect(classified.retryable).toBe(true);
  });
});
```

---

#### 5.1.4 Processor Tests

**Files to Create:**
- `tests/unit/processors/message.processor.test.js`

**Test Scenarios:**
```javascript
describe('MessageProcessor', () => {
  test('should process text message successfully', async () => {
    const message = {
      metadata: { tenantId: 'test', phoneNumberId: '123', internalId: 'msg-1' },
      wabaPayload: { type: 'text', to: '919876543210', text: { body: 'Hello' } }
    };
    
    whatsappService.sendText = jest.fn().mockResolvedValue({
      messages: [{ id: 'wamid.123' }]
    });
    
    const result = await messageProcessor.process(message);
    
    expect(result.messages[0].id).toBe('wamid.123');
  });
  
  test('should handle template not found error', async () => {
    const message = {
      metadata: { tenantId: 'test', phoneNumberId: '123' },
      wabaPayload: { type: 'template', templateName: 'missing' }
    };
    
    whatsappService.sendTemplate = jest.fn().mockRejectedValue(
      createMetaError(100, 2388001)
    );
    
    await expect(messageProcessor.process(message)).rejects.toThrow();
  });
});
```

---

### 5.2 Integration Tests

#### 5.2.1 End-to-End Message Flow

**Files to Create:**
- `tests/integration/message-flow.test.js`

**Test Scenario:**
```javascript
describe('End-to-End Message Flow', () => {
  test('should consume from queue and deliver to Meta API', async () => {
    // 1. Start service
    await startService();
    
    // 2. Publish message to queue
    await rabbitmqClient.publish('outbound-processed', {
      metadata: { tenantId: 'test', phoneNumberId: '123', internalId: 'msg-1' },
      wabaPayload: { type: 'text', to: '919876543210', text: { body: 'Test' } }
    });
    
    // 3. Mock Meta API response
    nock('https://graph.facebook.com')
      .post('/v18.0/123/messages')
      .reply(200, { messages: [{ id: 'wamid.123' }] });
    
    // 4. Wait for processing
    await waitFor(() => logContains('message_delivered'));
    
    // 5. Verify message ACK'd
    const queueDepth = await rabbitmqClient.getQueueDepth();
    expect(queueDepth).toBe(0);
  });
});
```

---

#### 5.2.2 Error Handling Tests

**Files to Create:**
- `tests/integration/error-handling.test.js`

**Test Scenarios:**
```javascript
describe('Error Handling Integration', () => {
  test('should retry on 500 error and eventually succeed', async () => {
    nock('https://graph.facebook.com')
      .post('/v18.0/123/messages')
      .reply(500)
      .post('/v18.0/123/messages')
      .reply(200, { messages: [{ id: 'wamid.123' }] });
    
    // Publish message
    // Expected: Retry once, then succeed, message ACK'd
  });
  
  test('should send to DLQ on non-retryable error', async () => {
    nock('https://graph.facebook.com')
      .post('/v18.0/123/messages')
      .reply(400, { error: { code: 100, error_subcode: 2388003 } });
    
    // Publish message
    // Expected: Message NACK'd to DLQ immediately
  });
  
  test('should invalidate cache on 401 error', async () => {
    nock('https://graph.facebook.com')
      .post('/v18.0/123/messages')
      .reply(401, { error: { code: 190 } });
    
    // Expected: Cache invalidated, message requeued
  });
});
```

---

#### 5.2.3 Tenant Isolation Tests

**Files to Create:**
- `tests/integration/tenant-isolation.test.js`

**Test Scenarios:**
```javascript
describe('Tenant Isolation', () => {
  test('circuit breaker for tenant A does not affect tenant B', async () => {
    // 1. Open circuit for tenant A (5 failures)
    for (let i = 0; i < 5; i++) {
      await sendFailingMessageForTenant('tenant-a');
    }
    
    // 2. Send message for tenant B
    const success = await sendMessageForTenant('tenant-b');
    
    expect(success).toBe(true);
  });
  
  test('rate limit for tenant A does not affect tenant B', async () => {
    // 1. Exhaust rate limit for tenant A
    await sendBurstForTenant('tenant-a', 100);
    
    // 2. Send message for tenant B
    const success = await sendMessageForTenant('tenant-b');
    
    expect(success).toBe(true);
  });
});
```

---

### 5.3 Load Tests

#### 5.3.1 Setup Load Testing Framework

```bash
npm install --save-dev artillery
```

**Files to Create:**
- `tests/load/config.yml`

```yaml
config:
  target: 'http://localhost:5672'
  phases:
    - duration: 60
      arrivalRate: 50
      name: "Sustained load"
  processor: "./tests/load/processor.js"

scenarios:
  - name: "Publish messages"
    flow:
      - function: "publishMessage"
```

---

#### 5.3.2 Load Test Scenarios

**Files to Create:**
- `tests/load/throughput.test.js`

**Test Parameters:**
```javascript
{
  duration: '10m',
  rampUp: '1m',
  tenants: 10,
  messagesPerSecond: 50,
  messageTypes: {
    text: 0.7,
    template: 0.2,
    media: 0.1
  }
}
```

**Success Criteria:**
- ✅ Sustain 50 msg/s for 10 minutes
- ✅ Error rate < 1%
- ✅ p95 latency < 3 seconds
- ✅ Memory stable (no leaks)
- ✅ CPU < 80%

---

### 5.4 Test Execution & Coverage

#### 5.4.1 Run All Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Load tests
npm run test:load

# Coverage report
npm run test:coverage
```

**Coverage Requirements:**
- Overall: 80%
- Critical paths: 100% (message processing, error handling)

---

## Verification Plan

### Unit Test Verification
```bash
npm test -- --coverage
```

**Expected:**
- ✅ All unit tests pass
- ✅ Coverage >= 80%
- ✅ No critical paths uncovered

### Integration Test Verification
```bash
# Start dependencies
docker-compose up -d

# Run integration tests
npm run test:integration
```

**Expected:**
- ✅ End-to-end flow works
- ✅ Error handling correct
- ✅ Tenant isolation verified

### Load Test Verification
```bash
npm run test:load
```

**Expected:**
- ✅ 50 msg/s sustained
- ✅ < 1% error rate
- ✅ p95 < 3s

---

## Dependencies Introduced
- `jest` (already installed)
- `nock` (^13.3.0) - HTTP mocking
- `artillery` (^2.0.0) - Load testing

## Files Created
- `tests/unit/services/*.test.js` (5 files)
- `tests/unit/utils/*.test.js` (3 files)
- `tests/unit/processors/*.test.js` (1 file)
- `tests/integration/*.test.js` (3 files)
- `tests/load/*.yml` (1 file)
- `tests/load/*.js` (1 file)

## Files Modified
- `jest.config.js`
- `package.json' (test scripts)

## Breaking Changes
None

---

## Test Summary

| Category | Files | Coverage Target | Status |
|----------|-------|----------------|--------|
| Unit Tests | 9 | 80% | ⏳ Todo |
| Integration Tests | 3 | N/A | ⏳ Todo |
| Load Tests | 1 | N/A | ⏳ Todo |

---

## Next Steps
After completing testing → Service ready for production deployment!
