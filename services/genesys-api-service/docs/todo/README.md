# Genesys API Service — Implementation Status & Gap Analysis

**Analysis Date:** 2026-02-12
**Current State:** Core MVP Inbound Flow Implemented 🟢

## Executive Summary

The core inbound message flow (WhatsApp → RabbitMQ → Genesys) is **IMPLEMENTED**. The original "todo" list stated that the service was just a skeleton, but analysis reveals that the critical path (Consumer, Validation, Redis Dedupe, Token Caching, Genesys API, Correlation Event) is largely complete.

However, operational resilience features (Rate Limiting, Circuit Breaker) and observability (Prometheus, Structured JSON Logs) are still missing. Use this document to track remaining work for Production Readiness.

---

## MVP Feature Matrix

| Feature | ID | Status | Implementation Details |
|---------|----|--------|------------------------|
| **RabbitMQ Consumer** | T01 | ✅ Done | `src/consumers/inbound.consumer.ts` listens on `inbound-processed` |
| **Redis Integration** | T02 | ✅ Done | `src/services/redis.service.ts` (Fail-open design) |
| **Payload Validation** | T03 | ✅ Done | `src/utils/validate-payload.ts` validates FRD 5.1 schema |
| **Correlation Publisher** | T04 | ✅ Done | Publishes to `correlation-events` in `src/services/rabbitmq.service.ts` |
| **Genesys API Endpoint** | T05 | ✅ Done | Uses Open Messaging Inbound `api/v2/.../open` |
| **Tenant IntegrationId** | T06 | ✅ Done | Validates `integrationId` availability in consumer |
| **Auth Token Caching** | T07 | ✅ Done | Caches tokens in Redis with TTL buffer (`src/services/auth.service.ts`) |
| **Retry / Backoff** | T08 | ⚠️ Partial | Basic `nack(requeue=true)` implemented. **Missing:** Exponential backoff delays. |
| **Rate Limiting** | T09 | 🔴 Missing | No rate limiting logic found. |
| **Circuit Breaker** | T10 | 🔴 Missing | No circuit breaker found. |
| **Dead Letter Queue** | T11 | ✅ Done | Routes bad JSON/validation/4xx errors to `genesys-api-dlq` |
| **HTTP Timeouts** | T12 | ✅ Done | Default 10s timeout set in `genesys-api.service.ts` |
| **Health Checks** | T13 | ⚠️ Partial | Basic `/health` endpoint exists. **Missing:** Deep checks (Redis/RabbitMQ connectivity). |
| **Structured Logging** | T14 | ⚠️ Partial | `src/utils/logger.ts` uses console with prefixes. **Missing:** JSON format. |
| **Prometheus Metrics** | T15 | 🔴 Missing | No metrics endpoint. |
| **Test Coverage** | T16 | 🔴 Poor | Only skeleton tests exist in `tests/`. |

---

## Remaining Work for Production (Prioritized)

These are the items that still need to be done to move from "Code Complete" to "Production Ready".

### 1. High Priority (Reliability)

- [ ] **[T08] Exponential Backoff**: Implement a retry strategy that waits before requeuing (e.g., using a delay queue or RabbitMQ delayed message plugin if available, or simple `setTimeout` before nack if concurrency allows).
- [ ] **[T13] Deep Health Check**: Update `/health` to check `rabbitmq.isConnected()` and `redis.ping()`. Faking healthy when dependencies are down causes issues in orchestration.

### 2. Medium Priority (Protection)

- [ ] **[T09] Rate Limiting**: Implement per-tenant rate limiting (using Redis) to prevent one tenant from starving others or hitting Genesys limits.
- [ ] **[T10] Circuit Breaker**: Wrap `axios` calls to Genesys in a circuit breaker (e.g., `opossum`) to fail fast when Genesys is down.

### 3. Low Priority (Observability)

- [ ] **[T14] JSON Logging**: Replace `console.log` with `winston` or `pino` for proper JSON structured logging.
- [ ] **[T15] Prometheus**: Add `prom-client` and expose `/metrics`.

### 4. Technical Debt

- [ ] **[T16] Testing**: Write properties unit tests for `validate-payload` and integration tests for the consumer.

---

## Code Reference

- **Consumer Entry**: `src/index.ts` -> `src/consumers/inbound.consumer.ts`
- **Genesys Logic**: `src/services/genesys-api.service.ts`
- **Configuration**: `src/config/config.ts`
