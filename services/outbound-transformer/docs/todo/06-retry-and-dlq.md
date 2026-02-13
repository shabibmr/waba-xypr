# Phase 6: Retry Strategy & Dead Letter Queue

**Priority:** Critical | **Depends on:** Phase 3 (Dispatch), Phase 4 (Redis for tracking)
**FRD Refs:** REQ-OUT-06, Section 6.1, Section 6.2

---

## Gap Summary

The current service has **no retry limit and no DLQ**. On error, it NACKs with `requeue: true` after 5 seconds, which causes infinite retry loops for permanently failing messages. The FRD requires max 3 retries with exponential backoff, error classification (retryable vs permanent), and DLQ routing.

---

## Current State

| Feature | Status | Detail |
|---------|--------|--------|
| Retry limit | Missing | Unlimited retries via NACK+requeue |
| Exponential backoff | Missing | Flat 5s delay via `setTimeout` |
| Retry counter | Missing | No tracking of attempt number |
| Error classification | Missing | All errors treated the same (NACK) |
| DLQ queue | Missing | No `outbound-transformer-dlq` asserted |
| DLQ message format | Missing | No error wrapping with details |
| No-silent-drops policy | Violated | Messages can loop forever or be lost |

## Expected State (FRD)

- Max 3 retries with exponential backoff (2s, 4s, 8s) + ±20% jitter
- Error classification: Client/Validation (no retry, ACK+DLQ), Transient (retry, then DLQ)
- DLQ message includes: original message, error details, retry count, timestamps, service metadata
- Every message either succeeds or goes to DLQ -- no silent drops

---

## Tasks

### T6.1 - Implement Error Classification
- Create error types or use classification function in `src/services/error.service.ts`:
  ```typescript
  type ErrorCategory = 'client' | 'validation' | 'transient' | 'configuration';

  function classifyError(error: Error): { category: ErrorCategory; retryable: boolean } {
    // Validation/Client errors: invalid JSON, missing fields, bad UUID, unsupported MIME, etc.
    // Transient errors: Redis unavailable, HTTP 5xx, timeout, RabbitMQ publish failure
    // Configuration: missing storage credentials, invalid config
  }
  ```
- Non-retryable errors: ACK + send to DLQ immediately
- Retryable errors: retry up to max, then DLQ

### T6.2 - Implement Retry Counter via Message Headers
- Use RabbitMQ message headers to track retry count:
  ```typescript
  // On first process: no header, attempt = 1
  // On NACK+requeue, increment x-retry-count header
  const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
  ```
- Alternative: Use `x-death` header from RabbitMQ's native DLQ mechanism
- Or use separate exchange with TTL queues for delayed retries

### T6.3 - Implement Exponential Backoff with Jitter
- `calculateBackoff(attempt: number): number`
  ```typescript
  const baseDelay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
  const jitter = baseDelay * (Math.random() * 0.4 - 0.2); // ±20%
  return baseDelay + jitter;
  ```
- For RabbitMQ: use message TTL + dead letter exchange pattern for delayed requeue
  - Or use a simple `setTimeout` before NACK (simpler but less robust)

### T6.4 - Assert DLQ Queue on Startup
- In `rabbitmq.service.ts`, assert DLQ:
  ```typescript
  await channel.assertQueue('outbound-transformer-dlq', { durable: true });
  ```
- Use shared constant: `QUEUES.OUTBOUND_TRANSFORMER_DLQ`

### T6.5 - Implement DLQ Message Publisher
- Create `routeToDlq(originalMessage, error, retryCount)` function
- DLQ message format per FRD Section 4.6:
  ```typescript
  {
    original_message: originalMessage,
    error_details: {
      error_type: error.constructor.name,
      error_message: error.message,
      stack_trace: error.stack,
      retry_count: retryCount,
      first_attempt_timestamp: ...,
      last_attempt_timestamp: Math.floor(Date.now() / 1000)
    },
    metadata: {
      tenant_id: originalMessage.tenantId,
      internal_id: originalMessage.internalId,
      dlq_timestamp: Math.floor(Date.now() / 1000),
      service: 'outbound-transformer',
      service_version: config.serviceVersion
    }
  }
  ```
- Publish to DLQ with persistent delivery mode

### T6.6 - Rewrite Consumer Error Handling
- Replace current catch block in `rabbitmq.service.ts`:
  ```typescript
  // Current (broken):
  setTimeout(() => rabbitChannel?.nack(msg, false, true), 5000);

  // New:
  const retryCount = getRetryCount(msg);
  const errorCategory = classifyError(error);

  if (!errorCategory.retryable || retryCount >= config.maxRetries) {
    await routeToDlq(payload, error, retryCount);
    channel.ack(msg); // ACK to remove from source queue
  } else {
    // Increment retry count in headers and requeue
    const delay = calculateBackoff(retryCount);
    setTimeout(() => channel.nack(msg, false, true), delay);
  }
  ```

### T6.7 - Add Service Version to Config
- `src/config/index.ts`:
  ```typescript
  serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  ```

---

## Acceptance Criteria

- [ ] Max 3 retries before DLQ (configurable via `MAX_RETRIES`)
- [ ] Exponential backoff: 2s, 4s, 8s with ±20% jitter
- [ ] Client/validation errors skip retry, go directly to DLQ
- [ ] Transient errors retry, then DLQ after max attempts
- [ ] DLQ message contains: original message, error type/message/stack, retry count, timestamps
- [ ] DLQ queue `outbound-transformer-dlq` asserted on startup
- [ ] DLQ messages published with persistent delivery mode
- [ ] No message is silently dropped -- every message succeeds or goes to DLQ
