# Outbound Transformer Service - Implementation Plan

## Goal

Transform Genesys agent messages to WhatsApp Business API format, handle template messages, resolve customer WhatsApp IDs, process rich media, and ensure reliable delivery with multi-tenant support.

## Phased Implementation

### Phase 1: Genesys Message Parsing (Priority: CRITICAL)
**Duration**: 1 week

#### 1.1 Genesys Payload Parser
- **Files**:
  - `src/parsers/genesysParser.ts` - Genesys message parser
  - `src/types/genesys.types.ts` - Genesys type definitions
  - `src/validators/genesysSchema.ts` - Validation schemas

- **Implementation**:
  - Parse Genesys Open Messaging format
  - Extract message type (Text, Structured, Event)
  - Parse agent information and conversation ID
  - Extract message content and attachments
  - Validate payload structure

---

### Phase 2: WhatsApp Transformation Logic (Priority: CRITICAL)
**Duration**: 2 weeks

#### 2.1 WhatsApp Message Builder
- **Files**:
  - `src/transformers/whatsappTransformer.ts` - Main transformer
  - `src/builders/whatsappMessageBuilder.ts` - Message builder
  - `src/types/whatsapp.types.ts` - WhatsApp API types

- **WhatsApp Message Formats**:
```typescript
// Text message
{
  messaging_product: "whatsapp",
  to: string,  // Phone number
  type: "text",
  text: { body: string }
}

// Media message
{
  messaging_product: "whatsapp",
  to: string,
  type: "image" | "document" | "video" | "audio",
  image: { link: string }
}

// Template message
{
  messaging_product: "whatsapp",
  to: string,
  type: "template",
  template: {
    name: string,
    language: { code: string },
    components: Array<{
      type: "body" | "header",
      parameters: Array<{ type: "text", text: string }>
    }>
  }
}
```

#### 2.2 Field Mapping
- **Files**:
  - `src/mappers/whatsappMapper.ts` - Field mapping logic

- **Implementation**:
  - Map Genesys text to WhatsApp text body
  - Convert attachments to WhatsApp media format
  - Map agent info to context (preserve in metadata)
  - Handle message formatting (bold, italic)

---

### Phase 3: Template Message Handling (Priority: HIGH)
**Duration**: 1.5 weeks

#### 3.1 Template Detection & Selection
- **Files**:
  - `src/services/templateService.ts` - Template management
  - `src/integrations/whatsappAPI.client.ts` - Template API client

- **Implementation**:
  - Detect template placeholders in agent message
  - Lookup template by name or content matching
  - Verify template approval status
  - Support multiple languages per template
  - Cache template catalog per tenant

#### 3.2 Parameter Substitution
- **Files**:
  - `src/services/templateParameterService.ts` - Parameter handling

- **Implementation**:
  - Extract parameters from message content
  - Validate parameter count and types
  - Build template component structure
  - Handle header/body/footer parameters
  - Support button parameters

---

### Phase 4: Customer Resolution (Priority: CRITICAL)
**Duration**: 1 week

#### 4.1 WhatsApp ID Lookup
- **Files**:
  - `src/services/customerResolver.ts` - Customer lookup service
  - `src/integrations/stateManager.client.ts` - State manager client

- **Implementation**:
  - Lookup conversation mapping in state-manager
  - Retrieve customer WhatsApp ID from mapping
  - Format phone number correctly (E.164 format)
  - Handle missing customer errors
  - Validate phone number is WhatsApp registered

---

### Phase 5: Media Processing (Priority: HIGH)
**Duration**: 1.5 weeks

#### 5.1 Media URL Processing
- **Files**:
  - `src/services/mediaProcessorService.ts` - Media handling
  - `src/integrations/whatsappMedia.client.ts` - WhatsApp Media API

- **Implementation**:
  - Download media from Genesys-provided URL
  - Validate file type and size (WhatsApp limits)
  - Optimize/compress media if needed
  - Upload to WhatsApp Media API
  - Get media ID for message sending
  - Handle media upload errors with retry

#### 5.2 Media Format Conversion
- **Files**:
  - `src/services/mediaConverter.ts` - Format conversion

- **Implementation**:
  - Convert unsupported formats (e.g., WebP → JPEG)
  - Resize images if exceeding WhatsApp limits
  - Extract video thumbnails
  - Validate media dimensions

---

### Phase 6: State Manager Integration (Priority: HIGH)
**Duration**: 1 week

#### 6.1 Conversation State Sync
- **Files**:
  - `src/services/stateSync.ts` - State synchronization

- **Implementation**:
  - Update conversation last activity timestamp
  - Track outbound message in state-manager
  - Update message delivery status
  - Handle conversation not found errors

---

### Phase 7: RabbitMQ Integration (Priority: HIGH)
**Duration**: 1 week

#### 7.1 Message Queue Consumer
- **Files**:
  - `src/queue/consumer.ts` - RabbitMQ consumer
  - `src/config/rabbitmq.config.ts` - Queue configuration

- **Implementation**:
  - Consume from `genesys.outbound` queue
  - Add prefetch limit for flow control
  - Acknowledge message after successful send
  - Handle errors with DLQ routing
  - Support priority queues for urgent messages

#### 7.2 Retry Queue Publisher
- **Files**:
  - `src/queue/retryPublisher.ts` - Retry queue publisher

- **Implementation**:
  - Publish failed messages to retry queue
  - Add retry count and delay headers
  - Implement exponential backoff
  - Move to DLQ after max retries

---

### Phase 8: Multi-tenant Support (Priority: MEDIUM)
**Duration**: 1 week

#### 8.1 Tenant Configuration
- **Files**:
  - `src/middleware/tenantResolver.ts` - Tenant resolution
  - `src/integrations/tenantService.client.ts` - Tenant service client

- **Implementation**:
  - Resolve tenant from conversation mapping
  - Load tenant-specific WhatsApp Business Account
  - Apply tenant-specific template catalog
  - Support tenant-specific transformation rules

---

### Phase 9: Error Handling (Priority: HIGH)
**Duration**: 1 week

#### 9.1 Validation & Transformation Errors
- **Files**:
  - `src/middleware/errorHandler.ts` - Error handling
  - `src/errors/transformationErrors.ts` - Custom errors

- **Implementation**:
  - Validate Genesys payload structure
  - Handle customer not found gracefully
  - Catch template validation errors
  - Log errors with correlation IDs
  - Send error notifications to monitoring

#### 9.2 WhatsApp API Errors
- **Files**:
  - `src/services/whatsappErrorHandler.ts` - WhatsApp error handling

- **Implementation**:
  - Handle rate limit errors (retry with backoff)
  - Handle invalid phone number errors
  - Handle template not approved errors
  - Handle media upload failures
  - Map WhatsApp error codes to internal errors

---

## Dependencies

```json
{
  "axios": "^1.6.2",
  "joi": "^17.11.0",
  "amqplib": "^0.10.3",
  "libphonenumber-js": "^1.10.44",
  "sharp": "^0.33.0",
  "ioredis": "^5.3.2"
}
```

**External Services**:
- State Manager (conversation lookup, message tracking)
- WhatsApp Business API (message sending, media upload)
- Tenant Service (tenant configuration)
- RabbitMQ (message queues)
- Redis (template catalog caching)

---

## Verification Plan

### Unit Tests
- Genesys payload parsing
- WhatsApp message building (text, media, template)
- Template parameter substitution
- Customer phone number formatting
- Error handling scenarios

### Integration Tests
- End-to-end transformation (Genesys → WhatsApp)
- Template message with parameters
- Media download and upload
- Conversation lookup from state-manager
- RabbitMQ consumption and retry logic

### Manual Testing
1. Send text message from Genesys → verify WhatsApp delivery
2. Send image from Genesys → verify media processed
3. Send template message → verify parameters substituted
4. Test with invalid phone number → verify error handling
5. Test with template not approved → verify error handling

**Performance Targets**:
- Transformation latency: <150ms (p95)
- Media processing: <3s (p95)
- Throughput: 100 messages/sec per instance

---

## Rollback Strategy
- Feature flags for template and media processing
- Queue messages can be reprocessed
- Maintain backward compatibility for message format
- No database schema changes
