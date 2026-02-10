# WhatsApp Webhook Service - Implementation Plan

## Goal

Build a secure and scalable webhook receiver for WhatsApp Business API that validates signatures, handles all message types, processes media, integrates with message queues, and supports multi-tenant configurations.

## Phased Implementation

### Phase 1: Webhook Security (Priority: CRITICAL)
**Duration**: 1 week

#### 1.1 Signature Verification
- **Files**:
  - `src/middleware/signatureVerification.ts` - Meta signature verification
  - `src/config/webhook.config.ts` - Webhook configuration

- **Implementation**:
  - Verify X-Hub-Signature-256 header using tenant's app secret
  - Implement HMAC SHA-256 validation
  - Validate webhook  challenge on subscription
  - Add replay attack prevention (timestamp validation)
  - Handle signature verification failures

#### 1.2 Security Measures
- **Files**:
  - `src/middleware/ipWhitelist.ts` - IP whitelisting
  - `src/middleware/rateLimiter.ts` - Rate limiting

- **Implementation**:
  - Whitelist Meta's IP ranges
  - Implement rate limiting per Business Account
  - Add request deduplication
  - Log all incoming webhooks for audit

---

### Phase 2: Message Type Handling (Priority: CRITICAL)
**Duration**: 2 weeks

#### 2.1 Message Type Processors
- **Files**:
  - `src/processors/textMessage.processor.ts`
  - `src/processors/imageMessage.processor.ts`
  - `src/processors/documentMessage.processor.ts`
  - `src/processors/locationMessage.processor.ts`
  - `src/processors/contactMessage.processor.ts`
  - `src/processors/interactiveMessage.processor.ts`
  - `src/processors/reactionMessage.processor.ts`

- **Each Processor Implements**:
  - Extract message-specific data
  - Validate message structure
  - Normalize to internal format
  - Enrich with metadata
  - Handle processing errors

#### 2.2 Status Update Handler
- **Files**:
  - `src/processors/statusUpdate.processor.ts`

- **Implementation**:
  - Handle sent, delivered, read, failed statuses
  - Update message tracking in state-manager
  - Emit status change events to RabbitMQ

---

### Phase 3: Media Processing (Priority: HIGH)
**Duration**: 1.5 weeks

#### 3.1 Media Download
- **Files**:
  - `src/services/mediaDownloader.ts` - Media download service
  - `src/integrations/whatsappMedia.client.ts` - WhatsApp Media API client

- **Implementation**:
  - Download media using Media API with access token
  - Validate media file type and size
  - Scan for malware (integrate ClamAV or VirusTotal)
  - Handle download errors with retry
  - Support large file downloads (streaming)

#### 3.2 Media Storage
- **Files**:
  - `src/services/mediaStorage.ts` - MinIO integration
  - `src/config/minio.config.ts` - Storage configuration

- **Implementation**:
  - Upload media to MinIO
  - Generate unique file paths (tenant/conversation/messageId)
  - Create thumbnails for images/videos
  - Extract metadata (EXIF, duration, dimensions)
  - Generate signed URLs for access

---

### Phase 4: Customer Processing (Priority: HIGH)
**Duration**: 1 week

#### 4.1 Customer Profile Lookup
- **Files**:
  - `src/services/customerProfileService.ts` - Customer profile management
  - `src/integrations/whatsappAPI.client.ts` - WhatsApp Business API client

- **Implementation**:
  - Extract phone number and WhatsApp ID
  - Lookup WhatsApp Business profile (name, avatar)
  - Format phone number (E.164)
  - Identify business accounts vs personal accounts
  - Update customer in state-manager

---

### Phase 5: Transformation & Routing (Priority: CRITICAL)
**Duration**: 1 week

#### 5.1 Message Normalization
- **Files**:
  - `src/transformers/messageNormalizer.ts` - Message normalization

- **Implementation**:
  - Normalize all message types to common format
  - Add correlation IDs for tracing
  - Enrich with timestamp and source info
  - Prepare for inbound-transformer

#### 5.2 RabbitMQ Publisher
- **Files**:
  - `src/queue/publisher.ts` - Message queue publisher
  - `src/config/rabbitmq.config.ts` - Queue configuration

- **Implementation**:
  - Publish to `whatsapp.inbound` queue
  - Add message persistence (durable)
  - Implement publisher confirms
  - Handle connection failures with retry
  - Support priority messages

---

### Phase 6: State Manager Integration (Priority: HIGH)
**Duration**: 1 week

#### 6.1 Conversation Mapping
- **Files**:
  - `src/services/conversationManager.ts` - Conversation management
  - `src/integrations/stateManager.client.ts` - State manager client

- **Implementation**:
  - Check if conversation exists
  - Create new conversation for first message
  - Update conversation last activity
  - Handle conversation creation race conditions
  - Support group conversations

---

### Phase 7: Multi-tenant Support (Priority: MEDIUM)
**Duration**: 1 week

#### 7.1 Tenant Resolution
- **Files**:
  - `src/middleware/tenantResolver.ts` - Tenant identification
  - `src/integrations/tenantService.client.ts` - Tenant service client

- **Implementation**:
  - Extract Business Account ID from webhook
  - Map to tenant in tenant-service
  - Load tenant-specific webhook secret
  - Apply tenant-specific processing rules
  - Support multiple Business Accounts per tenant

---

### Phase 8: Error Handling (Priority: HIGH)
**Duration**: 1 week

#### 8.1 Webhook Error Handling
- **Files**:
  - `src/middleware/errorHandler.ts` - Error handling middleware
  - `src/services/webhookReplay.ts` - Failed webhook replay

- **Implementation**:
  - Log all errors with correlation IDs
  - Store failed webhooks for replay
  - Return 200 to Meta even on errors (prevent retries)
  - Implement dead letter queue for failed processing
  - Alert on repeated failures

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "crypto": "built-in",
  "axios": "^1.6.2",
  "amqplib": "^0.10.3",
  "minio": "^7.1.3",
  "libphonenumber-js": "^1.10.44",
  "sharp": "^0.33.0"
}
```

**External Services**:
- WhatsApp Business API (webhook source, media download)
- State Manager (conversation and customer management)
- Tenant Service (tenant configuration)
- RabbitMQ (message publishing)
- MinIO (media storage)

---

## Verification Plan

### Unit Tests
- Signature verification logic
- Message type processing for all types
- Media download and upload
- Customer profile extraction
- Tenant resolution

### Integration Tests
- End-to-end webhook processing
- Media download from WhatsApp → upload to MinIO
- RabbitMQ message publishing
- State manager conversation creation
- Multi-tenant webhook handling

### Manual Testing
1. Send WhatsApp text message → verify received and queued
2. Send image → verify media downloaded and stored
3. Send invalid signature → verify rejection (403)
4. Send from new customer → verify conversation created
5. Test rate limiting → verify throttling works

**Performance Targets**:
- Webhook response time: <200ms (return 200 quickly)
- Message processing: <500ms (async)
- Media processing: <3s
- Throughput: 500 webhooks/sec per instance

---

## Rollback Strategy
- Feature flags for media processing
- Webhooks can be replayed from Meta
- No database changes
- Queue messages can be reprocessed
