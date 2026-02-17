# MVP Gap Analysis Report

**Date:** 2026-02-17
**Scope:** Full codebase analysis of 14 microservices against FRDs and CLAUDE.md spec
**Method:** Automated deep-read of every source file, FRD, config, schema, and infrastructure file

---

## Executive Summary

The system has a **solid architectural foundation** — services are properly separated, shared constants exist, queue-based async patterns are in place, and the message pipeline is structurally correct. However, **the system cannot complete a single end-to-end message round-trip** due to a critical bug in `genesys-api-service` that breaks conversation ID correlation. Beyond that blocker, there are significant gaps in idempotency, tenant isolation, error handling, and security across the pipeline.

**Overall MVP Readiness: ~55%**

| Area | Readiness | Verdict |
|------|-----------|---------|
| Inbound Pipeline (WA -> Genesys) | 70% | Works except correlation bug |
| Outbound Pipeline (Genesys -> WA) | 40% | Blocked by correlation; missing isolation |
| Auth & Token Management | 75% | Functional but unsecured endpoints |
| Tenant Management | 85% | Most complete service |
| Agent Portal (Frontend) | 45% | Simplified MVP, auth insecure |
| Agent Portal (Backend) | 50% | Socket.IO not wired, metrics missing |
| Agent Widget | 30% | Vanilla JS, needs React rewrite per FRD |
| Admin Dashboard | 60% | Functional but no auth, hardcoded secrets |
| Infrastructure & Config | 50% | Schema conflicts, broken prod compose |
| Shared Libraries | 40% | Defined but not adopted by services |
| Testing | 25% | Minimal coverage across the board |

---

## P0: System-Breaking Bugs

These must be fixed before any end-to-end flow works.

### 1. ConversationId Extraction Bug (genesys-api-service)

**File:** `services/genesys-api-service/src/services/genesys-api.service.ts:66`
**Impact:** Breaks ALL inbound message flows. No conversations can be correlated.

```typescript
// CURRENT (broken):
const conversationId: string = response.data.conversationId;  // undefined!

// CORRECT:
const conversationId: string = response.data.id;
```

Genesys returns `{ id: "conv-uuid", channel: { id: "comm-uuid" } }` but code reads `.conversationId` which doesn't exist. Result: correlation events publish `conversationId: undefined`, state-manager can't link mappings, outbound replies fail with `mapping_not_found` and go to DLQ.

### 2. Database Schema Conflict

**Files:** `docker/postgres/init.sql` (old) vs `new_init.sql` (new)
**Impact:** Services expect columns that may not exist.

`docker-compose.yml` mounts the **old** `init.sql` which lacks: `phone_number_id`, `genesys_integration_id`, `email`, `domain`, `settings JSONB`. Tenant service's `schemaService.js` runs `ALTER TABLE ADD COLUMN IF NOT EXISTS` on startup as a workaround, but this is fragile and the two schemas have type mismatches (`wa_id` as VARCHAR vs UUID, `message_tracking.id` as SERIAL vs UUID).

**Fix:** Replace `docker/postgres/init.sql` with `new_init.sql` as the canonical schema.

### 3. API Gateway Body Restreaming Bug

**File:** `services/api-gateway/src/utils/proxyFactory.js:43-49`
**Impact:** POST/PUT/PATCH requests through the gateway may fail or hang.

The `onProxyReq` handler calls both `proxyReq.write(bodyData)` and `proxyReq.end()`, but `http-proxy-middleware` also calls `end()` internally, causing double-end on the stream.

---

## P1: Critical Pipeline Gaps

These don't crash the system but will cause data loss, duplicates, or security issues in production.

### Inbound Pipeline

| Gap | Service | Severity | FRD Ref |
|-----|---------|----------|---------|
| No idempotency cache | inbound-transformer | Critical | FRD 5.1-5.2 |
| No input schema validation | inbound-transformer | Critical | FRD 5.1 |
| Status event transformation missing entirely | inbound-transformer | Critical | FRD 5.2 |
| 429 rate-limit treated as permanent failure | genesys-api-service | Critical | FRD 6.5 |
| No circuit breaker (per-region) | genesys-api-service | High | FRD 6.7 |
| Dedup check happens AFTER processing (should be BEFORE) | genesys-api-service | High | FRD 5.5 |
| Webhook processing can exceed Meta's 5s SLA | whatsapp-webhook-service | High | CLAUDE.md |
| No webhook deduplication | whatsapp-webhook-service | Medium | — |

### Outbound Pipeline

| Gap | Service | Severity | FRD Ref |
|-----|---------|----------|---------|
| No per-tenant circuit breaker | whatsapp-api-service | Critical | FRD REQ-ISO-01 |
| No per-tenant rate limiter | whatsapp-api-service | Critical | FRD REQ-ISO-01 |
| Error code 131047 (window expired) not handled | whatsapp-api-service | Critical | FRD 4.4.2 |
| 401 routes to DLQ instead of invalidate+retry | whatsapp-api-service | Critical | FRD 4.4.4 |
| Max retry count not enforced (infinite requeue) | whatsapp-api-service | Critical | — |
| No idempotency check | outbound-transformer | Critical | FRD REQ-OUT-05 |
| No media URL validation (SSRF risk) | outbound-transformer | Critical | FRD 5.2 |
| No signed URL generation for MinIO internal URLs | outbound-transformer | High | FRD 4.3 |
| Queue-based dispatch missing (HTTP-only) | outbound-transformer | High | FRD 4.4 |
| Payload field names mismatch between genesys-webhook and state-manager | genesys-webhook-service | Medium | FRD 4.2 |

### Auth Service

| Gap | Service | Severity | FRD Ref |
|-----|---------|----------|---------|
| No auth middleware on token endpoint (anyone can request any tenant's token) | auth-service | Critical | FRD 7.2 |
| JWT secret defaults to `'your-secret-key'` | auth-service | Critical | — |
| No request collapsing for WhatsApp tokens | auth-service | High | FRD 5.2 |
| Token refresh endpoint defined but not exposed in routes | auth-service | Medium | FRD |

---

## P2: Security Gaps

| Gap | Service | Impact |
|-----|---------|--------|
| Auth Service has no authentication on its own endpoints | auth-service | Any service can impersonate any tenant |
| Agent Portal stores tokens in localStorage | agent-portal | XSS can steal tokens (FRD says memory-only + HTTP-only cookies) |
| OAuth flow missing PKCE | agent-portal / agent-portal-service | Authorization code interception possible |
| Admin Dashboard has no authentication at all | admin-dashboard | Anyone can manage tenants |
| Demo tenant secrets hardcoded in GenesysOAuth.jsx | admin-dashboard | Client-side source code leaks secrets |
| Shared `tenantResolver` middleware exists but NO service uses it | all services | Tenant isolation not enforced |
| No media URL HTTPS enforcement / private IP blocking | inbound-transformer, outbound-transformer | SSRF vulnerability |

---

## P3: Per-Service Gap Summary

### State Manager (95% ready — best service)
- Core logic solid: identity resolution, distributed locks, cache-aside, idempotent DB ops
- Health checks comprehensive (DB + Redis + RabbitMQ)
- **Gaps:** No auto-expiry cron visible, no metrics, agent portal events fail silently

### Tenant Service (85% ready)
- Full CRUD, credential management, WhatsApp signup, Redis caching
- **Gaps:** Webhook secret not retrievable after storage, no API key rotation endpoints, no audit logging, no settings management API

### Auth Service (75% ready)
- Genesys OAuth, WhatsApp token, JWKS validation, degraded mode all working
- **Gaps:** Unsecured endpoints (critical), missing WhatsApp request collapsing, no metrics, incomplete error codes

### Genesys API Service (60% ready)
- Queue consumption, dedup, token caching functional
- **Gaps:** ConversationId bug (P0), 429 handling broken, no circuit breaker, no rate limiting, health check always returns healthy

### Whatsapp Webhook Service (80% ready)
- Signature verification, tenant resolution, media handling, queue publishing all working
- **Gaps:** No 5s timeout enforcement, no dedup, no echo filtering, synchronous processing risk

### Genesys Webhook Service (75% ready)
- Signature validation, echo detection, media relay via MinIO, event classification working
- **Gaps:** No rate limiting, no HTTPS enforcement, no request timeout, payload field name mismatches

### Inbound Transformer (50% ready)
- Basic message transformation and queue publishing works
- **Gaps:** No idempotency (critical), no input validation, no status event handling, no media URL validation

### Outbound Transformer (55% ready)
- Text/media transformation, MIME mapping, audio special handling works
- **Gaps:** No idempotency (critical), no URL validation (SSRF), no signed URL generation, HTTP-only dispatch

### WhatsApp API Service (40% ready)
- Basic message sending to Meta API works
- **Gaps:** No tenant isolation (critical), no error code handling, infinite retries, no credential cache invalidation

### Agent Portal Frontend (45% ready)
- Basic auth flow, workspace UI, 2-step onboarding, Socket.IO context
- **Gaps:** localStorage tokens (insecure), no PKCE, simplified onboarding (2/5 steps), no dashboard analytics, Socket.IO not fully wired, no pagination

### Agent Portal Service (50% ready)
- Auth routes, conversation CRUD, auto-provisioning working
- **Gaps:** No tenant resolver middleware, Socket.IO initialized but no event emitters, no dashboard metrics implementation

### Agent Widget (30% ready)
- Vanilla JS chat UI, message history, Socket.IO connection
- **Gaps:** Not React (FRD requires), no Genesys SDK mode, no media attachments, no read receipts, hardcoded URLs

### Admin Dashboard (60% ready)
- Tenant CRUD UI, Genesys OAuth popup, WhatsApp signup, service health display
- **Gaps:** No authentication, hardcoded secrets, wrong response parsing for WhatsApp signup, missing env var defaults

### API Gateway (80% ready)
- All 13 services proxied, rate limiting, circuit breaker, security headers
- **Gaps:** Body restreaming bug (P0), circuit breaker per-route not per-service, CORS missing port 3015, Redis URL hardcoded

---

## P4: Infrastructure & Cross-Cutting Gaps

### Docker Compose
- **Production compose broken:** Bad build context paths, missing health checks, hardcoded credentials
- **Remote compose not portable:** Hardcoded IP `192.168.29.124`
- **MinIO bucket mismatch:** `docker-compose.yml` creates `whatsapp-media`, `docker-compose.infra.yml` creates 4 different buckets, genesys-webhook-service code defaults to `media-outbound`

### Shared Constants
- `shared/constants/services.js` missing `AGENT_PORTAL_SERVICE` (port 3015)
- `ADMIN_DASHBOARD` port listed as 80 but maps to 3006
- API Gateway has its own **duplicate** constants file instead of using shared
- Redis TTL values in `keys.js` conflict with CLAUDE.md specs (5min vs 60s token buffer, 1h vs 24h mapping TTL)

### Shared Middleware
- `tenantResolver.js` and `tenantRateLimiter.js` exist but **zero services import them**
- Manual JWT parsing in middleware (uses `Buffer.from` instead of jwt library)

### manage.sh
- Missing ports 3014, 3015, 9000-9001 from kill list
- No health verification after `start`
- Can't build multiple services at once

### Testing
- ~25% overall coverage across the codebase
- No E2E tests
- No integration tests for full message pipeline
- Multiple services have zero tests (whatsapp-api-service, genesys-webhook-service)
- Test infrastructure (mocks, builders) is well-structured but underutilized
- Root `package.json` references `tests/jest.config.js` and `scripts/setup/init-database.js` which may not exist

### Observability (Missing Everywhere)
- **Zero services implement Prometheus metrics** (all FRDs specify them)
- **Zero services implement structured JSON logging** (all FRDs require it)
- **No distributed tracing** (correlation IDs set but not propagated end-to-end)
- No centralized log aggregation config
- No alerting configuration

---

## MVP Fix Roadmap (Prioritized)

### Phase 0: Unblock End-to-End Flow (Day 1)
1. Fix conversationId extraction bug in genesys-api-service (~5 min)
2. Replace `docker/postgres/init.sql` with `new_init.sql` as canonical schema (~15 min)
3. Fix API gateway body restreaming bug (~15 min)
4. Test complete inbound + outbound round-trip

### Phase 1: Pipeline Integrity (Days 2-3)
1. Add idempotency cache to inbound-transformer (Redis SETNX, 24h TTL)
2. Add idempotency cache to outbound-transformer (Redis SETNX, 24h TTL)
3. Implement status event transformation in inbound-transformer
4. Fix 429 handling in genesys-api-service (NACK+requeue, not DLQ)
5. Fix 401 handling in whatsapp-api-service (invalidate cache + retry once)
6. Add max retry enforcement in whatsapp-api-service
7. Add input validation to inbound-transformer
8. Fix MinIO bucket names to be consistent

### Phase 2: Tenant Isolation & Resilience (Days 4-5)
1. Per-tenant circuit breaker in whatsapp-api-service
2. Per-tenant rate limiter in whatsapp-api-service
3. Per-region circuit breaker in genesys-api-service
4. Integrate `tenantResolver` middleware into all backend services
5. Add auth middleware to auth-service token endpoint
6. Add media URL validation (HTTPS, no private IPs) to both transformers

### Phase 3: Security Hardening (Days 6-7)
1. Move agent-portal tokens from localStorage to memory + HTTP-only cookies
2. Implement PKCE in OAuth flow
3. Remove hardcoded secrets from admin-dashboard
4. Add authentication to admin-dashboard
5. Enforce JWT_SECRET (no default) in production
6. Add webhook processing timeout (5s) to whatsapp-webhook-service

### Phase 4: Operational Readiness (Days 8-10)
1. Fix production docker-compose (build contexts, health checks, env vars)
2. Comprehensive health checks for all services (check dependencies)
3. Add structured JSON logging to all services
4. Add Prometheus metrics to pipeline services (at minimum)
5. Wire Socket.IO event emitters in agent-portal-service
6. Fix CORS to include port 3015 in API gateway
7. Update shared constants (missing services, correct TTLs)
8. End-to-end integration tests for both pipelines

### Phase 5: Polish (Days 11+)
1. Complete 5-step onboarding wizard in agent-portal
2. Dashboard analytics (charts, KPI cards, token warnings)
3. Conversation pagination and CSV export
4. Agent widget React rewrite
5. Expand test coverage to >70%
6. Graceful shutdown handlers for all services
7. Distributed tracing (propagate correlation IDs end-to-end)

---

## Appendix: Files Referenced

| Category | Key Files |
|----------|-----------|
| Schema | `docker/postgres/init.sql`, `new_init.sql` |
| Shared | `shared/constants/queues.js`, `services.js`, `keys.js`, `shared/middleware/tenantResolver.js` |
| Infra | `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`, `docker-compose.infra.yml`, `docker-compose.remote.yml`, `manage.sh` |
| Critical Bug | `services/genesys-api-service/src/services/genesys-api.service.ts:66` |
| Gateway Bug | `services/api-gateway/src/utils/proxyFactory.js:43-49` |
| Auth Risk | `services/auth-service/src/config/index.js:64` (JWT default) |
| Security | `services/admin-dashboard/src/components/GenesysOAuth.jsx:130-137` (hardcoded secrets) |
| Token Storage | `services/agent-portal/src/contexts/AuthContext.jsx` (localStorage) |
