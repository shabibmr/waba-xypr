# Phase 4: Idempotency via Redis

**Priority:** Critical | **Depends on:** Phase 1 (Input Schema -- needs `internalId`)
**FRD Refs:** REQ-OUT-05, Section 4.5

---

## Gap Summary

**No Redis dependency exists at all.** The service has zero deduplication. If the same message is redelivered (RabbitMQ retry, network hiccup, consumer restart), it will be processed and sent to WhatsApp again. The FRD requires Redis-based idempotency with 24-hour TTL using `SETNX` for atomic check-and-set.

---

## Current State

- **Redis client:** Not installed (`ioredis` not in `package.json`)
- **Redis config:** No `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` env vars
- **Deduplication:** None -- every message is processed
- **Shared constants:** `keys.js` has no `idempotency:outbound:*` pattern

## Expected State (FRD)

- Redis connection with graceful degradation
- Key pattern: `idempotency:outbound:{internalId}`
- TTL: 86400 seconds (24 hours)
- Atomic: `SETNX` to handle race conditions across instances
- If Redis unavailable: log error, process message anyway (favor availability over dedup)

---

## Tasks

### T4.1 - Add Redis Dependency
- `npm install ioredis`
- Add `@types/ioredis` if needed (ioredis has built-in types)

### T4.2 - Create Redis Service
- Create `src/services/redis.service.ts`
- Initialize Redis client from config
- Handle connection/disconnection events with logging
- Export `getRedisClient()` for use by other services
- Graceful shutdown: close connection on process exit

### T4.3 - Add Redis Config
- Update `src/config/index.ts`:
  ```typescript
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  idempotency: {
    ttlSeconds: parseInt(process.env.IDEMPOTENCY_TTL_SECONDS || '86400'),
  }
  ```
- Update `.env.example`

### T4.4 - Implement Idempotency Service
- Create `src/services/idempotency.service.ts`
- `checkAndMarkProcessing(internalId: string): Promise<boolean>`
  - Key: `idempotency:outbound:${internalId}`
  - Use `SETNX` (or `SET ... NX EX`) for atomic check + set with TTL
  - Returns `true` if duplicate (already exists), `false` if new
  - On Redis error: log, return `false` (process anyway -- availability over correctness)
- `markCompleted(internalId: string): Promise<void>`
  - Update value to `{ status: 'completed', processed_at: timestamp }`
  - Reset TTL to 24 hours
- `isRedisHealthy(): Promise<boolean>`
  - `PING` check for health endpoint

### T4.5 - Integrate Idempotency into Message Flow
- In `rabbitmq.service.ts` or `message-processor.service.ts`:
  1. After validation, before transformation:
     ```typescript
     const isDuplicate = await checkAndMarkProcessing(message.internalId);
     if (isDuplicate) {
       logger.info('Duplicate message detected', { internalId: message.internalId });
       channel.ack(msg); // ACK silently
       return;
     }
     ```
  2. After successful dispatch:
     ```typescript
     await markCompleted(message.internalId);
     ```

### T4.6 - Add Idempotency Key to Shared Constants
- Update `/shared/constants/keys.js`:
  ```javascript
  idempotencyOutbound: (internalId) => `idempotency:outbound:${internalId}`,
  ```
- Add TTL constant:
  ```javascript
  TTL: {
    ...existing,
    IDEMPOTENCY: 86400, // 24 hours
  }
  ```

---

## Acceptance Criteria

- [ ] `ioredis` installed and configured
- [ ] Redis connection with error handling and reconnect
- [ ] Idempotency check using `SETNX` before processing
- [ ] Duplicate messages ACKed silently without re-processing
- [ ] 24-hour TTL on idempotency keys
- [ ] Redis unavailability does not block message processing (log + continue)
- [ ] Health check includes Redis status
