# 06 — Performance & Scalability

> **FRD Reference:** Section 10 (Performance), Lines 3200-3400
> **Priority:** 🟡 Medium — MVP Phase 3

---

## Gap Summary

| Feature | FRD | Code | Gap |
|---------|-----|------|-----|
| Redis caching (cache-aside) | ✅ | ❌ | Only `tokenBlacklist` uses Redis |
| Pagination (cursor-based) | ✅ | 🟡 | offset/limit only, no cursor |
| Circuit breaker for external calls | ✅ | ❌ | Not implemented |
| Connection pooling (PG) | ✅ | ✅ | `pg.Pool` used |
| Graceful shutdown | ✅ | 🟡 | Basic SIGTERM handler, no drain |

---

## Tasks

### T06.1 — Generic Redis Cache Service
- **File:** `src/services/redisCache.js` (NEW)
- **What:** Reusable cache-aside with `get`, `set`, `invalidate`, TTL config
- **Used by:** Dashboard, conversations, org profile

### T06.2 — Cursor-based Pagination
- **File:** `src/controllers/conversationController.js` (MODIFY)
- **What:** Replace offset/limit with cursor-based pagination
- **FRD specifies:** `?cursor=xxx&limit=20` with `nextCursor` in response

### T06.3 — Circuit Breaker for External Calls
- **File:** `src/services/circuitBreaker.js` (NEW)
- **What:** Wrap State Manager and Genesys API calls
- **Install:** `opossum`

### T06.4 — Enhanced Graceful Shutdown
- **File:** `src/index.js` (MODIFY)
- **What:** Drain HTTP connections, close Redis, close PG pool, close RabbitMQ

### T06.5 — Response Compression
- **File:** `src/index.js` (MODIFY)
- **What:** `app.use(compression())`
- **Install:** `compression`
