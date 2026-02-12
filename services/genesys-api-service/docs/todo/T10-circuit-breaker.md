# T10 — Circuit Breaker (MAJOR)

**Status:** NOT IMPLEMENTED
**Severity:** MAJOR — Genesys outages cause message pile-up and retry storms without a circuit breaker
**MVP Required:** No
**Depends On:** T08 (retry logic wraps individual calls; circuit breaker wraps the whole function)
**Blocks:** Nothing

---

## Gap Description

The FRD requires per-region circuit breakers to prevent cascading failures when Genesys Cloud is unavailable. Without a circuit breaker, all retry attempts during an outage still hit the Genesys API, wasting resources and saturating connections.

**FRD reference:** Section 9.2 (Circuit Breaker Pattern)

---

## FRD Circuit Breaker Specification

### States

| State | Description |
|-------|-------------|
| CLOSED | Normal operation — requests pass through |
| OPEN | Genesys is down — fail fast, don't attempt |
| HALF_OPEN | Testing recovery — allow one probe request |

### State Transitions

```
CLOSED → OPEN:     10 consecutive failures
OPEN → HALF_OPEN:  60 seconds after opening
HALF_OPEN → CLOSED: 3 consecutive successes
HALF_OPEN → OPEN:   1 failure during probe
```

### Scope

**Per-region** circuit breaker (not per-tenant). All tenants in the same Genesys region share one circuit breaker. This is important because Genesys Cloud regions are the actual failure domains.

---

## What Needs to Be Built

### 1. Circuit Breaker Class (`src/utils/circuit-breaker.ts`)

```typescript
class CircuitBreaker {
  constructor(config: { failureThreshold: number; timeout: number })
  // failureThreshold: 10 consecutive failures → OPEN
  // timeout: 60 seconds → HALF_OPEN

  call<T>(fn: () => Promise<T>): Promise<T>
  // Executes fn with circuit protection
  // Throws CircuitBreakerOpenError if circuit is OPEN

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN'
}
```

### 2. Per-Region Registry (`src/services/circuit-breaker.service.ts`)

```typescript
class CircuitBreakerRegistry {
  get(region: string): CircuitBreaker
  // Creates a new CircuitBreaker for region if not exists
}
```

### 3. Integration in Genesys API Service (T05/T08)

Wrap the Genesys API call:
```
const cb = circuitBreakerRegistry.get(credentials.region);
try {
  result = await cb.call(() => sendInboundMessageWithRetry(...));
} catch (CircuitBreakerOpenError) {
  // NACK message — circuit open, retry later
  throw;
}
```

When circuit is OPEN, the service NACKs messages without attempting the API call.

---

## Behavior Details

### When Circuit Opens

- Log ERROR: "Circuit breaker OPEN for region {region} after {n} failures"
- All subsequent calls to that region fast-fail immediately
- Messages are NACKed (requeued) — they will be retried when circuit closes

### When Circuit Closes

- Log INFO: "Circuit breaker CLOSED for region {region} — recovered"
- Normal processing resumes

### Failure Counting

- Only count server-side failures (5xx, timeouts, connection errors)
- Do NOT count 4xx errors (those are message-level failures, not infrastructure)
- Do NOT count rate-limit 429 (handled by T09 backoff)

---

## Acceptance Criteria

- [ ] After 10 consecutive 5xx errors, circuit opens
- [ ] While OPEN, no HTTP calls are made to Genesys (fast fail)
- [ ] After 60 seconds, circuit enters HALF_OPEN
- [ ] Three consecutive successes close the circuit
- [ ] One failure in HALF_OPEN reopens the circuit
- [ ] Each Genesys region has its own circuit breaker
- [ ] Circuit state change is logged with region and reason
