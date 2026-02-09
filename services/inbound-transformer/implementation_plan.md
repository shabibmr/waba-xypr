# Inbound Transformer Service - Implementation Plan

## Goal

Build a robust transformation pipeline that converts WhatsApp Business API webhook payloads into Genesys Open Messaging format with support for all message types, media processing, customer context enrichment, and multi-tenant handling.

## Phased Implementation

### Phase 1: WhatsApp Message Parsing (Priority: CRITICAL)
**Duration**: 1.5 weeks

#### 1.1 Webhook Payload Parser
- **Files**:
  - `src/parsers/whatsappParser.ts` - Main parsing logic
  - `src/types/whatsapp.types.ts` - TypeScript interfaces
  - `src/validators/whatsappSchema.ts` - Joi validation schemas

- **Implementation**:
  - Parse WhatsApp webhook entry structure
  - Extract message object from payload
  - Identify message type (text, image, document, location, etc.)
  - Handle status updates separately from messages
  - Validate payload structure

#### 1.2 Message Type Handlers
- **Files**:
  - `src/parsers/messageTypes/textParser.ts`
  - `src/parsers/messageTypes/imageParser.ts`
  - `src/parsers/messageTypes/documentParser.ts`
  - `src/parsers/messageTypes/locationParser.ts`
  - `src/parsers/messageTypes/contactParser.ts`
  - `src/parsers/messageTypes/interactiveParser.ts`

- **Implementation**:
  - Text message: Extract message body and formatting
  - Image/Video/Document: Extract media ID and metadata
  - Location: Extract coordinates and address
  - Contact: Parse vCard format
  - Interactive: Parse button and list responses

---

### Phase 2: Message Transformation Logic (Priority: CRITICAL)
**Duration**: 2 weeks

#### 2.1 Genesys Format Converter
- **Files**:
  - `src/transformers/genesysTransformer.ts` - Main transformer
  - `src/types/genesys.types.ts` - Genesys message types
  - `src/builders/genesysMessageBuilder.ts` - Message builder

- **Genesys Open Messaging Format**:
```typescript
{
  id: string,
  channel: {
    type: "WhatsApp",
    from: {
      nickname: string,
      id: string  // WhatsApp ID
    }
  },
  type: "Text" | "Structured",
  text: string?,
  content: [
    {
      contentType: "Attachment",
      attachment: {
        id: string,
        mediaType: string,
        url: string
      }
    }
  ],
  metadata: object
}
```

#### 2.2 Field Mapping Implementation
- **Files**:
  - `src/mappers/fieldMapper.ts` - Field mapping logic

- **Implementation**:
  - Map WhatsApp WAMID to Genesys message ID
  - Map customer phone number to `channel.from.id`
  - Map customer name to `channel.from.nickname`
  - Convert message timestamp to ISO format
  - Preserve original payload in metadata

---

### Phase 3: Customer Information Extraction (Priority: HIGH)
**Duration**: 1 week

#### 3.1 Customer Data Extractor
- **Files**:
  - `src/services/customerExtractor.ts` - Customer info extraction
  - `src/integrations/stateManager.client.ts` - State manager API client

- **Implementation**:
  - Extract phone number and WhatsApp ID
  - Format phone number using libphonenumber-js
  - Lookup or create customer in state-manager
  - Retrieve customer name from WhatsApp profile
  - Add customer context to transformed message

---

### Phase 4: Rich Media Processing (Priority: HIGH)
**Duration**: 1.5 weeks

#### 4.1 Media File Handler
- **Files**:
  - `src/services/mediaService.ts` - Media processing
  - `src/integrations/whatsappMedia.client.ts` - WhatsApp Media API client
  - `src/config/minio.config.ts` - MinIO configuration

- **Implementation**:
  - Download media from WhatsApp Media API using media ID
  - Validate file type and size
  - Upload to MinIO object storage
  - Generate public/signed URL for Genesys
  - Extract metadata (dimensions, duration, file size)
  - Handle media download errors with retry

#### 4.2 Media URL Generation
- **Files**:
  - `src/services/urlGenerator.ts` - URL generation service

- **Implementation**:
  - Generate MinIO URLs with expiry
  - Support signed URLs for private media
  - Add media type detection
  - Implement URL caching in Redis

---

### Phase 5: State Manager Integration (Priority: CRITICAL)
**Duration**: 1 week

#### 5.1 Conversation Mapping
- **Files**:
  - `src/services/conversationService.ts` - Conversation management
  - `src/integrations/stateManager.client.ts` - State manager integration

- **Implementation**:
  - Check if conversation exists for WhatsApp ID
  - Create new conversation mapping if needed
  - Update conversation state (active, last_message_at)
  - Retrieve Genesys conversation ID for routing
  - Handle orphaned conversations

#### 5.2 Customer State Management
- **Files**:
  - `src/services/customerStateService.ts` - Customer state sync

- **Implementation**:
  - Update customer last interaction timestamp
  - Store customer preferences
  - Track conversation history count

---

### Phase 6: RabbitMQ Integration (Priority: HIGH)
**Duration**: 1 week

#### 6.1 Message Queue Consumer
- **Files**:
  - `src/queue/consumer.ts` - RabbitMQ consumer
  - `src/config/rabbitmq.config.ts` - Queue configuration

- **Implementation**:
  - Consume from `whatsapp.inbound` queue
  - Implement prefetch limit for load balancing
  - Add message acknowledgment after transformation
  - Handle consumer errors with dead letter queue
  - Support message requeue on transient errors

#### 6.2 Genesys Queue Publisher
- **Files**:
  - `src/queue/publisher.ts` - RabbitMQ publisher

- **Implementation**:
  - Publish transformed messages to `genesys.outbound` queue
  - Add message persistence (durable messages)
  - Implement publisher confirms
  - Handle connection failures with retry

---

### Phase 7: Multi-tenant Support (Priority: MEDIUM)
**Duration**: 1 week

#### 7.1 Tenant Resolution
- **Files**:
  - `src/middleware/tenantResolver.ts` - Tenant identification
  - `src/integrations/tenantService.client.ts` - Tenant service client

- **Implementation**:
  - Extract tenant ID from WhatsApp Business Account ID
  - Fetch tenant-specific configurations
  - Add tenant context to all transformations
  - Support per-tenant transformation rules

#### 7.2 Tenant-specific Rules
- **Files**:
  - `src/services/transformationRules.ts` - Custom transformation rules

- **Implementation**:
  - Support custom field mappings per tenant
  - Add tenant-specific message filtering
  - Implement tenant-specific routing logic

---

### Phase 8: Error Handling (Priority: HIGH)
**Duration**: 1 week

#### 8.1 Validation Errors
- **Files**:
  - `src/middleware/errorHandler.ts` - Global error handler
  - `src/errors/transformationErrors.ts` - Custom error classes

- **Implementation**:
  - Handle parsing errors gracefully
  - Validate message structure before transformation
  - Add error logging with correlation IDs
  - Send failed messages to dead letter queue

#### 8.2 Recovery Mechanisms
- **Files**:
  - `src/services/retryService.ts` - Retry logic

- **Implementation**:
  - Retry transient errors (network, timeout)
  - Add exponential backoff for retries
  - Move to DLQ after max retries
  - Alert on repeated failures

---

## Dependencies

```json
{
  "joi": "^17.11.0",
  "axios": "^1.6.2",
  "amqplib": "^0.10.3",
  "minio": "^7.1.3",
  "libphonenumber-js": "^1.10.44",
  "ioredis": "^5.3.2"
}
```

**External Services**:
- State Manager (conversation and customer APIs)
- WhatsApp Business API (media download)
- RabbitMQ (message queues)
- MinIO (media storage)
- Redis (caching)

---

## Verification Plan

### Unit Tests
- WhatsApp payload parsing for all message types
- Field mapping to Genesys format
- Customer data extraction
- Media download and upload logic
- Error handling scenarios

### Integration Tests
- End-to-end transformation flow
- RabbitMQ message consumption and publishing
- State manager integration (conversation lookup/create)
- Media upload to MinIO
- Multi-tenant transformation rules

### Manual Testing
1. Send WhatsApp text message → verify Genesys format
2. Send image message → verify media downloaded and uploaded
3. Send location message → verify coordinates transformed
4. Test new customer → verify conversation created
5. Test existing customer → verify conversation looked up
6. Trigger parsing error → verify DLQ handling

**Performance Targets**:
- Transformation latency: <200ms (p95)
- Media processing: <2s (p95)
- Throughput: 100 messages/sec per instance

---

## Rollback Strategy
- Feature flags for media processing
- Queue messages can be reprocessed
- No database schema changes
- Maintain backward compatibility for message format
