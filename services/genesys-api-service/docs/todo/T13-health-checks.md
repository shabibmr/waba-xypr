# T13 — Health Check — Liveness & Readiness Probes (MINOR)

**Status:** PARTIALLY IMPLEMENTED (liveness only, no readiness)
**Severity:** MINOR — Service appears healthy even when disconnected from RabbitMQ or auth-service
**MVP Required:** No
**Depends On:** T01 (RabbitMQ connection status), T02 (Redis ping)
**Blocks:** Nothing

---

## Gap Description

The current health check at `GET /health` returns a static `{ status: "healthy" }` regardless of the actual state of dependencies (RabbitMQ, Redis, auth-service).

The FRD requires:
1. **Liveness** — is the process alive?
2. **Readiness** — is the service ready to process messages? (checks dependencies)

**FRD reference:** Section 12.3 (Health Checks)

---

## Current Implementation

`src/routes/health.routes.ts`:
```typescript
router.get('/', (req, res) => {
    res.json({ status: 'healthy', service: 'genesys-api' });
});
```

Single endpoint, always returns 200. No dependency checks.

---

## What Needs to Be Built

### 1. Liveness Endpoint (`GET /health/live`)

Simple check — is the process running?
```json
{ "status": "alive", "service": "genesys-api-service" }
```
Always returns 200 if the process is running. No dependency checks.

### 2. Readiness Endpoint (`GET /health/ready`)

Checks actual dependencies:

| Dependency | Check | Failure Mode |
|-----------|-------|-------------|
| RabbitMQ | Channel open, `inbound-processed` queue accessible | 503 (required) |
| Auth Service | `GET {AUTH_SERVICE_URL}/health` responds 200 | 503 (required) |
| Redis | `PING` responds | Warn only — Redis optional per FRD |

**Response format:**
```json
{
  "status": "ready",
  "checks": {
    "rabbitmq": "OK",
    "auth_service": "OK",
    "redis": "OK"
  }
}
```

On failure:
```json
{
  "status": "not ready",
  "checks": {
    "rabbitmq": "FAILED: Connection refused",
    "auth_service": "FAILED: 503",
    "redis": "DEGRADED: Connection refused"
  }
}
```
Returns HTTP 503 if any required check fails.

### 3. Keep `/health` for Backward Compatibility

Keep the existing `GET /health` as a combined check (or alias to readiness).

---

## Route Changes

Update `src/routes/health.routes.ts`:
```
GET /health        → combined/legacy (backward compat)
GET /health/live   → liveness (always 200)
GET /health/ready  → readiness (200 or 503)
```

---

## Docker/k8s Integration

For Docker Compose `healthcheck`:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3010/health/live"]
  interval: 10s
  timeout: 5s
  retries: 3
```

Use `/health/ready` for container readiness gate.

---

## Acceptance Criteria

- [ ] `GET /health/live` always returns 200 while process is running
- [ ] `GET /health/ready` returns 503 when RabbitMQ is disconnected
- [ ] `GET /health/ready` returns 503 when auth-service is unreachable
- [ ] `GET /health/ready` returns 200 (with degraded Redis) when only Redis is down
- [ ] Response includes per-check status details
- [ ] Health checks complete within 3 seconds (use short timeouts on dependency checks)
