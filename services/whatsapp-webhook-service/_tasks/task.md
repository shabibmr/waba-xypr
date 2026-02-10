# WhatsApp Webhook Service - Implementation Tasks

> **Scope:** Tasks specific to the `whatsapp-webhook-service` microservice only. External service integrations are noted but their implementation is outside this service's scope.

## 🔴 CRITICAL PRIORITY (Core Service Functionality)

### Phase 1: Webhook Endpoint & Request Handling
- [ ] Create main webhook POST endpoint (`src/routes/webhook.routes.ts`)
- [ ] Implement request body parsing and validation
- [ ] Add tenant resolution with Redis caching (`src/middleware/tenantResolver.ts`)
- [ ] Create webhook configuration module (`src/config/webhook.config.ts`)
- [ ] Implement fast 200 OK response pattern (< 200ms)

### Phase 2: RabbitMQ Message Publishing
- [ ] Implement message publisher to `INBOUND_WHATSAPP_MESSAGES` queue (`src/queue/publisher.ts`)
- [ ] Add publisher confirms and message persistence (durable queues)
- [ ] Implement connection retry logic with exponential backoff
- [ ] Add connection pool management
- [ ] Create RabbitMQ configuration (`src/config/rabbitmq.config.ts`)
- [ ] Add dead letter queue (DLQ) configuration

---


## 🟠 HIGH PRIORITY (Message Processing & Storage)

### Phase 3: Message Type Processors
- [ ] Implement text message processor (`src/processors/textMessage.processor.ts`)
- [ ] Implement image message processor (`src/processors/imageMessage.processor.ts`)
- [ ] Implement document message processor (`src/processors/documentMessage.processor.ts`)
- [ ] Implement video message processor (`src/processors/videoMessage.processor.ts`)
- [ ] Implement audio/voice message processor (`src/processors/audioMessage.processor.ts`)
- [ ] Implement location message processor (`src/processors/locationMessage.processor.ts`)
- [ ] Implement contact message processor (`src/processors/contactMessage.processor.ts`)
- [ ] Implement interactive message processor (buttons/lists) (`src/processors/interactiveMessage.processor.ts`)
- [ ] Implement reaction message processor (`src/processors/reactionMessage.processor.ts`)
- [ ] Implement sticker message processor (`src/processors/stickerMessage.processor.ts`)
- [ ] Create processor factory pattern (`src/processors/processorFactory.ts`)

### Phase 4: Status Update Handler
- [ ] Implement status update processor for sent/delivered/read/failed (`src/processors/statusUpdate.processor.ts`)
- [ ] Emit status change events to RabbitMQ
- [ ] Handle error statuses and failures

### Phase 5: Media Download & Storage
- [ ] Create WhatsApp Media API client (`src/integrations/whatsappMedia.client.ts`)
- [ ] Implement media download service with streaming support (`src/services/mediaDownloader.ts`)
- [ ] Add media file type and size validation
- [ ] Implement retry logic for failed downloads
- [ ] Implement MinIO storage service (`src/services/mediaStorage.ts`)
- [ ] Create MinIO configuration (`src/config/minio.config.ts`)
- [ ] Generate unique file paths: `{tenantId}/{mediaType}/{date}/{messageId}.{ext}`
- [ ] Implement presigned URL generation (1-hour expiry)
- [ ] Add concurrent download handling for multiple media files

### Phase 6: Raw Webhook Storage
- [ ] Implement webhook payload storage to MinIO (`src/services/webhookStorage.ts`)
- [ ] Store at path: `/webhooks-inbound/{tenantId}/{yyyy-MM-dd}/{timestamp}-{messageId}.json`
- [ ] Add successful storage confirmation logging
- [ ] Implement storage error handling (continue processing even if storage fails)

---

## 🟡 MEDIUM PRIORITY (Optimization & Resilience)

### Phase 7: Redis Caching Layer
- [ ] Implement tenant configuration caching (`src/cache/tenantCache.ts`)
- [ ] Add WhatsApp access token caching (24-hour TTL)
- [ ] Implement cache invalidation strategy
- [ ] Add cache warming for frequently accessed tenants
- [ ] Monitor cache hit rates

### Phase 8: HTTP Clients for External Services
- [ ] Create State Manager HTTP client (`src/integrations/stateManager.client.ts`)
  - [ ] GET `/state/mapping/:waId` endpoint
  - [ ] POST `/state/message` endpoint
  - [ ] Add retry logic and circuit breaker
- [ ] Create Tenant Service HTTP client (`src/integrations/tenantService.client.ts`)
  - [ ] GET `/tenants/by-business-account/:id` endpoint
  - [ ] Add response caching
- [ ] Create WhatsApp Business API client (`src/integrations/whatsappAPI.client.ts`)
  - [ ] GET `/v18.0/{media_id}` for media download
  - [ ] GET `/v18.0/{phone_number_id}` for profile lookup
  - [ ] Handle rate limiting (80 requests/sec)

### Phase 9: Message Normalization
- [ ] Create message normalizer (`src/transformers/messageNormalizer.ts`)
- [ ] Normalize all message types to common internal format
- [ ] Add correlation IDs (UUID v4) for distributed tracing
- [ ] Enrich with timestamp, source, and tenant metadata
- [ ] Prepare standardized payload for RabbitMQ publishing

### Phase 10: Error Handling & Recovery
- [ ] Create global error handler middleware (`src/middleware/errorHandler.ts`)
- [ ] Implement correlation ID tracking (`src/middleware/correlationId.ts`)
- [ ] Add structured error logging with context
- [ ] Implement failed webhook storage to MinIO for replay
- [ ] Create webhook replay service (`src/services/webhookReplay.ts`)
- [ ] Ensure 200 OK response to Meta even on processing errors
- [ ] Add alerting for critical failures (connection loss, storage failures)

### Phase 11: Rate Limiting
- [ ] Implement Redis-based rate limiting per Business Account (`src/middleware/rateLimiter.ts`)
- [ ] Add sliding window rate limit algorithm
- [ ] Configure limits: 1000 requests/min per tenant
- [ ] Add rate limit response headers (X-RateLimit-*)
- [ ] Log rate limit violations

---

## 🟢 LOW PRIORITY (Operations & Monitoring)

### Phase 12: Observability
- [ ] Implement structured logging with Winston (`src/utils/logger.ts`)
- [ ] Add correlation ID to all log entries
- [ ] Create Prometheus metrics endpoint (`src/middleware/metrics.ts`)
  - [ ] `webhook_received_total` (counter: tenant, message_type, status)
  - [ ] `webhook_processing_duration_seconds` (histogram)
  - [ ] `media_download_duration_seconds` (histogram)
  - [ ] `media_download_size_bytes` (histogram)
  - [ ] `minio_upload_duration_seconds` (histogram)
  - [ ] `rabbitmq_publish_total` (counter: status)
  - [ ] `rabbitmq_publish_failures_total` (counter)
  - [ ] `cache_hit_total` / `cache_miss_total` (counters)
- [ ] Create health check endpoint GET `/health` (`src/routes/health.routes.ts`)
- [ ] Create readiness check endpoint GET `/ready`
  - [ ] Check RabbitMQ connection
  - [ ] Check Redis connection
  - [ ] Check MinIO connection
- [ ] Add request/response logging middleware with sanitization (remove PII)

### Phase 13: Request Deduplication
- [ ] Implement message ID deduplication with Redis (`src/middleware/deduplication.ts`)
- [ ] Add TTL-based deduplication cache (24 hours)
- [ ] Handle duplicate webhook deliveries from Meta gracefully
- [ ] Return 200 OK for duplicates without reprocessing

### Phase 14: Configuration & Environment
- [ ] Create `.env.example` with all required variables
- [ ] Implement environment variable validation on startup (`src/config/validateEnv.ts`)
- [ ] Create configuration loader with defaults (`src/config/index.ts`)
- [ ] Add configuration documentation in README

### Phase 15: Customer Profile Enrichment
- [ ] Implement customer profile lookup from WhatsApp Business API
- [ ] Add phone number formatting (E.164) (`src/utils/phoneFormatter.ts`)
- [ ] Extract customer name and profile picture
- [ ] Add business vs personal account detection
- [ ] Include customer data in normalized message payload

---

## 🧪 TESTING & DOCUMENTATION

### Unit Tests
- [ ] Test tenant resolution logic
- [ ] Test all message type processors (10 processors)
- [ ] Test media download and upload services
- [ ] Test message normalization
- [ ] Test RabbitMQ publisher
- [ ] Test error handling middleware
- [ ] Test rate limiting logic
- [ ] Test deduplication logic
- [ ] Test Redis caching layer
- [ ] Test correlation ID generation and propagation

### Integration Tests
- [ ] Test end-to-end webhook processing (webhook → queue)
- [ ] Test media download from WhatsApp → upload to MinIO flow
- [ ] Test RabbitMQ message publishing and confirms
- [ ] Test tenant resolution (cache hit/miss scenarios)
- [ ] Test error scenarios (external service failures)
- [ ] Test duplicate webhook handling
- [ ] Test rate limiting enforcement

### Load/Performance Tests
- [ ] Load test webhook endpoint (target: 500 webhooks/sec)
- [ ] Verify webhook response time < 200ms (p95)
- [ ] Test media download performance for various file sizes
- [ ] Benchmark RabbitMQ throughput
- [ ] Test Redis cache performance
- [ ] Verify graceful degradation under load

### Documentation
- [ ] Create API documentation (OpenAPI/Swagger spec)
- [ ] Document webhook payload examples (all message types)
- [ ] Create architecture diagram for this service
- [ ] Document environment variables and configuration
- [ ] Create deployment guide (Docker/Kubernetes)
- [ ] Write operational runbook
  - [ ] How to replay failed webhooks
  - [ ] How to monitor service health
  - [ ] Common troubleshooting scenarios
- [ ] Document RabbitMQ queue schemas
- [ ] Document MinIO bucket structure and retention policies

---

## 📦 Dependencies & Integrations

### NPM Dependencies
```json
{
  "express": "^4.18.2",
  "axios": "^1.6.2",
  "amqplib": "^0.10.3",
  "minio": "^7.1.3",
  "ioredis": "^5.3.2",
  "winston": "^3.11.0",
  "prom-client": "^15.1.0",
  "libphonenumber-js": "^1.10.44",
  "uuid": "^9.0.1",
  "dotenv": "^16.3.1"
}
```

### External Services (Integration Points)
> **Note:** These services must exist and provide the documented APIs. Implementation is NOT part of this service.

- **Meta WhatsApp Business API**
  - POST webhooks to this service
  - Media download: GET `/v18.0/{media_id}`
  - Profile lookup: GET `/v18.0/{phone_number_id}`

- **State Manager Service**
  - GET `/state/mapping/:waId` - Conversation mapping
  - POST `/state/message` - Message tracking

- **Tenant Service**
  - GET `/tenants/by-business-account/:id` - Tenant resolution

- **RabbitMQ**
  - Queue: `INBOUND_WHATSAPP_MESSAGES`
  - Exchange: `whatsapp.inbound`

- **MinIO**
  - Bucket: `webhooks-inbound` (raw payloads)
  - Bucket: `media-inbound` (customer media)

- **Redis**
  - Cache tenant configurations
  - Cache WhatsApp tokens
  - Rate limiting counters
  - Message deduplication

---

## ⏭️ Skipped Tasks (Not Required)

The following tasks were reviewed and marked as not required for the current implementation:

### Security Features
- ~~Implement HMAC SHA-256 signature verification~~ - Skipped
- ~~Create webhook challenge verification endpoint (GET `/webhook/meta`)~~ - Skipped
- ~~Add replay attack prevention (timestamp validation)~~ - Skipped
- ~~Implement IP whitelisting for Meta's IP ranges~~ - Skipped

### Media Processing
- ~~Integrate malware scanning (ClamAV/VirusTotal)~~ - Skipped

> **Note:** These tasks can be revisited in future iterations if security or compliance requirements change.

---

## 🎯 Success Metrics

**Performance Targets:**
- ✅ Webhook response time: < 200ms (p95)
- ✅ Message processing (async): < 500ms
- ✅ Media download: < 3s per file
- ✅ Throughput: 500 webhooks/sec per instance
- ✅ Redis cache hit rate: > 90%

**Reliability Targets:**
- ✅ Zero message loss (RabbitMQ persistence + publisher confirms)
- ✅ 99.9% webhook acceptance (200 OK response)
- ✅ Automatic retry for transient failures
- ✅ All webhooks audited in MinIO storage

**Operational Targets:**
- ✅ All errors have correlation IDs for tracing
- ✅ Metrics available for all critical operations
- ✅ Health checks respond in < 100ms
- ✅ Failed webhooks can be replayed manually

---

## 📊 Implementation Progress Tracking

| Phase | Focus Area | Tasks | Completion |
|-------|-----------|-------|------------|
| Phase 1 | Webhook Endpoint | 5 | `[ ]` 0% |
| Phase 2 | RabbitMQ Publishing | 6 | `[ ]` 0% |
| Phase 3 | Message Processors | 11 | `[ ]` 0% |
| Phase 4 | Status Updates | 3 | `[ ]` 0% |
| Phase 5 | Media Download/Storage | 9 | `[ ]` 0% |
| Phase 6 | Raw Webhook Storage | 4 | `[ ]` 0% |
| Phase 7 | Redis Caching | 5 | `[ ]` 0% |
| Phase 8 | HTTP Clients | 3 clients | `[ ]` 0% |
| Phase 9 | Message Normalization | 5 | `[ ]` 0% |
| Phase 10 | Error Handling | 7 | `[ ]` 0% |
| Phase 11 | Rate Limiting | 5 | `[ ]` 0% |
| Phase 12 | Observability | 9 | `[ ]` 0% |
| Phase 13 | Deduplication | 4 | `[ ]` 0% |
| Phase 14 | Configuration | 4 | `[ ]` 0% |
| Phase 15 | Customer Enrichment | 5 | `[ ]` 0% |
| Testing | Unit/Integration/Load | 30+ | `[ ]` 0% |
| Documentation | API/Deployment/Runbook | 8 | `[ ]` 0% |

**Total Active Tasks:** ~120 tasks for whatsapp-webhook-service only


---

## ⏭️ Skipped Tasks (Not Required)

The following tasks were reviewed and marked as not required for the current implementation:

### Security Features
- ~~Implement HMAC SHA-256 signature verification~~ - Skipped
- ~~Create webhook challenge verification endpoint (GET `/webhook/meta`)~~ - Skipped
- ~~Add replay attack prevention (timestamp validation)~~ - Skipped
- ~~Implement IP whitelisting for Meta's IP ranges~~ - Skipped

### Media Processing
- ~~Integrate malware scanning (ClamAV/VirusTotal)~~ - Skipped

> **Note:** These tasks can be revisited in future iterations if security or compliance requirements change.

---

## 🎯 Success Metrics

**Performance Targets:**
- ✅ Webhook response time: < 200ms (return 200 quickly)
- ✅ Message processing: < 500ms (async)
- ✅ Media processing: < 3s
- ✅ Throughput: 500 webhooks/sec per instance
- ✅ Cache hit rate: > 90%

**Reliability Targets:**
- ✅ Zero message loss (RabbitMQ persistence)
- ✅ 99.9% uptime
- ✅ Automatic retry for transient failures
- ✅ All webhooks logged for audit

---

## 📊 Implementation Progress Tracking

| Phase | Status | Completion % |
|-------|--------|--------------|
| Phase 1: Webhook Security | `[ ]` | 0% |
| Phase 2: Message Type Handling | `[ ]` | 0% |
| Phase 3: Media Processing | `[ ]` | 0% |
| Phase 4: Customer Processing | `[ ]` | 0% |
| Phase 5: Transformation & Routing | `[ ]` | 0% |
| Phase 6: State Manager Integration | `[ ]` | 0% |
| Phase 7: Multi-tenant Support | `[ ]` | 0% |
| Phase 8: Error Handling | `[ ]` | 0% |
| Phase 9: Observability | `[ ]` | 0% |
| Phase 10: Testing & Documentation | `[ ]` | 0% |

**Overall Progress:** 0% (0/100+ tasks completed)
