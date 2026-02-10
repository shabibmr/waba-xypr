# Genesys API Service - Implementation Plan

## Goal

Build a comprehensive integration with Genesys Cloud Open Messaging API for sending messages, managing conversations, and handling participants with robust error handling, rate limiting, and multi-tenant support.

## Phased Implementation

### Phase 1: Genesys Open Messaging API Integration (Priority: CRITICAL)
**Duration**: 2 weeks

#### 1.1 OAuth Authentication
- **Files**:
  - `src/services/genesysAuth.ts` - OAuth token management
  - `src/integrations/genesysAPI.client.ts` - API client
  - `src/config/genesys.config.ts` - Configuration

- **Implementation**:
  - Implement OAuth 2.0 client credentials flow
  - Store client ID and secret per tenant
  - Refresh access tokens before expiry
  - Handle token expiration errors
  - Support multiple Genesys organizations per tenant

#### 1.2 Conversation Management
- **Files**:
  - `src/services/conversationService.ts` - Conversation operations
  - `src/controllers/conversation.controller.ts` - HTTP endpoints

- **Implementation**:
  - Create conversations via Open Messaging API
  - Add participants to conversations
  - Retrieve conversation details
  - Close conversations
  - Handle conversation not found errors

---

### Phase 2: Message Sending (Priority: CRITICAL)
**Duration**: 1.5 weeks

#### 2.1 Send Message Implementation
- **Files**:
  - `src/services/messageSender.ts` - Message sending logic
  - `src/builders/genesysMessageBuilder.ts` - Message builder

- **Genesys Message Format**:
```typescript
{
  textBody: string,
  content: [
    {
      contentType: "Attachment",
      attachment: {
        id: string,
        mediaType: string,
        url: string
      }
    }
  ]
}
```

#### 2.2 Message Types Support
- **Files**:
  - `src/services/textMessageSender.ts`
  - `src/services/mediaMessageSender.ts`

- **Implementation**:
  - Send text messages
  - Send rich media  (images, documents)
  - Handle message validation errors
  - Track sent message IDs

---

### Phase 3: RabbitMQ Integration (Priority: CRITICAL)
**Duration**: 1 week

#### 3.1 Message Queue Consumer
- **Files**:
  - `src/queue/consumer.ts` - RabbitMQ consumer
  - `src/config/rabbitmq.config.ts` - Queue configuration

- **Implementation**:
  - Consume from `genesys.outbound` queue
  - Parse transformed message payload
  - Send to Genesys with retry
  - Acknowledge after successful send
  - Route failures to DLQ

---

### Phase 4: Error Handling & Retry Logic (Priority: HIGH)
**Duration**: 1 week

#### 4.1 Genesys API Error Handling
- **Files**:
  - `src/services/errorHandler.ts` - Error handling
  - `src/errors/genesysErrors.ts` - Error definitions

- **Error Scenarios**:
  - 401 Unauthorized → Refresh token and retry
  - 404 Not Found → Send to DLQ
  - 429 Rate Limit → Retry with backoff
  - 500 Server Error → Retry with circuit breaker

#### 4.2 Circuit Breaker
- **Files**:
  - `src/middleware/circuitBreaker.ts` - Circuit breaker

- **Implementation**:
  - Implement per-organization circuit breaker
  - Open on error threshold (50% over 1min)
  - Half-open with test requests
  - Alert on circuit open

---

### Phase 5: Rate Limiting (Priority: MEDIUM)
**Duration**: 1 week

#### 5.1 API Rate Limiting
- **Files**:
  - `src/services/rateLimiter.ts` - Rate limiting service

- **Implementation**:
  - Implement Genesys API rate limits
  - Queue messages when approaching limits
  - Track rate limit per organization
  - Add rate limit monitoring

---

### Phase 6: Multi-tenant Support (Priority: MEDIUM)
**Duration**: 1 week

#### 6.1 Tenant Configuration
- **Files**:
  - `src/middleware/tenantResolver.ts` - Tenant resolution
  - `src/integrations/tenantService.client.ts` - Tenant service

- **Implementation**:
  - Load tenant-specific Genesys org credentials
  - Support multiple Genesys orgs per tenant
  - Apply tenant-specific rate limits

---

### Phase 7: Message Status Tracking (Priority: MEDIUM)
**Duration**: 1 week

#### 7.1 Status Integration
- **Files**:
  - `src/services/statusTracker.ts` - Status tracking
  - `src/integrations/stateManager.client.ts` - State manager

- **Implementation**:
  - Update message status in state-manager
  - Track delivery confirmations
  - Publish status updates to RabbitMQ

---

## Dependencies

```json
{
  "axios": "^1.6.2",
  "amqplib": "^0.10.3",
  "opossum": "^7.0.0",
  "ioredis": "^5.3.2"
}
```

**External Services**:
- Genesys Cloud API
- Tenant Service (Genesys credentials)
- State Manager (message tracking)
- RabbitMQ (message queues)

---

## Verification Plan

### Unit Tests
- OAuth token management
- Message sending logic
- Error handling scenarios
- Rate limiting algorithm

### Integration Tests
- Send message to Genesys
- Create conversation
- RabbitMQ consumption
- Circuit breaker testing

### Manual Testing
1. Send text message → verify in Genesys
2. Trigger rate limit → verify queuing
3. Test OAuth refresh → verify token updates

**Performance Targets**:
- Send message: <500ms (p95)
- Throughput: 50 messages/sec per org

---

## Rollback Strategy
- Feature flags for new functionality
- Queue messages can be reprocessed
- No database changes
