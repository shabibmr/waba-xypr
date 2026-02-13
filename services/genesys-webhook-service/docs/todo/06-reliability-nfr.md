# Task File 06 — Reliability & Non-Functional Requirements
**Priority:** MEDIUM — Depends on 01–05 being functional. Required for production-readiness.
**FRD Refs:** §6.1, §6.2, §6.3, §8.4

---

## Gaps

### GAP-38: No rate limiting
**Current:** No rate limiting on the webhook endpoint.
**FRD (§8.4.2):** 100 requests per minute per IP.
```js
// Use express-rate-limit or similar
rateLimit({ windowMs: 60*1000, max: 100 })
```

---

### GAP-39: Health check missing MinIO connectivity check
**Current (`health.routes.ts`):** Only checks RabbitMQ connection state.
**FRD (§6.4.3):**
```
GET /health
→ checks: service running, RabbitMQ connected, MinIO accessible
```
MinIO check: `minio.bucketExists("media-outbound")` — if throws, mark as `unhealthy`/`degraded`.
If any dependency is unhealthy → return `503` (not `200`).

---

### GAP-40: Missing `/ready` readiness endpoint
**Current:** Only `GET /health` exists.
**FRD (§6.4.3):** `GET /ready` is required for Kubernetes readiness probes. Unlike `/health` (liveness), `/ready` should return 503 if any dependency is not available.

---

### GAP-41: RabbitMQ reconnect logic has no maximum retry cap
**Current (`rabbitmq.service.ts`):** Reconnects every 5 seconds with no backoff and no maximum attempts.
**FRD (§6.2.2):** Connection parameters should include `connectionAttempts: 3` and `retryDelay: 2s`. After exhaustion, log critical and surface as unhealthy.

---

### GAP-42: No HTTPS enforcement
**Current:** No TLS/HTTPS middleware.
**FRD (§8.4.1):** In production, redirect HTTP → HTTPS. This is typically handled by the reverse proxy/ingress, but the service should check `X-Forwarded-Proto` if behind a proxy, or enforce in middleware for direct access.
**Note:** For containerized deployments, this is usually an infra concern (nginx/k8s ingress). Mark as low priority for MVP, but document.

---

### GAP-43: No circuit breaker for Tenant Service calls
**Current:** Tenant Service call has no circuit breaker; repeated failures block every request.
**FRD (§6.2.2):** Circuit breaker with `failureThreshold: 5, recoveryTimeout: 60s` for external service calls.
**Note:** Can be deferred post-MVP but should be tracked.

---

### GAP-44: Dockerfile health check uses wrong path
**Current (`Dockerfile`):** `wget http://localhost:3011/health` — this is the service root `/health`.
**Note:** This is correct as-is since health routes are at `/health`. However, the health check should also verify the RabbitMQ state per GAP-39. No code change needed here, but address GAP-39 first.

---

## Tasks

| # | Task | File(s) to Change |
|---|------|-------------------|
| 06-A | Add `express-rate-limit` middleware: 100 req/min per IP on `POST /webhook` | `index.ts` or `webhook.routes.ts` |
| 06-B | Add MinIO bucket existence check to `GET /health` | `health.routes.ts` |
| 06-C | Return `503` from `GET /health` when any dependency is unhealthy (not `200`) | `health.routes.ts` |
| 06-D | Add `GET /ready` endpoint: same as health but stricter (all deps must pass) | `health.routes.ts` |
| 06-E | Add cap on RabbitMQ reconnect attempts (max 3 with exponential backoff: 2s, 4s, 8s); log critical after exhaustion | `rabbitmq.service.ts` |
| 06-F | Add `AUTH_SERVICE_URL` to config and `.env.example` | `config/config.ts`, `.env.example` |
| 06-G | (Post-MVP) Add circuit breaker for Tenant Service HTTP calls | `tenant.service.ts` |
| 06-H | (Post-MVP) Add HTTPS redirect middleware for production | `index.ts` |

---

## Acceptance Criteria
- `GET /health` returns `503` when RabbitMQ is disconnected
- `GET /health` returns `503` when MinIO is unreachable
- `GET /health` returns `200 { "status": "healthy", "dependencies": { "rabbitmq": "healthy", "minio": "healthy" } }` when all ok
- `GET /ready` returns `503` when any dependency is down
- >100 requests/minute from same IP → `429 Too Many Requests`
- RabbitMQ reconnect: max 3 attempts with backoff, then log critical
