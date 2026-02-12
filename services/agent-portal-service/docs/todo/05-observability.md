# 05 — Observability

> **FRD Reference:** Section 11 (Observability), Lines 3400-3500
> **Priority:** 🟡 Medium — MVP Phase 3

---

## Gap Summary

| Feature | FRD | Code | Gap |
|---------|-----|------|-----|
| Structured logging (Winston) | ✅ | ✅ | Implemented with JSON format |
| Request-scoped logging (correlation ID) | ✅ | ❌ | No request ID in logs |
| Prometheus metrics endpoint (`/metrics`) | ✅ | ❌ | Not implemented |
| Custom metrics (request count, latency, errors) | ✅ | ❌ | Not implemented |
| Health check endpoint | ✅ | ✅ | `GET /health` exists |
| Readiness/liveness probes | ✅ | 🟡 | Basic health only, no dep checks |

---

## Tasks

### T05.1 — Add Prometheus Metrics
- **File:** `src/middleware/metrics.js` (NEW)
- **What:** Use `prom-client` to expose `GET /metrics`
- **Counters:** `http_requests_total`, `http_request_duration_seconds`
- **Install:** `prom-client`

### T05.2 — Request-scoped Correlation ID
- **File:** `src/middleware/requestId.js` (NEW — shared with T03.5)
- **What:** Inject `req.id` into all log lines via Winston child logger

### T05.3 — Enhanced Health Check
- **File:** `src/index.js` (MODIFY)
- **What:** Check Redis, PostgreSQL, RabbitMQ connectivity
- **Return:** `{ status, redis, db, rabbitmq, uptime }`

### T05.4 — Add Log Levels from Env
- **File:** `src/utils/logger.js` (MODIFY)
- **What:** Already reads `LOG_LEVEL` env — verify all controllers use correct levels
