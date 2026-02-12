# T09 — Per-Tenant Rate Limiting (MAJOR)

**Status:** NOT IMPLEMENTED
**Severity:** MAJOR — No rate limiting; service can saturate Genesys API leading to 429 storms
**MVP Required:** No (important for production stability)
**Depends On:** Nothing (independent of other tasks, though T06 provides the rate limit config)
**Blocks:** Nothing

---

## Gap Description

The FRD requires a multi-level rate limiting system:
1. **Per-tenant token bucket** — enforces per-tenant `requestsPerMinute` and `burstSize`
2. **Global rate limiter** — 500 req/min across all tenants
3. **429 backoff manager** — when Genesys returns 429, block that tenant for `Retry-After` duration

None of these exist in the current implementation.

**FRD reference:** Section 5 (Core Responsibilities #5), Section 8 (Rate Limiting & Throttling)

---

## FRD Rate Limiting Specification

### Per-Tenant Token Bucket

- Algorithm: Token Bucket
- Capacity: `tenant.rateLimits.burstSize` (default 50)
- Refill rate: `requestsPerMinute / 60` tokens/second (default 5 tokens/second)
- Each API call consumes 1 token
- If no tokens: return `allowed = false` → NACK message (retry later)

### Global Token Bucket

- Capacity: 100 tokens (burst)
- Refill rate: 500/60 ≈ 8.3 tokens/second
- Checked before per-tenant check

### 429 Backoff Manager

When Genesys returns 429:
1. Extract `Retry-After` header (seconds or HTTP date)
2. Parse: if integer → use as seconds; if HTTP date → compute seconds until that time
3. Minimum backoff: 60 seconds
4. Store backoff expiry per tenantId (in-memory map)
5. Before processing any message: check if tenant is in backoff period
6. If backed off: NACK message (retry later)

---

## What Needs to Be Built

### 1. Token Bucket Class (`src/utils/rate-limiter.ts`)

```typescript
class TokenBucket {
  constructor(rate: number, capacity: number)
  consume(tokens?: number): boolean  // Returns true if allowed
}
```

### 2. Rate Limiter Service (`src/services/rate-limiter.service.ts`)

```typescript
class RateLimiter {
  checkTenantLimit(tenantId: string, config: TenantConfig): boolean
  checkGlobalLimit(): boolean
}

class BackoffManager {
  applyBackoff(tenantId: string, durationSeconds: number): void
  isBackedOff(tenantId: string): boolean
}
```

### 3. Integration in Consumer (T01)

Before calling Genesys API:
```
if (backoffManager.isBackedOff(tenantId)) → NACK
if (!rateLimiter.checkGlobalLimit()) → NACK
if (!rateLimiter.checkTenantLimit(tenantId, config)) → NACK
// proceed with Genesys call
```

### 4. 429 Response Handling (in T08 retry logic)

When Genesys returns 429:
```typescript
const retryAfter = response.headers['retry-after'] || '60';
backoffManager.applyBackoff(tenantId, parseRetryAfter(retryAfter));
// NACK message
```

---

## Implementation Notes

- Token buckets are **in-memory per service instance** (not Redis-based for performance)
- In multi-instance deployments, each instance has its own bucket — effective rate is `perInstance * instanceCount`. This is acceptable per FRD section 8.4.
- Backoff manager is also in-memory; if service restarts, backoff resets (acceptable)
- Per-tenant buckets are created lazily on first message from that tenant

---

## Acceptance Criteria

- [ ] Requests beyond tenant rate limit are NACKed (not dropped)
- [ ] Global rate limit prevents single tenant from starving others
- [ ] After a Genesys 429, tenant is blocked for at least 60 seconds
- [ ] `Retry-After` header value is respected
- [ ] In-memory state — restart clears backoffs (acceptable)
- [ ] Rate limit exceeded is logged with tenant ID
