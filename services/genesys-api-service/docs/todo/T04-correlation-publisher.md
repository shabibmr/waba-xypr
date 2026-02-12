# T04 — Correlation Event Publisher (CRITICAL / MVP)

**Status:** NOT IMPLEMENTED
**Severity:** CRITICAL — Without this, state-manager never maps waId ↔ conversationId, breaking outbound flow
**MVP Required:** YES
**Depends On:** T01 (RabbitMQ channel), T05 (provides conversationId from Genesys response)
**Blocks:** Nothing (but state-manager requires this to function)

---

## Gap Description

After a message is successfully delivered to Genesys Cloud, the service must publish a **correlation event** to the `correlation-events` queue. This event carries the `conversationId` and `communicationId` returned by Genesys, paired with the original `whatsapp_message_id`. The state-manager consumes this event to create the waId ↔ conversationId mapping required for bidirectional routing.

**Current state:** The `sendInboundMessage` function in `genesys-api.service.ts` returns `conversationId` in its response object, but nothing publishes it to the queue. The correlation event is simply discarded.

**FRD reference:** Section 3 (Core Responsibilities #4), Section 5.5 (Output Event Schema), Section 6.3 (Main Processing Logic)

---

## Correlation Event Schema (FRD Section 5.5)

The event published to `correlation-events` must exactly match:

```json
{
  "tenantId": "uuid-tenant-1111-2222-3333",
  "conversationId": "conversation-uuid-7890-abcd-ef12",
  "communicationId": "communication-uuid-3456-7890-abcd",
  "whatsapp_message_id": "wamid.HBgNOTE6MTIzNDU2Nzg5MDEyMzQ1Njc4",
  "status": "created",
  "timestamp": "2023-11-15T03:33:21.234Z",
  "correlationId": "uuid-1234-5678-9abc-def0"
}
```

**Field sources:**
- `tenantId` — from `metadata.tenantId` in the inbound message
- `conversationId` — from Genesys API response `id` field
- `communicationId` — from Genesys API response `communicationId` field
- `whatsapp_message_id` — from `metadata.whatsapp_message_id` in the inbound message
- `status` — hardcoded `"created"` for new conversations
- `timestamp` — current UTC ISO-8601 timestamp
- `correlationId` — from `metadata.correlationId` in the inbound message

---

## What Needs to Be Built

### 1. Publisher Function (`src/services/rabbitmq.service.ts` extension)

Add to the RabbitMQ service module (T01):

```
publishCorrelationEvent(event: CorrelationEvent): Promise<void>
```

- Publish to exchange `correlation` with routing key `correlation.created`
- Message properties: `delivery_mode: 2` (persistent), `content_type: application/json`, `correlation_id: event.correlationId`
- If publish fails: log error (do not swallow silently)

**Note:** Queue name must come from `shared/constants/queues.js` — do not hardcode `"correlation-events"`.

### 2. Wire into Consumer Processing (T01)

In the consumer handler, after successful Genesys delivery:

```
genesysResponse = await sendToGenesys(...)
await publishCorrelationEvent({
  tenantId,
  conversationId: genesysResponse.conversationId,
  communicationId: genesysResponse.communicationId,
  whatsapp_message_id: metadata.whatsapp_message_id,
  status: 'created',
  timestamp: new Date().toISOString(),
  correlationId: metadata.correlationId
})
```

### 3. Genesys Response Must Return communicationId

Currently `sendInboundMessage` in `genesys-api.service.ts` only returns `conversationId` (from `response.data.conversation?.id`). The FRD requires also extracting `communicationId` (from `response.data.communicationId`). This must be fixed in T05.

---

## Queue/Exchange Notes

Per FRD section 6.1 and 5.5:
- Exchange name: `correlation`
- Routing key: `correlation.created`
- Queue: `correlation-events` (asserted durable in T01 startup)

---

## Acceptance Criteria

- [ ] After successful Genesys delivery, a message appears in `correlation-events` queue
- [ ] Event contains all 7 required fields from FRD section 5.5
- [ ] `conversationId` matches the value returned by Genesys API
- [ ] `communicationId` is populated (not null/undefined)
- [ ] `whatsapp_message_id` matches the original message's metadata field
- [ ] Message is published with `delivery_mode: 2` (persistent)
- [ ] Publish failure is logged (not silently dropped)
