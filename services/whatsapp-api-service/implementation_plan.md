# WhatsApp API Service - Implementation Plan

## Goal

Implement a complete WhatsApp Business API integration for sending messages, templates, and media with robust error handling, rate limiting, multi-tenant support, and message status tracking.

## Phased Implementation

### Phase 1: WhatsApp Business API Integration (Priority: CRITICAL)
**Duration**: 2 weeks

#### 1.1 Authentication & Token Management
- **Files**:
  - `src/services/authService.ts` - Access token management
  - `src/integrations/whatsappAPI.client.ts` - API client
  - `src/config/whatsapp.config.ts` - API configuration

- **Implementation**:
  - Store tenant-specific access tokens (from tenant-service)
  - Implement token refresh mechanism
  - Validate token on startup
  - Handle token expiration errors
  - Support multiple business accounts per tenant

#### 1.2 Message Sending
- **Files**:
  - `src/services/messageSender.ts` - Message sending logic
  - `src/controllers/message.controller.ts` - HTTP endpoints

- **Implementation**:
  - Send text messages via Cloud API
  - Handle message responses (WAMID)
  - Validate phone number format
  - Add correlation ID tracking
  - Implement idempotency for duplicate sends

---

### Phase 2: Template Message Support (Priority: HIGH)
**Duration**: 1.5 weeks

#### 2.1 Template Catalog Management
- **Files**:
  - `src/services/templateService.ts` - Template management
  - `src/integrations/templateCatalog.client.ts` - Template API client
  - `src/models/Template.ts` - Template caching model

- **Implementation**:
  - Fetch template catalog from Meta's API
  - Cache templates in Redis (TTL: 24h)
  - Filter templates by approval status
  - Support template search by name
  - Track template usage metrics

#### 2.2 Template Message Sending
- **Files**:
  - `src/services/templateSender.ts` - Template sending logic

- **Implementation**:
  - Validate template name and language
  - Validate parameter count and types
  - Build template component structure
  - Handle template rejection errors
  - Support header/body/button parameters

---

### Phase 3: Media Handling (Priority: HIGH)
**Duration**: 1.5 weeks

#### 3.1 Media Upload
- **Files**:
  - `src/services/mediaUploader.ts` - Media upload service

- **Implementation**:
  - Upload media files to WhatsApp via Cloud API
  - Receive and store media IDs
  - Validate file types (image, video, document, audio)
  - Validate file size limits (WhatsApp restrictions)
  - Cache media IDs in Redis

#### 3.2 Media Message Sending
- **Files**:
  - `src/services/mediaSender.ts` - Media message sender

- **Implementation**:
  - Send image/video/document/audio messages
  - Support media by URL or uploaded ID
  - Add captions to media
  - Handle media upload errors

---

### Phase 4: RabbitMQ Integration (Priority: CRITICAL)
**Duration**: 1 week

#### 4.1 Message Queue Consumer
- **Files**:
  - `src/queue/consumer.ts` - RabbitMQ consumer
  - `src/config/rabbitmq.config.ts` - Queue configuration

- **Implementation**:
  - Consume from `whatsapp.outbound` queue
  - Implement prefetch for flow control
  - Acknowledge after successful send
  - Route to DLQ on failures
  - Support message priority

#### 4.2 Retry Queue
- **Files**:
  - `src/queue/retryPublisher.ts` - Retry queue publisher

- **Implementation**:
  - Publish failed messages to retry queue
  - Add exponential backoff delays
  - Track retry attempts
  - Move to DLQ after max retries (5)

---

### Phase 5: Error Handling & Resilience (Priority: HIGH)
**Duration**: 1.5 weeks

#### 5.1 WhatsApp Error Handling
- **Files**:
  - `src/services/errorHandler.ts` - Error handling logic
  - `src/errors/whatsappErrors.ts` - Error definitions

- **WhatsApp Error Codes**:
  - 130472 (rate limit) → Retry with backoff
  - 131026 (invalid phone number) → Send to DLQ
  - 131047 (template not approved) → Alert and DLQ
  - 131048 (template paused) → Alert
  - Network errors → Retry

#### 5.2 Circuit Breaker
- **Files**:
  - `src/middleware/circuitBreaker.ts` - Circuit breaker implementation

- **Implementation**:
  - Implement circuit breaker per business account
  - Open circuit on error threshold (50% over 1min)
  - Half-open state with test requests
  - Alert on circuit open

---

### Phase 6: Rate Limiting (Priority: HIGH)
**Duration**: 1 week

#### 6.1 Meta API Rate Limiting
- **Files**:
  - `src/services/rateLimiter.ts` - Rate limiting service
  - `src/config/rateLimits.config.ts` - Rate limit configuration

- **Implementation**:
  - Implement token bucket algorithm
  - Track rate limits per business account tier
  - Queue messages when rate limit approaching
  - Support business account tiers (Standard, Plus, Premium)
  - Add rate limit monitoring and alerting

---

### Phase 7: Multi-tenant Support (Priority: MEDIUM)
**Duration**: 1 week

#### 7.1 Tenant Configuration
- **Files**:
  - `src/middleware/tenantResolver.ts` - Tenant resolution
  - `src/integrations/tenantService.client.ts` - Tenant service client

- **Implementation**:
  - Load tenant-specific business account configurations
  - Support multiple business accounts per tenant
  - Apply tenant-specific rate limits
  - Isolate template catalogs per tenant

---

### Phase 8: Message Status Tracking (Priority: MEDIUM)
**Duration**: 1 week

#### 8.1 Status Update Handler
- **Files**:
  - `src/services/statusTracker.ts` - Message status tracking
  - `src/integrations/stateManager.client.ts` - State manager client

- **Implementation**:
  - Store WAMID to internal message ID mapping
  - Update message status in state-manager
  - Publish status updates to RabbitMQ
  - Handle status webhook from WhatsApp

---

### Phase 9: Business Account Management (Priority: LOW)
**Duration**: 1 week

#### 9.1 Account Operations
- **Files**:
  - `src/services/accountService.ts` - Account management

- **Implementation**:
  - Fetch business profile information
  - Update business profile
  - Monitor account health
  - Track account verification status
  - Collect account analytics

---

## Dependencies

```json
{
  "axios": "^1.6.2",
  "amqplib": "^0.10.3",
  "ioredis": "^5.3.2",
  "opossum": "^7.0.0",
  "libphonenumber-js": "^1.10.44"
}
```

**External Services**:
- WhatsApp Business Cloud API
- Tenant Service (business account credentials)
- State Manager (message tracking)
- RabbitMQ (message queues)
- Redis (caching, rate limiting)

---

## Verification Plan

### Unit Tests
- Message sending logic
- Template parameter validation
- Media upload and sending
- Error handling for all error codes
- Rate limiting algorithm

### Integration Tests
- Send message via Cloud API
- Template message with parameters
- Media upload and sending
- RabbitMQ consumption
- Rate limit enforcement

### Load Tests
```bash
k6 run tests/load/message-sending.js
```

**Targets**:
- Throughput: 100 messages/sec per business account
- Latency: <500ms (p95)
- Error rate: <0.1%

### Manual Testing
1. Send text message → verify delivery on WhatsApp
2. Send template message → verify formatting correct
3. Send image → verify media displays correctly
4. Trigger rate limit → verify queuing works
5. Test with invalid phone → verify error handling

---

## Rollback Strategy
- Feature flags for template and media features
- Queue messages can be reprocessed
- No database schema changes
- Maintain API backward compatibility
