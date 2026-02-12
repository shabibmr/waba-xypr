# T15 — Prometheus Metrics Endpoint (MINOR)

**Status:** NOT IMPLEMENTED
**Severity:** MINOR — No observability; can't alert on queue depth, error rates, or API latency
**MVP Required:** No
**Depends On:** T14 (structured logging shares context)
**Blocks:** Nothing

---

## Gap Description

The FRD defines an extensive set of Prometheus metrics. Nothing is instrumented in the current implementation.

**FRD reference:** Section 12.2 (Metrics), Section 3 (Technology Stack — Prometheus)

---

## FRD Metrics Specification

### Counters

| Metric | Labels | Description |
|--------|--------|-------------|
| `messages_received_total` | tenant_id | Messages consumed from queue |
| `messages_processed_total` | tenant_id | Successfully processed |
| `messages_duplicate_total` | tenant_id | Duplicates detected (deduped) |
| `validation_failures_total` | — | Schema validation failures |
| `config_errors_total` | — | Unknown tenant errors |
| `token_cache_hits_total` | tenant_id | Redis token cache hits |
| `token_cache_misses_total` | tenant_id | Redis token cache misses |
| `tokens_obtained_total` | tenant_id | New OAuth tokens fetched |
| `tokens_invalidated_total` | tenant_id | Tokens invalidated (401) |
| `token_fetch_failures_total` | tenant_id | Auth service errors |
| `rate_limit_exceeded_total` | tenant_id | Per-tenant rate limit hits |
| `global_rate_limit_exceeded_total` | — | Global rate limit hits |
| `genesys_success_total` | tenant_id | Successful Genesys API calls |
| `genesys_4xx_errors_total` | tenant_id, status_code | Client errors |
| `genesys_5xx_errors_total` | tenant_id, status_code | Server errors |
| `genesys_rate_limited_total` | tenant_id | Genesys 429 responses |
| `genesys_retries_total` | tenant_id, attempt | Retry attempts |
| `correlation_events_published_total` | tenant_id | Correlation events sent |
| `messages_dlq_total` | tenant_id | Messages routed to DLQ |
| `circuit_breaker_opened_total` | — | Circuit breaker openings |
| `circuit_breaker_rejected_total` | region | Requests rejected by CB |

### Histograms

| Metric | Labels | Buckets |
|--------|--------|---------|
| `message_processing_duration_seconds` | tenant_id | 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0 |
| `token_fetch_duration_seconds` | — | 0.05, 0.1, 0.2, 0.5, 1.0 |
| `genesys_api_duration_seconds` | tenant_id, status_code | 0.1, 0.5, 1.0, 2.0, 5.0, 10.0 |
| `rate_limit_check_duration_seconds` | — | 0.001, 0.005, 0.01, 0.05 |

### Gauges

| Metric | Labels | Description |
|--------|--------|-------------|
| `rabbitmq_queue_depth` | — | Current `inbound-processed` queue depth |
| `tenant_backoff_seconds` | tenant_id | Current 429 backoff remaining |
| `circuit_breaker_state` | region | 0=CLOSED, 1=HALF_OPEN, 2=OPEN |

---

## What Needs to Be Built

### 1. Add `prom-client` Dependency

```bash
npm install prom-client
```

### 2. Metrics Registry (`src/services/metrics.service.ts`)

- Initialize all counters, histograms, and gauges from the table above
- Export typed increment/observe/set helpers:
  ```typescript
  metrics.increment('messages_received_total', { tenant_id: tenantId });
  metrics.observe('genesys_api_duration_seconds', durationSeconds, { tenant_id, status_code });
  metrics.set('circuit_breaker_state', 2, { region });
  ```

### 3. Metrics HTTP Endpoint

Add to `src/index.ts`:
```
GET /metrics
```
Returns Prometheus text format (content-type: `text/plain; version=0.0.4`).

This endpoint must NOT require authentication (Prometheus scrapes it directly).

### 4. Instrument All Operations

Wire metric calls throughout:
- Consumer: `messages_received_total` on every consume
- Deduplication: `messages_duplicate_total` on skip
- Auth: `token_cache_hits/misses`, `tokens_obtained`
- Genesys API: `genesys_api_duration_seconds` timer, success/error counters
- Rate limiter: `rate_limit_exceeded_total`
- Circuit breaker: `circuit_breaker_state` gauge update
- DLQ: `messages_dlq_total`

### 5. Queue Depth Gauge (Optional)

Poll RabbitMQ management API or use `channel.checkQueue()` every 30 seconds to update `rabbitmq_queue_depth` gauge.

---

## Acceptance Criteria

- [ ] `GET /metrics` returns valid Prometheus text format
- [ ] `messages_received_total` increments for each message consumed
- [ ] `genesys_api_duration_seconds` records latency for each API call
- [ ] `genesys_4xx_errors_total` increments with correct status_code label
- [ ] Token cache hit/miss counters are accurate
- [ ] Circuit breaker state gauge reflects actual state
- [ ] Metrics endpoint accessible without auth token
