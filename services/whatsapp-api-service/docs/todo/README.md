# WhatsApp API Service - Implementation Tasks

**Service:** whatsapp-api-service  
**FRD Version:** 2.0  
**Current Status:** ~25% Complete (REST API foundation only)  
**Gap Analysis:** See [gap-analysis.md](./gap-analysis.md)

---

## 📋 Overview

This directory contains implementation tasks to bridge the gap between the current implementation and the FRD requirements. Tasks are organized by dependency order in separate phase files.

---

## 🎯 MVP Task Subset

For a **basic working message pipeline**, complete these tasks in order:

### Phase 1: Infrastructure (CRITICAL) ⏱️ 3-4 days
**File:** [01-infrastructure.md](./01-infrastructure.md)

**Required Tasks:**
1. ✅ Install `amqplib` dependency
2. ✅ Create RabbitMQ configuration module
3. ✅ Implement RabbitMQ connection manager
4. ✅ Create message queue consumer
5. ✅ Update main entry point (remove REST API, keep health check)
6. ✅ Configure environment variables
7. ✅ Enhance health check endpoint

**Deliverable:** Service consumes from `outbound-processed` queue

---

### Phase 2: Core Features (CRITICAL) ⏱️ 4-5 days
**File:** [02-core-features.md](./02-core-features.md)

**Required Tasks:**
1. ✅ Create credential cache service (15min TTL)
2. ✅ Update tenant service integration with caching
3. ✅ Create error classification module
4. ✅ Implement retry handler with exponential backoff
5. ✅ Update WhatsApp service with error handling
6. ✅ Create message processor
7. ✅ Update consumer with processor integration
8. ✅ Configure Dead Letter Queue

**Deliverable:** Reliable message delivery with retry logic

---

### Phase 3: Reliability (MVP REQUIRED) ⏱️ 3-4 days
**File:** [03-reliability.md](./03-reliability.md)

**MVP Subset (Basic):**
1. ✅ Create rate limiter service (basic token bucket)
2. ✅ Integrate rate limiter with processor
3. ✅ Implement structured JSON logging
4. ✅ Add log sanitization (no token leakage)

**Optional for MVP (Can defer):**
- ⏸️ Circuit breakers (can add post-MVP)
- ⏸️ Backpressure mechanism (can add post-MVP)

**Deliverable:** Rate limiting prevents Meta API throttling

---

## 📊 Complete Implementation Path

### Phase 1: Infrastructure [01-infrastructure.md](./01-infrastructure.md)
**Status:** ❌ Not Started  
**Priority:** 🔴 Critical  
**Estimated Effort:** 3-4 days  

**Scope:**
- RabbitMQ consumer implementation
- Connection management with retry
- Message ACK/NACK logic
- Configuration updates
- Health check enhancement

**Why Critical:** Without this, service cannot fulfill its pipeline role.

---

### Phase 2: Core Features [02-core-features.md](./02-core-features.md)
**Status:** ❌ Not Started  
**Priority:** 🔴 Critical  
**Estimated Effort:** 4-5 days  

**Scope:**
- Credential caching system
- Error classification and handling
- Retry logic with exponential backoff
- Message processor
- Dead Letter Queue setup

**Why Critical:** Ensures reliable message delivery.

---

### Phase 3: Reliability [03-reliability.md](./03-reliability.md)
**Status:** ❌ Not Started  
**Priority:** 🟠 High  
**Estimated Effort:** 3-4 days  

**Scope:**
- Circuit breakers per tenant
- Rate limiting per tenant
- Structured logging
- Log sanitization
- Backpressure mechanism

**Why High:** Tenant isolation and production reliability.

---

### Phase 4: Observability [04-observability.md](./04-observability.md)
**Status:** ❌ Not Started  
**Priority:** 🟡 Medium  
**Estimated Effort:** 2-3 days  

**Scope:**
- Prometheus metrics (11 metrics)
- Enhanced health checks
- Alert rules configuration
- Metrics endpoint

**Why Medium:** Required for production monitoring, but MVP can run without it initially.

---

### Phase 5: Testing [05-testing.md](./05-testing.md)
**Status:** ❌ Not Started  
**Priority:** 🟢 Low (Quality)  
**Estimated Effort:** 5-7 days  

**Scope:**
- Unit tests (80% coverage)
- Integration tests (4 scenarios)
- Load tests (50 msg/s)
- Test infrastructure

**Why Low:** Critical for quality but can start with manual testing for MVP.

---

## 🚀 Recommended Execution Strategy

### Option A: Minimal MVP (10-12 days)
**Goal:** Basic working message pipeline

```
Phase 1 (Infrastructure) → Phase 2 (Core Features) → Phase 3 (Basic Rate Limiting)
```

**Result:** Service can reliably deliver messages with basic rate limiting.

**Missing:** Circuit breakers, comprehensive monitoring, tests

---

### Option B: Production-Ready (18-22 days)
**Goal:** Full production deployment

```
Phase 1 → Phase 2 → Phase 3 (Complete) → Phase 4 (Observability)
```

**Result:** Production-ready service with monitoring and tenant isolation.

**Missing:** Comprehensive test coverage (can add incrementally)

---

### Option C: Complete Implementation (25-30 days)
**Goal:** 100% FRD compliance

```
All 5 phases sequentially
```

**Result:** Fully compliant with FRD, comprehensive tests, production-ready.

---

## 📝 Task Execution Guidelines

### Before Starting
1. ✅ Review [gap-analysis.md](./gap-analysis.md)
2. ✅ Read the phase file completely
3. ✅ Understand dependencies
4. ✅ Set up local RabbitMQ instance

### During Implementation
1. Follow tasks in order (dependencies matter)
2. Run verification after each major task
3. Keep logs structured and searchable
4. Test with real RabbitMQ messages

### After Each Phase
1. Run verification plan
2. Update this README with status
3. Document any deviations
4. Review before next phase

---

## 🔧 Development Environment Setup

### Prerequisites
```bash
# Local RabbitMQ
docker run -d --name rabbitmq \
  -p 5672:5672 -p 15672:15672 \
  rabbitmq:3-management

# Local Tenant Service (mock or real)
# Ensure it's running on configured URL
```

### Environment Variables
See `01-infrastructure.md` for complete list. Minimum:
```bash
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VHOST=/whatsapp
TENANT_SERVICE_URL=http://localhost:3007
```

---

## 📈 Progress Tracking

### Current Completion by Feature

| Feature | Status | Phase | Priority |
|---------|--------|-------|----------|
| Basic REST API | ✅ Done | - | - |
| RabbitMQ Consumer | ❌ Missing | 1 | 🔴 Critical |
| Credential Caching | ❌ Missing | 2 | 🔴 Critical |
| Error Handling | ❌ Missing | 2 | 🔴 Critical |
| Retry Logic | ❌ Missing | 2 | 🔴 Critical |
| Rate Limiting | ❌ Missing | 3 | 🟠 High |
| Circuit Breakers | ❌ Missing | 3 | 🟠 High |
| Prometheus Metrics | ❌ Missing | 4 | 🟡 Medium |
| Health Checks | ⚠️ Basic | 4 | 🟡 Medium |
| Unit Tests | ⚠️ Setup Only | 5 | 🟢 Low |
| Integration Tests | ❌ Missing | 5 | 🟢 Low |

**Overall:** ~25% Complete

---

## 🐛 Known Issues

### Architecture Mismatch
- Current: HTTP REST API server
- Required: RabbitMQ consumer worker
- **Impact:** Cannot fulfill egress gateway role
- **Resolution:** Phase 1 (complete refactor)

### Missing Features
- No message queue integration
- No credential caching (performance issue)
- No error handling/retry (reliability issue)
- No tenant isolation (multi-tenant risk)

### Performance Concerns
- Fetching credentials on every request (should cache)
- No connection pooling
- No rate limiting (risk of Meta API throttling)

---

## 📚 Additional Resources

- **FRD:** `../whatsapp-api-frd.md`
- **Gap Analysis:** `./gap-analysis.md`
- **OpenAPI Spec:** `../openapi.yaml`
- **Meta API Docs:** https://developers.facebook.com/docs/whatsapp/cloud-api

---

## 🆘 Getting Help

### Common Questions

**Q: Can I skip Phase 3 for MVP?**  
A: You can defer circuit breakers and backpressure, but rate limiting is strongly recommended to avoid Meta API throttling.

**Q: Do I need to complete Phase 5 before deploying?**  
A: No, but you should have at least basic integration tests. Manual testing is acceptable for MVP.

**Q: Can I implement phases in parallel?**  
A: No, phases have strict dependencies. Follow the order.

**Q: What if I find issues with the FRD?**  
A: Document deviations in phase files and update gap analysis.

---

## ✅ Success Criteria

### MVP Success
- ✅ Service consumes from `outbound-processed` queue
- ✅ Messages delivered to Meta Graph API
- ✅ Credentials cached (no repeated fetches)
- ✅ Retryable errors retry with backoff
- ✅ Non-retryable errors go to DLQ
- ✅ Rate limiting prevents throttling
- ✅ Health check returns service status

### Production Success
All MVP criteria plus:
- ✅ Circuit breakers prevent cascading failures
- ✅ Prometheus metrics exposed
- ✅ Structured logging to stdout
- ✅ Tenant isolation verified
- ✅ Load test: 50 msg/s sustained
- ✅ Error rate < 1%

---

**Last Updated:** 2026-02-13  
**Reviewed By:** [Pending]  
**Status:** Ready for implementation
