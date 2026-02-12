# Genesys API Service — Gap Analysis & Task List

**Based on FRD:** `docs/genesys-api-frd.md` v1.1 (Enhanced MVP)
**Analysis Date:** 2026-02-12
**Current State:** HTTP-only REST service; queue-driven core is entirely absent

---

## Executive Summary

The current implementation is a **skeleton HTTP API wrapper** around Genesys Cloud endpoints. The FRD specifies a **queue-driven, stateless, multi-tenant gateway**. The two most critical FRD requirements — RabbitMQ consumption and correlation event publishing — are **completely unimplemented**. Redis (for token caching and deduplication) is installed as a dependency but never used. Rate limiting, circuit breakers, retry logic, dead-letter routing, structured logging, and Prometheus metrics are all absent.

### Severity Breakdown

| Category | Missing / Wrong |
|----------|----------------|
| **CRITICAL — Service cannot fulfill its purpose** | 6 items |
| **MAJOR — Resilience and correctness gaps** | 7 items |
| **MINOR — Observability and quality gaps** | 5 items |

---

## MVP Minimal Path (Basic Working Service)

To achieve a **minimally working** inbound message flow (WhatsApp → Genesys), only the following tasks are strictly required. Complete them in order.

| Priority | Task File | What it Fixes |
|----------|-----------|---------------|
| 1 | [T01](T01-rabbitmq-consumer.md) | RabbitMQ consumer — service never reads from queue |
| 2 | [T06](T06-tenant-config-schema.md) | `integrationId` missing from tenant.service.ts response |
| 3 | [T05](T05-genesys-api-endpoint.md) | Wrong API URL + wrong payload structure |
| 4 | [T04](T04-correlation-publisher.md) | Publish correlation event to state-manager |
| 5 | [T07](T07-auth-token-caching.md) | Token caching (Redis) — prevents hitting auth-service on every message |
| 6 | [T03](T03-payload-validation.md) | Input validation — prevent bad payloads crashing the consumer |

Without **T01 + T05 + T06 + T04**, messages will never flow end-to-end regardless of anything else.

---

## All Tasks — Dependency Order

```
T01 ──► T04 ──► T11 (DLQ)
  │
  └──► T03 (validation)

T02 ──► T07 (token cache)
     └─► T03 (deduplication)

T05 ──► T08 ──► T10 (circuit breaker)

T06 (no dependencies — unblocks T01, T05)

T12 (no dependencies — quick fix)
T09 (no dependencies)
T13 ─► T14 ─► T15
T16 (after all above)
```

---

## Full Task Index

| File | Title | Severity | MVP? | Depends On |
|------|-------|----------|------|------------|
| [T01](T01-rabbitmq-consumer.md) | RabbitMQ Consumer | CRITICAL | YES | — |
| [T02](T02-redis-integration.md) | Redis Client Setup | CRITICAL | Partial | — |
| [T03](T03-payload-validation.md) | Input Payload Validation | CRITICAL | YES | — |
| [T04](T04-correlation-publisher.md) | Correlation Event Publisher | CRITICAL | YES | T01 |
| [T05](T05-genesys-api-endpoint.md) | Fix Genesys API URL & Payload | CRITICAL | YES | T06 |
| [T06](T06-tenant-config-schema.md) | Tenant Config — integrationId | CRITICAL | YES | — |
| [T07](T07-auth-token-caching.md) | Auth Token Redis Caching | MAJOR | YES | T02 |
| [T08](T08-retry-backoff.md) | Retry with Exponential Backoff | MAJOR | No | T05 |
| [T09](T09-rate-limiting.md) | Per-Tenant Rate Limiting | MAJOR | No | — |
| [T10](T10-circuit-breaker.md) | Circuit Breaker | MAJOR | No | T08 |
| [T11](T11-dead-letter-queue.md) | Dead Letter Queue Routing | MAJOR | No | T01 |
| [T12](T12-http-timeouts.md) | HTTP Timeouts on axios | MAJOR | No | — |
| [T13](T13-health-checks.md) | Health Check — Readiness Probe | MINOR | No | T01, T02 |
| [T14](T14-structured-logging.md) | Structured JSON Logging | MINOR | No | — |
| [T15](T15-prometheus-metrics.md) | Prometheus Metrics Endpoint | MINOR | No | T14 |
| [T16](T16-tests.md) | Test Coverage Gaps | MINOR | No | All |

---

## What is Already Implemented (Correctly)

- Express HTTP server with correct port (3010)
- Swagger/OpenAPI docs endpoint (`/api-docs`)
- Genesys REST endpoint wrappers: getConversation, disconnectConversation, sendReceipt, typing indicator, getConversationMessages, getOrganizationUsers, getGenesysUser, getOrganizationDetails
- status-mapper for WhatsApp → Genesys status translation
- Basic error handler middleware
- Config module (port, service URLs)
- TypeScript project structure
- Dockerfile

These functions cover secondary/operational endpoints but the primary inbound message flow is broken.
