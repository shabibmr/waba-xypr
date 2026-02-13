# Phase 8: Health Check Enhancement

**Priority:** Medium | **Depends on:** Phase 4 (Redis), Phase 5 (Storage)
**FRD Refs:** Section 8.3

---

## Gap Summary

Current health endpoint returns minimal `{ status: 'healthy', rabbitmq: 'connected'|'disconnected' }`. Missing: version info, Redis health, storage health, latency measurements, processing metrics.

---

## Current State

```typescript
// health.controller.ts
res.json({
  status: 'healthy',
  rabbitmq: rabbitChannel ? 'connected' : 'disconnected'
});
```

No degraded/unhealthy status logic. Always returns `'healthy'` even if RabbitMQ is disconnected.

## Expected State (FRD)

```json
{
  "status": "healthy|degraded|unhealthy",
  "version": "1.x.x",
  "checks": {
    "rabbitmq": { "status": "healthy", "latency_ms": 5 },
    "redis": { "status": "healthy", "latency_ms": 2 },
    "storage": { "status": "healthy", "latency_ms": 10 }
  },
  "metrics": {
    "messages_processed_last_minute": 150,
    "avg_latency_ms": 25,
    "error_rate_percent": 0.5
  }
}
```

---

## Tasks

### T8.1 - Implement Dependency Health Checks
- **RabbitMQ:** PING the channel (check `channel !== null` + attempt a `checkQueue`)
  - Measure round-trip time for latency
- **Redis:** `PING` command, measure response time
- **Storage (MinIO/S3):** `bucketExists()` check, measure response time
- Each check returns `{ status: 'healthy'|'unhealthy', latency_ms: number }`

### T8.2 - Implement Aggregate Status Logic
- `healthy`: All dependencies healthy
- `degraded`: Non-critical dependency unhealthy (e.g., Redis down -- service can still process)
- `unhealthy`: Critical dependency unhealthy (e.g., RabbitMQ down -- can't consume)

### T8.3 - Add Version to Health Response
- Read from `config.serviceVersion` (set from `SERVICE_VERSION` env var or `package.json`)

### T8.4 - Add Basic Processing Metrics
- Track in-memory counters (or read from Prometheus metrics if Phase 9 done):
  - `messages_processed_last_minute`
  - `avg_latency_ms`
  - `error_rate_percent`
- Use rolling window (last 60 seconds)

### T8.5 - Update Health Controller
- Rewrite `health.controller.ts` to call all checks in parallel
- Return full response per FRD spec
- Set HTTP status: 200 for healthy/degraded, 503 for unhealthy

---

## Acceptance Criteria

- [ ] Health response includes `version`
- [ ] RabbitMQ, Redis, Storage each checked individually with latency
- [ ] Aggregate status: healthy/degraded/unhealthy
- [ ] HTTP 503 when unhealthy
- [ ] Basic processing metrics in response
