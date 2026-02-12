# T16 — Test Coverage Gaps (MINOR)

**Status:** PARTIALLY IMPLEMENTED (basic test files exist, FRD coverage scenarios missing)
**Severity:** MINOR — Existing tests incomplete; key failure scenarios untested
**MVP Required:** No
**Depends On:** All other tasks (tests validate implementation)
**Blocks:** Nothing

---

## Gap Description

Test files exist (`tests/api/genesys.api.test.js`, `tests/unit/services/genesys.test.js`, `tests/fixtures/genesys.js`) but have not been reviewed against the FRD test scenarios in Section 13.

The FRD requires >80% code coverage and specific scenarios for validation, token caching, rate limiting, circuit breaker, and retry logic.

**FRD reference:** Section 13 (Testing Requirements — 13.1, 13.2, 13.3)

---

## Required Test Scenarios from FRD

### Unit Tests

#### Payload Validation (T03)
- [ ] Valid payload passes validation
- [ ] Missing `metadata.tenantId` throws validation error
- [ ] Invalid `direction` (not "Inbound") throws validation error
- [ ] Text type without `text` field throws validation error
- [ ] Missing `genesysPayload` section throws validation error

#### Token Management (T07)
- [ ] Cache HIT: second call with valid cached token does NOT call auth-service
- [ ] Cache MISS: expired token triggers auth-service call
- [ ] Cache MISS: no cached token calls auth-service and stores result
- [ ] Redis failure allows token fetch to proceed (fail open)
- [ ] `invalidateToken()` deletes Redis key

#### Rate Limiting (T09)
- [ ] Requests within burst size are allowed
- [ ] Requests exceeding burst size are rejected
- [ ] Token bucket refills over time
- [ ] Tenant in backoff period is rejected
- [ ] Global rate limit rejects when exceeded

#### Circuit Breaker (T10)
- [ ] Circuit opens after `failureThreshold` consecutive failures
- [ ] While OPEN, requests are rejected without calling the API
- [ ] After `timeout` seconds, circuit enters HALF_OPEN
- [ ] Three successes in HALF_OPEN close the circuit
- [ ] One failure in HALF_OPEN reopens the circuit

#### Retry Logic (T08)
- [ ] 5xx error triggers retry with backoff delay
- [ ] 400 error does NOT retry (goes to DLQ path)
- [ ] After `maxAttempts`, error propagates to DLQ
- [ ] Backoff formula: `min(base * 2^(attempt-1), max) + jitter`

#### Deduplication (T03)
- [ ] First message with a `whatsapp_message_id` is processed
- [ ] Second message with same `whatsapp_message_id` is silently ACKed (skipped)
- [ ] Redis failure allows both messages through (fail open)

### Integration Tests

#### E2E Happy Path (T01 + T05 + T04)
- [ ] Publish message to `inbound-processed` → consumer processes it → Genesys API called → correlation event in `correlation-events` queue
- [ ] Mock auth-service and Genesys API

#### Retry on 5xx (T08)
- [ ] Mock Genesys to return 500 twice then 200
- [ ] Verify Genesys API was called 3 times
- [ ] Verify message NOT in DLQ
- [ ] Verify correlation event published after success

#### 429 Rate Limit Handling (T09)
- [ ] Mock Genesys to return 429 with `Retry-After: 60`
- [ ] Verify message NACKed (requeued)
- [ ] Verify tenant is in backoff period
- [ ] Verify backoff expires after configured duration

#### Permanent Failure → DLQ (T11)
- [ ] Mock Genesys to return 400
- [ ] Verify message lands in `genesys-api.dlq`
- [ ] Verify DLQ message contains failure reason and original payload
- [ ] Verify original message is ACKed (not left in queue)

#### Unknown Tenant → DLQ
- [ ] Message with non-existent tenantId → lands in DLQ
- [ ] Alert fired (if alerting implemented)

---

## Test Infrastructure Gaps

### Missing Mocks

Current test setup likely lacks:
- Mock for RabbitMQ consumer (no consumer exists yet)
- Mock for Redis (deduplication and token cache)
- Mock for Genesys API at the correct URL (T05 changes this)

### Recommended Additions

1. **RabbitMQ mock** — use `amqplib/callback_api` test double or in-memory queue
2. **Redis mock** — use `ioredis-mock` or `redis-mock`
3. **Genesys API mock** — `nock` interceptor on `https://api.*.genesys.cloud/*`
4. **Auth service mock** — `nock` interceptor or test server

### Coverage Tooling

Add to `jest.config.js`:
```javascript
{
  collectCoverage: true,
  coverageThreshold: { global: { lines: 80, branches: 80 } },
  coverageDirectory: 'coverage'
}
```

---

## Acceptance Criteria

- [ ] `npm test` passes with >80% line and branch coverage
- [ ] All FRD validation test scenarios pass
- [ ] E2E happy path integration test passes with mocked dependencies
- [ ] Retry + DLQ integration test passes
- [ ] Tests do not make real HTTP calls (all external services are mocked)
