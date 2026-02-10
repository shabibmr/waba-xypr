# MVP Demo - Single Message Inbound Flow

**Goal:** Demonstrate a single text message flowing from WhatsApp → Webhook Service → RabbitMQ

**Demo Flow:**
```
Customer sends WhatsApp message
  ↓
Meta sends POST to /webhook/meta
  ↓
Webhook Service receives & processes
  ↓
Publishes to RabbitMQ queue
  ↓
Returns 200 OK to Meta (< 200ms)
```

---

## 🎯 Minimum Required Tasks (17 tasks)

### Setup & Configuration (3 tasks)
- [ ] Create `.env` file with basic config (Redis, RabbitMQ, MinIO URLs)
- [ ] Install dependencies: `express`, `amqplib`, `ioredis`, `minio`, `dotenv`
- [ ] Create basic project structure (`src/routes`, `src/services`, `src/queue`)

### Phase 1: Basic Webhook Endpoint (4 tasks)
- [ ] Create Express server (`src/server.ts`)
- [ ] Create webhook route: POST `/webhook/meta` (`src/routes/webhook.routes.ts`)
- [ ] Add body parser middleware for JSON payloads
- [ ] Implement fast 200 OK response (acknowledge immediately)

### Phase 2: Message Parsing (2 tasks)
- [ ] Extract text message from Meta webhook payload (`src/processors/textMessage.processor.ts`)
- [ ] Extract basic metadata: `waId`, `messageId`, `timestamp`, `tenantId` (from phone_number_id)

### Phase 3: MinIO Storage (3 tasks)
- [ ] Setup MinIO client (`src/config/minio.config.ts`)
- [ ] Create bucket: `webhooks-inbound`
- [ ] Store raw webhook payload: `/webhooks-inbound/demo-tenant/{messageId}.json`

### Phase 4: RabbitMQ Publishing (3 tasks)
- [ ] Setup RabbitMQ connection (`src/config/rabbitmq.config.ts`)
- [ ] Create publisher (`src/queue/publisher.ts`)
- [ ] Publish normalized message to queue: `INBOUND_WHATSAPP_MESSAGES`

### Phase 5: Basic Error Handling (2 tasks)
- [ ] Add try-catch wrapper in webhook handler
- [ ] Log errors to console (simple console.log for demo)

---

## 📋 Simplified Implementation

### Webhook Payload (Input)
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "phone_number_id": "123456789"
        },
        "messages": [{
          "from": "919876543210",
          "id": "wamid.XYZ123",
          "timestamp": "1706534400",
          "type": "text",
          "text": {
            "body": "Hello, I need help"
          }
        }]
      }
    }]
  }]
}
```

### RabbitMQ Message (Output)
```json
{
  "messageId": "wamid.XYZ123",
  "waId": "919876543210",
  "tenantId": "demo-tenant",
  "type": "text",
  "content": {
    "text": "Hello, I need help"
  },
  "timestamp": "1706534400",
  "source": "whatsapp"
}
```

---

## 🚀 Demo Verification Steps

1. **Start the service:**
   ```bash
   npm run dev
   ```

2. **Send test webhook using curl:**
   ```bash
   curl -X POST http://localhost:3009/webhook/meta \
     -H "Content-Type: application/json" \
     -d '{ ... webhook payload ... }'
   ```

3. **Verify:**
   - ✅ Service returns 200 OK in < 200ms
   - ✅ Raw payload stored in MinIO: `webhooks-inbound/demo-tenant/wamid.XYZ123.json`
   - ✅ Message published to RabbitMQ queue: `INBOUND_WHATSAPP_MESSAGES`
   - ✅ Console logs show message processing

---

## 🔧 Simplified Assumptions for Demo

**Skip for MVP:**
- ❌ Signature verification (trust all incoming webhooks)
- ❌ Tenant resolution via Tenant Service (hardcode `demo-tenant`)
- ❌ Redis caching (direct processing)
- ❌ State Manager integration (skip conversation mapping)
- ❌ Media processing (text messages only)
- ❌ Status updates (focus on inbound messages)
- ❌ Rate limiting
- ❌ Deduplication
- ❌ Correlation IDs
- ❌ Advanced error handling
- ❌ Metrics/monitoring

**Hardcoded Values:**
- `tenantId = "demo-tenant"`
- `businessAccountId = metadata.phone_number_id`
- No authentication/authorization

---

## 📦 Minimal Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "amqplib": "^0.10.3",
    "minio": "^7.1.3",
    "ioredis": "^5.3.2",
    "dotenv": "^16.3.1"
  }
}
```

---

## ⏱️ Estimated Time

**Total: 4-6 hours for a working demo**

- Setup & Config: 30 min
- Webhook Endpoint: 1 hour
- Message Parsing: 30 min
- MinIO Integration: 1 hour
- RabbitMQ Integration: 1.5 hours
- Error Handling: 30 min
- Testing & Debug: 1 hour

---

## 🎬 Success Criteria

✅ **Demo is successful when:**
1. Can send a webhook POST request
2. Service responds with 200 OK immediately
3. Can see raw payload in MinIO bucket
4. Can see message in RabbitMQ queue
5. No crashes or errors in console

This demonstrates the core webhook processing pipeline without the complexity of full production features.
