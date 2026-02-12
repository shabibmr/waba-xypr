# T08 — Retry with Exponential Backoff (MAJOR)

**Status:** NOT IMPLEMENTED
**Severity:** MAJOR — Single Genesys API failure permanently fails the message; no retry
**MVP Required:** No (MVP can rely on RabbitMQ NACK requeue, but proper retry is required for production)
**Depends On:** T05 (correct Genesys API call), T07 (token invalidation on 401)
**Blocks:** T10 (circuit breaker wraps retries)

---

## Gap Description

The FRD specifies retry logic with exponential backoff and jitter for the Genesys API call. The current implementation does a single `axios.post()` with no error classification and no retry.

If Genesys returns a 500, 503, or network timeout — the message is NACKed and immediately requeued, which can create a tight retry storm. Proper exponential backoff prevents this.

**FRD reference:** Section 9.1 (Retry Strategy), Section 9.3 (HTTP Status Code Handling)

---

## FRD Retry Specification

### Exponential Backoff Formula

```
delay = min(baseDelayMs * 2^(attempt-1), maxDelayMs) + jitter(0-1000ms)
```

**Default per FRD (from tenant config):**
- `maxAttempts`: 5
- `baseDelayMs`: 1000 (1 second)
- `maxDelayMs`: 32000 (32 seconds)

**Attempt schedule (no jitter):**
| Attempt | Delay before retry |
|---------|--------------------|
| 1 | 1s |
| 2 | 2s |
| 3 | 4s |
| 4 | 8s |
| 5 | 16s (max capped at 32s) |

### Retriable vs Non-Retriable Errors

**Retriable:**
- 5xx (500, 502, 503, 504)
- 408 (Request Timeout)
- 429 (Rate Limited — handled by T09 backoff manager)
- 401 (Unauthorized — retry once after token invalidation)
- Network timeout / connection error

**Non-Retriable (go to DLQ immediately):**
- 400 (Bad Request)
- 403 (Forbidden)
- 404 (Not Found)
- Other 4xx

---

## What Needs to Be Built

### 1. Retry Wrapper in `src/services/genesys-api.service.ts`

A `sendInboundMessageWithRetry()` function that:

1. Loops up to `maxAttempts` times
2. Calls `sendInboundMessage()` (T05 fixed version)
3. On success: return response
4. On `401`: call `invalidateToken(tenantId)` (T07), retry immediately (once)
5. On retriable error (5xx, 408, timeout): sleep `calculateBackoff(attempt)`, retry
6. On non-retriable error (400, 403, 404): throw immediately (consumer routes to DLQ)
7. On max retries exceeded: throw with indication of exhaustion

### 2. Backoff Calculator Utility (`src/utils/backoff.ts`)

Pure function:
```typescript
function calculateBackoff(attempt: number, config: RetryConfig): number
// Returns milliseconds to wait before next attempt
// Applies formula: min(base * 2^(attempt-1), max) + random(0, 1000)
```

### 3. Error Classification (`src/utils/classify-error.ts`)

```typescript
function isRetriableError(statusCode: number): boolean
function isPermanentError(statusCode: number): boolean
```

### 4. 401 Handling with Token Refresh

```
catch (AxiosError e):
  if e.response.status === 401:
    if attempt === 1:
      await invalidateToken(tenantId)
      continue retry
    else:
      throw (non-retriable after one token refresh attempt)
```

---

## Acceptance Criteria

- [ ] 5xx error triggers retry (not immediate DLQ)
- [ ] Delay between retries follows exponential backoff formula
- [ ] Delay includes random jitter (prevents thundering herd)
- [ ] Max attempts configurable (default 5)
- [ ] 400/403/404 does NOT retry (goes to DLQ immediately)
- [ ] 401 triggers token invalidation + one retry
- [ ] After max retries exhausted, error propagates to consumer → DLQ
- [ ] Retry attempt number logged for each attempt
