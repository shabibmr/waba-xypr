# Gap Analysis: WhatsApp API Service

**Analysis Date:** 2026-02-13  
**Service:** whatsapp-api-service  
**FRD Version:** 2.0  
**Implementation Status:** MVP α (Early Stage)

---

## Executive Summary

### Current Implementation
The service is implemented as a **REST API wrapper** around Meta Graph API with:
- ✅ Basic message sending (text, template, image, document, location, buttons)
- ✅ Tenant credential integration
- ✅ Express HTTP server
- ❌ **NO RabbitMQ consumer** (critical gap)
- ❌ **NO credential caching**
- ❌ **NO error handling/retry logic**
- ❌ **NO tenant isolation mechanisms**

### FRD Expectation
The service should be a **message queue consumer** that:
- Consumes from `outbound-processed` queue
- Implements credential caching (15min TTL)
- Handles Meta API errors with retry logic
- Provides per-tenant circuit breakers and rate limiting
- Exposes Prometheus metrics and health checks

---

## Critical Architecture Mismatch

| Aspect | FRD Requirement | Current Implementation | Status |
|--------|----------------|----------------------|--------|
| **Service Type** | RabbitMQ consumer (worker) | HTTP REST API server | ❌ **CRITICAL** |
| **Input** | RabbitMQ queue `outbound-processed` | HTTP POST requests | ❌ **CRITICAL** |
| **Message Format** | Queue envelope with metadata + wabaPayload | Direct API request bodies | ❌ **CRITICAL** |
| **Deployment** | Background worker (no HTTP) | HTTP server on port 3008 | ❌ **CRITICAL** |

> **Impact:** The current implementation cannot serve the FRD purpose as an egress gateway for the message pipeline.

---

## Detailed Feature Gaps

### 1. Message Consumption (REQ-OUT-01) ❌
| Feature | Required | Implemented | Gap |
|---------|----------|-------------|-----|
| RabbitMQ consumer | ✅ Required | ❌ None | **MISSING** |
| Queue: `outbound-processed` | ✅ Required | ❌ None | **MISSING** |
| Prefetch count config | ✅ Required (10) | ❌ None | **MISSING** |
| Message ACK/NACK logic | ✅ Required | ❌ None | **MISSING** |
| Auto-reconnect on failure | ✅ Required | ❌ None | **MISSING** |

**Dependencies:** `amqplib`, RabbitMQ connection config

---

### 2. Credential Management (REQ-AUTH-01) ⚠️
| Feature | Required | Implemented | Gap |
|---------|----------|-------------|-----|
| Tenant Service integration | ✅ Required | ✅ Basic | **PARTIAL** |
| Credential caching (15min TTL) | ✅ Required | ❌ None | **MISSING** |
| Cache invalidation on 401/403 | ✅ Required | ❌ None | **MISSING** |
| Retry on fetch failure | ✅ Required | ❌ None | **MISSING** |
| Endpoint format | `/tenants/{id}/credentials?type=whatsapp` | `/tenants/{id}/credentials/meta` | **MISMATCH** |

**Current:** Direct axios call on every request  
**Required:** In-memory cache with Map structure, TTL management

---

### 3. Meta API Integration (REQ-OUT-02) ⚠️
| Feature | Required | Implemented | Gap |
|---------|----------|-------------|-----|
| Send text messages | ✅ Required | ✅ Implemented | ✅ **OK** |
| Send template messages | ✅ Required | ✅ Implemented | ✅ **OK** |
| Send media (image/doc) | ✅ Required | ✅ Implemented | ✅ **OK** |
| Send location | ✅ Required | ✅ Implemented | ✅ **OK** |
| Send interactive buttons | ✅ Required | ✅ Implemented | ✅ **OK** |
| Mark as read | ✅ Required | ✅ Implemented | ✅ **OK** |
| Connection pooling (100/tenant) | ✅ Required | ❌ Default axios | **MISSING** |
| HTTP keep-alive | ✅ Required | ❌ Default axios | **MISSING** |
| Request timeout (10s) | ✅ Required | ❌ None | **MISSING** |
| Custom User-Agent header | ✅ Required | ❌ None | **MISSING** |
| Structured logging (WAMID) | ✅ Required | ⚠️ Partial | **INCOMPLETE** |

---

### 4. Error Handling (REQ-ERR-01) ❌
| Feature | Required | Implemented | Gap |
|---------|----------|-------------|-----|
| Error classification matrix | ✅ Required (17 codes) | ❌ None | **MISSING** |
| Retry logic (retryable errors) | ✅ Required | ❌ None | **MISSING** |
| Exponential backoff w/ jitter | ✅ Required | ❌ None | **MISSING** |
| Non-retryable error detection | ✅ Required | ❌ None | **MISSING** |
| Dead letter queue routing | ✅ Required | ❌ None | **MISSING** |
| Special handling (131047, 401) | ✅ Required | ❌ None | **MISSING** |
| Meta error parsing | ✅ Required | ❌ Basic catch | **MISSING** |

**Current:** Generic try/catch, errors forwarded to Express error handler  
**Required:** Detailed error classification, per-error retry strategy, DLQ

---

### 5. Tenant Isolation (REQ-ISO-01) ❌
| Feature | Required | Implemented | Gap |
|---------|----------|-------------|-----|
| Per-tenant circuit breakers | ✅ Required | ❌ None | **MISSING** |
| Per-tenant rate limiting | ✅ Required | ❌ None | **MISSING** |
| Isolated credential caching | ✅ Required | ❌ None | **MISSING** |
| Failure isolation | ✅ Required | ❌ None | **MISSING** |

**Impact:** One tenant's failures could block queue, no rate limit enforcement

---

### 6. Observability (NFR-OBS-01) ❌
| Feature | Required | Implemented | Gap |
|---------|----------|-------------|-----|
| Prometheus metrics | ✅ Required (11 metrics) | ❌ None | **MISSING** |
| Health check endpoint (`/health`) | ✅ Required | ⚠️ Basic | **PARTIAL** |
| Structured JSON logging | ✅ Required | ⚠️ Partial | **INCOMPLETE** |
| Metric labels (tenant, status) | ✅ Required | ❌ None | **MISSING** |
| Queue depth monitoring | ✅ Required | ❌ None | **MISSING** |

**Current:** Basic console logs, simple `/health` endpoint  
**Required:** prom-client integration, detailed metrics, health checks for all deps

---

### 7. Configuration (Deployment) ⚠️
| Feature | Required | Implemented | Gap |
|---------|----------|-------------|-----|
| RabbitMQ config | ✅ Required (7 params) | ❌ None | **MISSING** |
| Meta API config | ✅ Required (5 params) | ⚠️ Partial (2) | **INCOMPLETE** |
| Credential cache TTL | ✅ Required | ❌ None | **MISSING** |
| Circuit breaker config | ✅ Required | ❌ None | **MISSING** |
| Rate limiter config | ✅ Required | ❌ None | **MISSING** |

**Current:** Minimal config (port, tenant URL, API version)  
**Required:** Comprehensive config for all FRD parameters

---

### 8. Testing (Section 6) ❌
| Feature | Required | Implemented | Gap |
|---------|----------|-------------|-----|
| Unit tests (80% coverage) | ✅ Required | ⚠️ Setup only | **MISSING** |
| Integration tests (4 scenarios) | ✅ Required | ❌ None | **MISSING** |
| Load tests (50 msg/s) | ✅ Required | ❌ None | **MISSING** |

**Current:** Jest config + setup file, no actual tests  
**Required:** Comprehensive test suite as per FRD Section 6

---

## Summary by Priority

### 🔴 Critical Gaps (Blocks MVP)
1. **RabbitMQ consumer implementation** - Service cannot fulfill pipeline role
2. **Message processing loop** - Queue → Credentials → Meta API → ACK/NACK
3. **Error handling matrix** - Required for reliability
4. **Credential caching** - Performance and rate limit management

### 🟠 High Priority (MVP Required)
5. **Retry logic with backoff** - Message delivery reliability
6. **Dead letter queue** - Failed message handling
7. **Per-tenant rate limiting** - Prevent Meta API throttling
8. **Structured logging** - Operational visibility

### 🟡 Medium Priority (Post-MVP)
9. **Circuit breakers** - Tenant isolation
10. **Prometheus metrics** - Production monitoring
11. **Enhanced health checks** - Dependency monitoring
12. **Connection pooling** - Performance optimization

### 🟢 Low Priority (Enhancement)
13. **Load testing** - Capacity validation
14. **Advanced alerting** - Operational excellence

---

## Implementation Status by FRD Section

| Section | Title | Completion | Status |
|---------|-------|------------|--------|
| 3.1 | Input Message Schema | 0% | ❌ Not consuming queue |
| 3.2 | Tenant Credentials | 40% | ⚠️ No caching |
| 3.3 | Meta Graph API | 70% | ⚠️ Missing error handling |
| 4.1 | Message Consumption | 0% | ❌ **CRITICAL** |
| 4.2 | Credential Retrieval | 30% | ⚠️ No caching/retry |
| 4.3 | Message Delivery | 60% | ⚠️ Basic only |
| 4.4 | Error Handling | 0% | ❌ **CRITICAL** |
| 4.5 | Tenant Isolation | 0% | ❌ **CRITICAL** |
| 5.1 | Performance (NFR) | 20% | ⚠️ No optimization |
| 5.2 | Reliability (NFR) | 10% | ⚠️ No retry/DLQ |
| 5.3 | Observability (NFR) | 15% | ⚠️ Minimal logging |
| 5.4 | Security (NFR) | 40% | ⚠️ No log sanitization |
| 6 | Testing | 5% | ❌ Setup only |

**Overall Completion:** ~25% (REST API foundation only)

---

## Recommendations

### For MVP (Minimal Working)
Focus on tasks in this order:
1. **01-infrastructure.md** - RabbitMQ consumer + basic queue processing
2. **02-core-features.md** - Credential caching + error classification
3. **03-reliability.md** - Retry logic + DLQ + rate limiting (basic)

This provides a **working message pipeline** that can deliver messages reliably.

### For Production
Additionally complete:
4. **04-observability.md** - Metrics + health checks + structured logging
5. **03-reliability.md** (advanced) - Circuit breakers + advanced rate limiting
6. **05-testing.md** - Comprehensive test coverage

---

## Next Steps

1. Review task files in `docs/todo/`:
   - `01-infrastructure.md` - Foundation (RabbitMQ, config)
   - `02-core-features.md` - Core logic (cache, error handling)
   - `03-reliability.md` - Resilience (retry, isolation)
   - `04-observability.md` - Monitoring
   - `05-testing.md` - Quality assurance

2. Start with **01-infrastructure.md** for MVP foundation

3. Reference `README.md` for MVP task subset and sequencing
