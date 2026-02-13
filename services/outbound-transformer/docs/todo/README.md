# Outbound Transformer - Gap Analysis & Task Plan

**FRD Version:** 1.2 (Enterprise Hardened)
**Analysis Date:** 2026-02-12
**Last Updated:** 2026-02-13
**Current Implementation:** ~85% of FRD spec (MVP pipeline verified complete)

---

## Executive Summary

The outbound-transformer has a **functional skeleton** that handles the happy path for text and basic media messages via direct HTTP dispatch to whatsapp-api-service. However, it operates on a **legacy input schema** (flat Genesys webhook format) instead of the FRD's enriched message format, and **lacks all enterprise-hardening features**: idempotency, retry limits, DLQ routing, input validation, MIME-type mapping, URL validation, structured logging, and metrics.

### What Works Today (Verified)
- Express server on port 3003
- RabbitMQ consumer with valid queue config (`outbound-processed`)
- **Full Input Validation** (Zod-like schema, internalId, tenantId, etc.)
- **Transformation Logic** (Enriched format -> WABA format with metadata envelope)
- **MIME Type Mapping** (Correctly maps MIME to WhatsApp types)
- **Dispatching** (Publishes to `outbound-ready` with correct headers)
- **Error Handling** (Retry with backoff + DLQ routing)
- `X-Tenant-ID` header propagation
- Health check (minimal)

### What's Broken or Missing

| Category | Gap | Severity |
|----------|-----|----------|
| **Idempotency** | No Redis, no deduplication (Deferred for MVP) | Medium |
| **URL Validation** | No HTTPS check, no SSRF protection (Deferred for MVP) | High |
| **Structured Logging** | `console.log` only, no JSON, no context (Deferred for MVP) | Medium |
| **Metrics** | No Prometheus instrumentation, no `/metrics` (Deferred for MVP) | Medium |
| **Health Check** | Minimal (no Redis/storage check, no version, no latency) | Low |
| **Tests** | 0% coverage (Deferred for MVP) | High |
| **Config** | Some hardcoded values remaining | Low |

---

## Task Phases (Dependency Order)

```
Phase 1: Input Schema & Validation ─────────────────────┐
    │                                                     │
    ├──→ Phase 2: Transformation Logic Rewrite            │
    │        │                                            │
    │        ├──→ Phase 3: Dispatch & Queue Routing       │
    │        │                                            │
    │        └──→ Phase 5: Media URL Validation           │
    │                                                     │
    ├──→ Phase 4: Idempotency (Redis) ──────────┐        │
    │                                            │        │
    │    Phase 3 + Phase 4 ──→ Phase 6: Retry & DLQ      │
    │                                                     │
    ├──→ Phase 7: Structured Logging (can start early)    │
    │                                                     │
    │    Phase 4 + Phase 5 ──→ Phase 8: Health Check      │
    │                                                     │
    │    Phase 2 + Phase 6 ──→ Phase 9: Prometheus Metrics│
    │                                                     │
    │    All ──→ Phase 10: Testing                        │
    │                                                     │
    │    All ──→ Phase 11: Config & Env Cleanup           │
    │                                                     │
    └──→ Phase 12: Cleanup & Misc                         │
```

| Phase | File | Priority | Depends On |
|-------|------|----------|------------|
| 1 | [01-input-schema-and-validation.md](./01-input-schema-and-validation.md) | Critical | None |
| 2 | [02-transformation-logic.md](./02-transformation-logic.md) | Critical | Phase 1 |
| 3 | [03-dispatch-and-queue-routing.md](./03-dispatch-and-queue-routing.md) | Critical | Phase 2 |
| 4 | [04-idempotency-redis.md](./04-idempotency-redis.md) | Critical | Phase 1 |
| 5 | [05-media-url-validation.md](./05-media-url-validation.md) | High | Phase 2 |
| 6 | [06-retry-and-dlq.md](./06-retry-and-dlq.md) | Critical | Phase 3, 4 |
| 7 | [07-structured-logging.md](./07-structured-logging.md) | High | Phase 1 (for field names) |
| 8 | [08-health-check.md](./08-health-check.md) | Medium | Phase 4, 5 |
| 9 | [09-prometheus-metrics.md](./09-prometheus-metrics.md) | Medium | Phase 2, 6 |
| 10 | [10-testing.md](./10-testing.md) | High | All |
| 11 | [11-config-and-env.md](./11-config-and-env.md) | Medium | All |
| 12 | [12-cleanup-and-misc.md](./12-cleanup-and-misc.md) | Low | All |

---

## MVP: Minimum for Basic Working Service

To get the outbound transformer functioning correctly in the pipeline (messages flow from state-manager through to whatsapp-api-service), implement these phases **in order**:

### MVP Phase List (4 phases)

| # | Phase | Status | Why It's MVP |
|---|-------|--------|-------------|
| **1** | Phase 1: Input Schema & Validation | **Done** | Without this, the service can't read messages from state-manager |
| **2** | Phase 2: Transformation Logic (core) | **Done** | Without correct output format and MIME mapping, downstream rejects messages |
| **3** | Phase 3: Dispatch & Queue Routing | **Done** | Service must publish to `outbound-ready` for the pipeline to work |
| **4** | Phase 6: Retry & DLQ (basic) | **Done** | Without retry limits, a single bad message causes infinite loop |

### MVP Deferred (implement after basic flow works)

| Phase | Reason to Defer |
|-------|----------------|
| Phase 4: Redis idempotency | Duplicates rare at low volume; add before production |
| Phase 5: Media URL validation | Can work with public URLs initially; critical before production |
| Phase 7: Structured logging | `console.log` works for development debugging |
| Phase 8: Health check | Minimal check is functional |
| Phase 9: Metrics | Not needed for basic operation |
| Phase 10: Testing | Important but not blocking runtime |
| Phase 11: Config cleanup | Current config works for development |
| Phase 12: Cleanup | Non-functional improvements |

### MVP Implementation Order (specific tasks)

```
1. [x] T1.1  Define InputMessage & OutputMessage types
2. [x] T1.3  Implement input validation service
3. [x] T2.1  Implement MIME type mapping
4. [x] T2.3  Rewrite text transformation (new schema + output envelope)
5. [x] T2.4  Rewrite media transformation (MIME-based + output envelope)
6. [x] T2.6  Implement filename extraction utility
7. [x] T3.1  Add new queue names to shared constants
8. [x] T3.2  Switch input queue to outbound-processed
9. [x] T3.3  Implement queue dispatch to outbound-ready
10. [x] T1.4  Integrate validation into RabbitMQ consumer
11. [x] T1.5  Update message processor for new schema
12. [x] T1.6  Handle invalid JSON gracefully
13. [x] T3.5  Wire dispatcher into message processor
14. [x] T6.1  Implement error classification
15. [x] T6.4  Assert DLQ queue on startup
16. [x] T6.5  Implement DLQ message publisher
17. [x] T6.6  Rewrite consumer error handling (max retries + DLQ)
```

This gives you a **working pipeline** where:
- Messages from state-manager (via `outbound-processed`) are consumed
- Input is validated (bad messages rejected cleanly)
- Text and media messages are correctly transformed with MIME mapping
- Output is published to `outbound-ready` in the correct `{ metadata, wabaPayload }` envelope
- Failures are retried up to 3 times, then routed to DLQ
- No infinite retry loops

---

## Task Count Summary

| Phase | Tasks | Priority | Status |
|-------|-------|----------|--------|
| Phase 1 | 6 | Critical | **Done** |
| Phase 2 | 8 | Critical | **Done** |
| Phase 3 | 7 | Critical | **Done** |
| Phase 4 | 6 | Critical | Deferred |
| Phase 5 | 7 | High | Deferred |
| Phase 6 | 7 | Critical | **Done** |
| Phase 7 | 6 | High | Deferred |
| Phase 8 | 5 | Medium | Deferred |
| Phase 9 | 5 | Medium | Deferred |
| Phase 10 | 11 | High | Deferred |
| Phase 11 | 4 | Medium | Deferred |
| Phase 12 | 8 | Low | Deferred |
| **Total** | **80** | |
| **MVP subset** | **17** | Critical |
