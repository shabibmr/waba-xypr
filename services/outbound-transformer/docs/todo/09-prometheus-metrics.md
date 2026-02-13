# Phase 9: Prometheus Metrics

**Priority:** Medium | **Depends on:** Phase 2 (transformation types), Phase 6 (DLQ counters)
**FRD Refs:** Section 8.1

---

## Gap Summary

No metrics instrumentation exists. No `/metrics` endpoint. No counters, histograms, or gauges. The FRD specifies comprehensive Prometheus metrics for monitoring message processing, errors, latency, and queue depth.

---

## Current State

- **Metrics library:** Not installed
- **Metrics endpoint:** Does not exist
- **Instrumentation:** Zero counters or timers in any code path
- **Config:** No `METRICS_PORT` env var

## Expected State (FRD)

Full Prometheus-compatible `/metrics` endpoint with:
- **Counters:** processed, invalid, duplicate, media, failures, dispatch failures, DLQ, cache errors
- **Histograms:** transformation latency, end-to-end latency
- **Gauges:** queue depth

---

## Tasks

### T9.1 - Add Prometheus Client
- `npm install prom-client`

### T9.2 - Create Metrics Service
- Create `src/services/metrics.service.ts`
- Initialize default metrics (GC, event loop, etc.)
- Define custom metrics per FRD Section 8.1:

  **Counters:**
  ```typescript
  outbound_messages_processed_total     { tenant_id, type, status }
  outbound_invalid_messages_total       { reason }
  outbound_duplicate_messages_total     { tenant_id }
  outbound_media_processed_total        { tenant_id, media_type }
  outbound_transformation_failures_total { tenant_id, error_type }
  outbound_dispatch_failures_total      { tenant_id, error_type }
  outbound_dlq_messages_total           { tenant_id, error_type }
  outbound_cache_errors_total           { operation }
  ```

  **Histograms:**
  ```typescript
  outbound_transformation_latency_seconds  { type }  // text|media
  outbound_e2e_latency_seconds             { type }  // text|media
  ```

  **Gauges:**
  ```typescript
  outbound_queue_depth  { queue }  // outbound-processed, outbound-ready, dlq
  ```

### T9.3 - Add Metrics Endpoint
- Option A: Expose on main Express app: `GET /metrics`
- Option B: Separate Express server on `METRICS_PORT` (default 9090) for Prometheus scraping
- Return `register.metrics()` with `Content-Type: text/plain`

### T9.4 - Instrument Message Processing Pipeline
- At each stage, increment/observe appropriate metrics:
  - **After validation failure:** `outbound_invalid_messages_total.inc({ reason })`
  - **After idempotency duplicate:** `outbound_duplicate_messages_total.inc({ tenant_id })`
  - **After successful transform:** `outbound_messages_processed_total.inc({ tenant_id, type, status: 'success' })`
  - **After transform failure:** `outbound_transformation_failures_total.inc({ tenant_id, error_type })`
  - **After dispatch failure:** `outbound_dispatch_failures_total.inc({ tenant_id, error_type })`
  - **After DLQ routing:** `outbound_dlq_messages_total.inc({ tenant_id, error_type })`
  - **On Redis errors:** `outbound_cache_errors_total.inc({ operation })`
  - **Transformation time:** `outbound_transformation_latency_seconds.observe(duration)`
  - **End-to-end time:** `outbound_e2e_latency_seconds.observe(duration)`

### T9.5 - Update Config
- Add `METRICS_PORT` to config and `.env.example`

---

## Acceptance Criteria

- [ ] `prom-client` installed and initialized
- [ ] `/metrics` endpoint returns Prometheus-compatible text
- [ ] All counters from FRD Section 8.1 implemented
- [ ] Transformation latency histogram recorded for every message
- [ ] Metrics correctly labeled with `tenant_id` and `type`
