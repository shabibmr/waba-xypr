# T02 — Redis Client Setup (CRITICAL / MVP-Partial)

**Status:** NOT IMPLEMENTED (`redis` package installed, never used)
**Severity:** CRITICAL — Token caching and deduplication both require Redis
**MVP Required:** Partial (token caching is MVP; deduplication is important but not blocking)
**Depends On:** Nothing
**Blocks:** T07 (token caching), T03 (deduplication check)

---

## Gap Description

`redis` v4 is listed in `package.json` but is **never imported or used** anywhere in `src/`.

The FRD requires Redis for two distinct purposes:
1. **Token cache** — store OAuth tokens per tenant with TTL (`genesys:token:{tenantId}`)
2. **Message deduplication** — prevent duplicate Genesys conversations (`genesys:dedupe:{tenantId}:{whatsapp_message_id}`)

Without Redis, the auth service is called on every single message (high latency + load), and duplicate messages can create duplicate conversations in Genesys Cloud.

**FRD references:** Section 3 (Technology Stack), Section 6.2 (Idempotency Check), Section 7.1 (Token Management)

---

## What Needs to Be Built

### 1. Redis Client Module (`src/services/redis.service.ts`)

- Connect using `REDIS_URL` env var
- Handle connection errors gracefully (log + continue — Redis failure must not stop processing per FRD section 10.3)
- Export typed helper functions:
  - `redisGet(key: string): Promise<string | null>`
  - `redisSet(key: string, value: string, ttlSeconds: number): Promise<void>`
  - `redisSetNX(key: string, value: string, ttlSeconds: number): Promise<boolean>` (for deduplication atomic SET if not exists)
  - `redisDel(key: string): Promise<void>` (for token invalidation)
  - `redisPing(): Promise<boolean>` (for health check)

### 2. Key Namespace Conventions

Per FRD section 6.2 and 7.1:

| Purpose | Key Pattern | TTL |
|---------|------------|-----|
| Token cache | `genesys:token:{tenantId}` | `expires_in - 300` seconds |
| Deduplication | `genesys:dedupe:{tenantId}:{whatsapp_message_id}` | 86400 (24h) |

### 3. Failure Mode

- If Redis is unavailable: log a warning, **do not throw** — allow processing to continue
- Deduplication fails open (may process duplicate, better than losing message)
- Token fetch falls back to calling auth service directly

### 4. Add config keys to `src/config/config.ts`

```
REDIS_URL=redis://redis:6379
```

---

## Environment Variables Required

```env
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=           # optional
```

---

## Acceptance Criteria

- [ ] Redis client connects on service startup
- [ ] Connection errors are logged but do not crash the service
- [ ] `redisSetNX` is atomic (uses Redis `SET NX EX` command)
- [ ] All keys use correct namespace from FRD
- [ ] TTLs are correctly applied
- [ ] Health check can call `redisPing()`
