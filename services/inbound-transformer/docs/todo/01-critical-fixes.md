# Task 01 — Critical Runtime Fixes

**Priority**: CRITICAL — service does not work at all without these
**Depends on**: nothing (do these first)
**Blocks**: all other tasks

---

## 01-A: Fix Queue Name — Consumer Listens to Wrong Queue

**Gap ref**: G1

**Problem**: The inbound-transformer consumer subscribes to `QUEUES.INBOUND_TRANSFORMER_WORK` (`inbound-transformer-work`), but the `whatsapp-webhook-service` publishes to `QUEUES.INBOUND_WHATSAPP_MESSAGES` (`inbound-whatsapp-messages`). No message is ever consumed.

**File to change**: `src/config/rabbitmq.ts`

**Change**:
```diff
- name: QUEUES.INBOUND_TRANSFORMER_WORK,
+ name: QUEUES.INBOUND_WHATSAPP_MESSAGES,
```

**Acceptance criteria**:
- Start the service, publish a test message to `inbound-whatsapp-messages` in RabbitMQ management UI → transformer logs it.

---

## 01-B: Fix Missing `from` Field for Existing Conversations

**Gap ref**: G2

**Problem**: `transformToGenesysFormat()` with `isNew = false` does not include the `from` field. The downstream `genesys-api-service` unconditionally accesses `from.nickname` and `from.id`, throwing `TypeError` for every reply in an ongoing conversation.

**File to change**: `src/utils/messageFormatter.ts`

**Change**: In the `isNew = false` branch, include `from` with the same structure as the `isNew = true` branch:
```typescript
from: {
    nickname: metaMessage.contactName,
    id: metaMessage.from
}
```

**Acceptance criteria**:
- A second message from the same WhatsApp number (existing conversation) reaches Genesys without 500 error from the API service.

---

## 01-C: Fix Wrong Response Field Reference

**Gap ref**: G3

**Files to change**:
- `src/services/genesysService.ts`
- `src/services/transformerService.ts`

**Problem 1** — `genesysService.ts` validates `response.data.id` but the genesys-api-service returns `{ success, conversationId, messageId, tenantId }`. The field is `messageId`, not `id`.

```diff
- if (!response.data || !response.data.id) {
-     throw new Error(`Invalid Genesys API response: missing 'id' field`);
- }
+ if (!response.data || !response.data.messageId) {
+     throw new Error(`Invalid Genesys API response: missing 'messageId' field`);
+ }
  return response.data;
```

**Problem 2** — `transformerService.ts` passes `response.id` as genesysMessageId:
```diff
- console.log('Message sent to Genesys:', response.id);
+ console.log('Message sent to Genesys:', response.messageId);
  await stateService.updateMessageStatus(
      metaMessage.messageId,
      'sent',
      tenantId,
-     response.id
+     response.messageId
  );
```

**Acceptance criteria**:
- `updateMessageStatus` is called with a real Genesys message ID (not `undefined`).
- No false-positive `Invalid Genesys API response` errors.

---

## 01-D: Fix Environment Variable Name Inconsistency

**Gap ref**: G14

**Problem**: `src/config/services.ts` reads `process.env.GENESYS_API_URL`, but `.env.example` declares `GENESYS_BASE_URL`. The variable is never set, so the default `http://genesys-api:3010` is always used even when operators want to override it.

**Files to change**: `.env.example`

**Change**: Replace `GENESYS_BASE_URL=...` with `GENESYS_API_URL=http://genesys-api-service:3010`

**Acceptance criteria**:
- Setting `GENESYS_API_URL` in the environment overrides the default Genesys API service URL.
