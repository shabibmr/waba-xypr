# T07 — Auth Token Redis Caching (MAJOR / MVP)

**Status:** NOT IMPLEMENTED
**Severity:** MAJOR — Auth service is called on every single message; no token caching, no invalidation on 401
**MVP Required:** YES (performance and correctness)
**Depends On:** T02 (Redis client)
**Blocks:** Nothing (but missing this causes auth-service saturation under load)

---

## Gap Description

`auth.service.ts` currently makes an HTTP GET to `auth-service` on **every** call to `getAuthToken()`. There is no Redis check, no TTL management, and no 401 handling.

The FRD requires a local Redis cache with a 5-minute buffer before expiry and automatic invalidation on 401 responses.

**FRD reference:** Section 7.1 (REQ-AUTH-02), Section 3 (Token Cache key structure)

---

## Current Implementation Problem

```typescript
export async function getAuthToken(tenantId: string): Promise<string> {
    const response = await axios.get(
        `${config.services.authService.url}/auth/token`,
        { headers: { 'X-Tenant-ID': tenantId } }
    );
    return response.data.token;
}
```

Every inbound message → auth service HTTP call. Under 100 msg/min → 100 HTTP calls/min to auth service per tenant. Auth service may also have its own rate limits or cold-start latency.

---

## What Needs to Be Built

### 1. Update `auth.service.ts` with Redis Caching Logic

**Cache key:** `genesys:token:{tenantId}`

**Token cache structure (stored as JSON string in Redis):**
```json
{
  "access_token": "eyJhbG...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "expiry": 1700000000
}
```

**Logic:**
1. Check Redis for `genesys:token:{tenantId}`
2. If found: parse JSON, check if `expiry > now + 300` (5-min buffer)
   - If still valid: return `access_token` (cache HIT)
   - If expired: fall through to fetch
3. If not found or expired: call auth-service
4. Store result in Redis with TTL = `expires_in - 300`
5. Return `access_token`

**On Redis error:** log warning, fall through to auth-service call (fail open)

### 2. Token Invalidation on 401

When the Genesys API returns 401:
- Call `invalidateToken(tenantId)` → `redisDel("genesys:token:{tenantId}")`
- The retry logic (T08) will then call `getAuthToken()` which fetches a fresh token

Add `invalidateToken(tenantId: string): Promise<void>` to `auth.service.ts`.

### 3. Auth Service Response Shape

Verify what `auth-service /auth/token` returns. The current code uses `response.data.token`. The FRD assumes the auth service returns an OAuth standard response:
```json
{ "access_token": "...", "expires_in": 3600, "token_type": "Bearer" }
```

If the auth-service returns `{ "token": "..." }` without `expires_in`, a reasonable default TTL must be used (e.g., 3300 seconds = 55 minutes).

---

## Cache Key Namespace

Per FRD section 7.1 and shared key patterns in `shared/constants/keys.js`:
- Key: `genesys:token:{tenantId}`
- TTL: `expires_in - 300` (or 3300 if `expires_in` not provided)

---

## Acceptance Criteria

- [ ] Second call to `getAuthToken(tenantId)` within TTL does NOT call auth-service
- [ ] Token is cached in Redis with correct TTL
- [ ] Expired token (within 5-min buffer) triggers a fresh fetch
- [ ] Redis failure does NOT stop token retrieval (falls back to auth-service)
- [ ] `invalidateToken(tenantId)` deletes the cached token
- [ ] 401 from Genesys triggers `invalidateToken()` (wired in T08 or consumer)
