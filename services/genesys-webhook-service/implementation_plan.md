# Genesys Webhook Service - Implementation Plan

## Goal

Build a secure webhook receiver for Genesys Cloud events that validates requests, processes message and conversation events, routes to appropriate services, and supports multi-tenant configurations.

## Phased Implementation

### Phase 1: Webhook Security & Validation (Priority: HIGH)
**Duration**: 1 week

#### 1.1 Security Implementation
- **Files**:
  - `src/middleware/webhookAuth.ts` - Webhook authentication
  - `src/middleware/ipWhitelist.ts` - IP whitelisting

- **Implementation**:
  - Validate Genesys webhook signatures
  - Implement IP whitelisting for Genesys cloud IPs
  - Add request validation and sanitization
  - Log all webhook requests for audit

---

### Phase 2: Event Processing (Priority: CRITICAL)
**Duration**: 2 weeks

#### 2.1 Event Type Handlers
- **Files**:
  - `src/processors/messageEvent.processor.ts` - Message events
  - `src/processors/conversationEvent.processor.ts` - Conversation events
  - `src/processors/participantEvent.processor.ts` - Participant events

- **Event Types**:
  - **Message Events**: New agent messages, message status updates
  - **Conversation Events**: Created, updated, closed
  - **Participant Events**: Joined, left, transferred

#### 2.2 Message Transformation
- **Files**:
  - `src/transformers/messageTransformer.ts` - Message normalization

- **Implementation**:
  - Normalize Genesys events to internal format
  - Extract agent message content
  - Convert to format for outbound-transformer
  - Add correlation IDs

---

### Phase 3: State Management Integration (Priority: HIGH)
**Duration**: 1 week

#### 3.1 Conversation State Sync
- **Files**:
  - `src/services/stateSync.ts` - State synchronization
  - `src/integrations/stateManager.client.ts` - State manager client

- **Implementation**:
  - Update conversation state on events
  - Handle participant changes
  - Track conversation closure
  - Update last activity timestamps

---

### Phase 4: RabbitMQ Integration (Priority: CRITICAL)
**Duration**: 1 week

#### 4.1 Message Publishing
- **Files**:
  - `src/queue/publisher.ts` - RabbitMQ publisher

- **Implementation**:
  - Publish agent messages to `genesys.outbound` queue
  - Add message persistence
  - Implement publisher confirms
  - Handle connection failures

---

### Phase 5: Multi-tenant Support (Priority: MEDIUM)
**Duration**: 1 week

#### 5.1 Tenant Resolution
- **Files**:
  - `src/middleware/tenantResolver.ts` - Tenant identification
  - `src/integrations/tenantService.client.ts` - Tenant service

- **Implementation**:
  - Identify tenant from Genesys organization ID
  - Load tenant-specific configurations
  - Apply tenant-specific routing rules

---

### Phase 6: Error Handling (Priority: HIGH)
**Duration**: 1 week

#### 6.1 Error Management
- **Files**:
  - `src/middleware/errorHandler.ts` - Error handling

- **Implementation**:
  - Log all errors with correlation IDs
  - Return 200 to Genesys (prevent retries)
  - Route failed events to DLQ
  - Alert on repeated failures

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "amqplib": "^0.10.3",
  "axios": "^1.6.2"
}
```

**External Services**:
- Genesys Cloud (webhook source)
- State Manager (conversation updates)
- RabbitMQ (message publishing)

---

## Verification Plan

### Unit Tests
- Event parsing and validation
- Message transformation
- State sync logic

### Integration Tests
- End-to-end webhook processing
- RabbitMQ publishing
- State manager integration

### Manual Testing
1. Send message from Genesys → verify webhook received
2. Close conversation → verify state updated
3. Test security → verify signature validation

**Performance Targets**:
- Webhook response: <200ms
- Event processing: <500ms

---

## Rollback Strategy
- Feature flags for new event types
- Webhooks can be replayed
- No database changes
