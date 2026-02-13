# Auth Service — Gap Analysis & Implementation Task List

## Implementation Status: MVP COMPLETE ✅

All MVP tasks implemented and verified. All 30 source modules load without errors.
New entrypoint: `src/index.js` → `src/server.js` → `src/app.js`

---

## Current State Summary (Post-Implementation)

The auth-service has been refactored from a monolithic `src/index.js` into a fully layered architecture.

### What Was Implemented

| Feature | Status | File(s) |
|---------|--------|---------|
| Custom error classes (`AuthServiceError`, `OAuthError`, `CacheError`) | ✅ Done | `src/models/errors.js` |
| Config validation on startup (fail fast) | ✅ Done | `src/config/index.js` |
| Structured logger (winston) | ✅ Done | `src/utils/logger.js` |
| Redis key constants (`auth:token:{provider}:{tenantId}`) | ✅ Done | `src/utils/redis-keys.js` |
| Multi-region Genesys endpoint map (11 regions + aliases) | ✅ Done | `src/config/providers.config.js` |
| Redis singleton client with reconnect | ✅ Done | `src/repositories/redis.client.js` |
| Token cache repository (correct key patterns + TTL buffer) | ✅ Done | `src/repositories/token-cache.repository.js` |
| Distributed lock repository (SET NX EX + Lua release) | ✅ Done | `src/repositories/lock.repository.js` |
| Redis health monitor (periodic ping, degraded mode trigger) | ✅ Done | `src/services/health/redis-health-monitor.js` |
| Degraded mode in-memory rate limiter | ✅ Done | `src/services/health/degraded-rate-limiter.js` |
| Credential fetcher (Tenant Service, retry on 5xx) | ✅ Done | `src/services/credentials/credential-fetcher.service.js` |
| Genesys OAuth client (retry, 401 no-retry, 429 backoff) | ✅ Done | `src/services/oauth/genesys-oauth.client.js` |
| Genesys token service (cache-aside + distributed lock + degraded mode) | ✅ Done | `src/services/token/genesys-token.service.js` |
| WhatsApp token service (cache-aside + degraded mode) | ✅ Done | `src/services/token/whatsapp-token.service.js` |
| Token orchestrator | ✅ Done | `src/services/token/token.service.js` |
| JWKS cache service (per-region jwks-rsa client) | ✅ Done | `src/services/jwt/jwks-cache.service.js` |
| JWT validator (RS256, clock skew ±30s, claim extraction) | ✅ Done | `src/services/jwt/jwt-validator.service.js` |
| Service factory (DI wiring) | ✅ Done | `src/services/factory.js` |
| Correlation ID middleware | ✅ Done | `src/api/middleware/correlation.middleware.js` |
| Service-to-service auth middleware (Bearer, disabled if secret unset) | ✅ Done | `src/api/middleware/auth.middleware.js` |
| Joi validation middleware | ✅ Done | `src/api/middleware/validation.middleware.js` |
| Centralized error handling middleware | ✅ Done | `src/api/middleware/error.middleware.js` |
| Token request validator schema | ✅ Done | `src/api/validators/token.validator.js` |
| JWT validation request schema | ✅ Done | `src/api/validators/jwt.validator.js` |
| Token controller | ✅ Done | `src/api/controllers/token.controller.js` |
| JWT controller | ✅ Done | `src/api/controllers/jwt.controller.js` |
| Health controller (Redis + Tenant Service latency) | ✅ Done | `src/api/controllers/health.controller.js` |
| Routes (`POST /api/v1/token`, `POST /api/v1/validate/jwt`, `GET /api/v1/health`) | ✅ Done | `src/api/routes/index.js` |
| Express app (layered, 404 handler, error handler) | ✅ Done | `src/app.js` |
| Server startup + graceful shutdown (SIGTERM/SIGINT) | ✅ Done | `src/server.js` |
| Thin entry point | ✅ Done | `src/index.js` |
| Dependencies installed (joi, winston, jsonwebtoken, jwks-rsa, nock) | ✅ Done | `package.json` |
| Degraded mode (Redis down → direct fetch + rate limit) | ✅ Done | genesys/whatsapp token services |
| Request collapsing (distributed lock prevents token stampede) | ✅ Done | `genesys-token.service.js` |
| Secret zeroization after OAuth exchange | ✅ Done | `genesys-token.service.js` |
| Metrics (Prometheus) | ⏭ Post-MVP | `07-observability.md` |
| Legacy OAuth authorize/callback (portal flow) | ⏭ Removed | Belongs in agent-portal-service |

---

## API Routes (Corrected)

| FRD Endpoint | Implemented | Status |
|-------------|-------------|--------|
| `POST /api/v1/token` | ✅ Yes | Replaces old `GET /auth/token` |
| `POST /api/v1/validate/jwt` | ✅ Yes | Replaces old `POST /auth/validate` (JWKS-based) |
| `GET /api/v1/health` | ✅ Yes | Replaces old `GET /health` |
| `GET /auth/token` | ✅ Removed | Old route gone |
| `POST /auth/refresh` | ✅ Removed | Use `forceRefresh: true` in body |
| `GET /auth/info` | ✅ Removed | Internal debug route gone |
| `POST /auth/validate` | ✅ Removed | Replaced by JWKS JWT validation |
| `GET /auth/genesys/authorize` | ✅ Removed | Belongs in agent-portal-service |
| `GET /auth/genesys/callback` | ✅ Removed | Belongs in agent-portal-service |

## Redis Keys (Corrected)

| FRD Key Pattern | Status |
|----------------|--------|
| `auth:token:genesys:{tenantId}` | ✅ Implemented |
| `auth:token:whatsapp:{tenantId}` | ✅ Implemented |
| `auth:lock:{provider}:{tenantId}` | ✅ Implemented |
| `auth:jwks:{region}` | ✅ via jwks-rsa in-memory cache |

---

## Task Files (in dependency order)

| File | Phase | Dependency | MVP Critical | Status |
|------|-------|-----------|-------------|--------|
| [01-project-structure-foundation.md](./01-project-structure-foundation.md) | Foundation | None | YES | ✅ Complete |
| [02-redis-infrastructure.md](./02-redis-infrastructure.md) | Infrastructure | 01 | YES | ✅ Complete |
| [03-credential-oauth-services.md](./03-credential-oauth-services.md) | Core Services | 01, 02 | YES | ✅ Complete |
| [04-token-services.md](./04-token-services.md) | Core Services | 02, 03 | YES | ✅ Complete |
| [05-jwt-validation.md](./05-jwt-validation.md) | Core Services | 02 | YES | ✅ Complete |
| [06-api-layer.md](./06-api-layer.md) | API Layer | 03, 04, 05 | YES | ✅ Complete |
| [07-observability.md](./07-observability.md) | Observability | 06 | NO (post-MVP) | ⏭ Pending |
| [08-testing.md](./08-testing.md) | Testing | 06 | Partial | ⏭ Pending |

---

## MVP Critical Path — Status

### From 01 — Foundation

- [x] Refactor into `src/` subdirectory structure (config, services, middleware, routes)
- [x] Add custom error classes (`AuthServiceError`, `OAuthError`, `CacheError`)
- [x] Configuration validation on startup (fail fast on missing env vars)
- [x] Replace `console.log` with structured logger (winston)

### From 02 — Redis Infrastructure

- [x] Fix Redis key patterns to match FRD (`auth:token:{provider}:{tenantId}`)
- [x] Implement distributed lock repository (SET NX EX + Lua release)
- [x] Token cache repository with correct TTL + safety buffer

### From 03 — Credentials & OAuth

- [x] Credential fetcher service (calls Tenant Service `GET /tenants/:id/credentials/:type`)
- [x] Genesys OAuth client (POST to `login.{region}.genesys.cloud/oauth/token`)
- [x] Multi-region endpoint support (11 regions + legacy alias map)

### From 04 — Token Services

- [x] Genesys token service with request collapsing (distributed lock pattern)
- [x] WhatsApp token service (cache-aside, no lock needed)
- [x] Token orchestrator (`getToken(tenantId, type, forceRefresh)`)
- [x] Degraded mode fallback (Redis unavailable → direct fetch + in-memory rate limit)

### From 05 — JWT Validation

- [x] JWKS client with per-region caching (jwks-rsa library)
- [x] JWT validator service (RS256 verify, extract sub/orgId/roles)

### From 06 — API Layer

- [x] Fix base path to `/api/v1`
- [x] `POST /api/v1/token` controller
- [x] `POST /api/v1/validate/jwt` controller
- [x] `GET /api/v1/health` with dependency status
- [x] Service-to-service auth middleware (disabled if `INTERNAL_SERVICE_SECRET` unset)
- [x] Joi input validation middleware for both endpoints
- [x] Error handling middleware (maps `AuthServiceError` → HTTP response)
- [x] Correlation ID middleware

### Nice-to-Have for MVP

- [ ] Metrics endpoint (Prometheus) — see `07-observability.md`
- [ ] Integration tests with Redis + mock Tenant Service — see `08-testing.md`
- [ ] Request collapsing load test — see `08-testing.md`

### Out of Scope for MVP

- [ ] Genesys OAuth authorize/callback (belongs in agent-portal-service)
- [ ] RBAC and session management
- [ ] Full Prometheus dashboard
- [ ] Circuit breaker pattern
- [ ] Per-service rate limiting middleware

---

## Verification

```bash
# Install dependencies
npm install

# Verify all modules load (no import errors)
node -e "require('./src/server')"
# Expected: WARNING about INTERNAL_SERVICE_SECRET (expected in dev), no errors

# Start service (requires Redis + Tenant Service running)
npm start

# Test health endpoint
curl http://localhost:3004/api/v1/health

# Test token endpoint
curl -X POST http://localhost:3004/api/v1/token \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"your-tenant-id","type":"genesys"}'

# Test JWT validation
curl -X POST http://localhost:3004/api/v1/validate/jwt \
  -H "Content-Type: application/json" \
  -d '{"token":"<genesys-sso-jwt>","region":"ap-south-1"}'
```

## Notes

- **Auth middleware:** `INTERNAL_SERVICE_SECRET` not set = auth disabled (safe for dev/local). Set it in production.
- **Credential endpoint:** Tenant Service must expose `GET /tenants/:id/credentials/:type` (canonical per MEMORY.md).
- **Region aliases:** Legacy region codes (e.g. `aps1`) are mapped to FRD codes (`ap-south-1`) in `providers.config.js`.
- **Old routes removed:** Any callers using `GET /auth/token` or `POST /auth/validate` must be updated to new paths.
