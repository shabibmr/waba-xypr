# Task File 03 — RabbitMQ Payload Schema & Queue Names
**Priority:** HIGH — Depends on 02 (classification must be correct to know which queue/schema to use)
**FRD Refs:** REQ-OUT-04, REQ-STATE-05, §2.5, §3.1, §4.2, §5.3

---

## Gaps

### GAP-15: Outbound message RabbitMQ payload schema mismatch
**Current (`genesys-handler.service.ts` `publishOutboundMessage`):**
```typescript
{
  tenantId, conversationId, messageId, text, timestamp,
  agentId, agentName, mediaType, mediaUrl, metadata
}
```
**FRD (§4.2.1, §4.2.2):**
```json
{
  "tenantId": "uuid-5678",
  "genesysId": "msg-abc-123",
  "type": "message",
  "timestamp": "2023-01-01T12:00:00.000Z",
  "payload": {
    "text": "Hello, how can I help you?",
    "to_id": "919876543210",
    "to_id_type": "Phone",
    "media": null
  }
}
```
**Impact:** State Manager and downstream consumers receive the wrong schema and will fail to process outbound messages correctly.

---

### GAP-16: Status event RabbitMQ payload schema mismatch
**Current:** No proper status event publishing — `processEvent()` publishes a generic event blob.
**FRD (§4.2.3):**
```json
{
  "tenantId": "uuid-5678",
  "genesysId": "receipt-ghi-789",
  "originalMessageId": "msg-abc-123",
  "status": "delivered",
  "timestamp": "2023-01-01T12:01:00.000Z"
}
```
With status mapping:
| Genesys `status` | Internal `status` |
|---|---|
| `Delivered` | `delivered` |
| `Read` | `read` |
| `Typing` | `typing` |
| `Disconnect` | `disconnect` |

**Impact:** State Manager never receives properly-formed status updates from Genesys side.

---

### GAP-17: Queue names do not match FRD or shared constants
**Current (`rabbitmq.service.ts`):**
- Outbound queue: `OUTBOUND_GENESYS_MESSAGES` env var (unclear what this resolves to in practice)
- Events queue: hardcoded `"genesys-events"`

**FRD (§2.5, §3.1):**
- Outbound messages → `outboundQueue`
- Status events → `statusQueue`

**Shared constants (`shared/constants/queues.js`):** The project uses `QUEUES.OUTBOUND_GENESYS_MESSAGES` and `QUEUES.GENESYS_STATUS_UPDATES` — these must be verified to match `outboundQueue`/`statusQueue` or reconciled.

**Impact:** Messages are published to wrong queues; State Manager never receives them.

---

### GAP-18: `genesysId` not preserved from `payload.id`
**Current:** Uses `messageId` from a nested `message` field.
**FRD (§6.2.1):** The `genesysId` must be the event's top-level `id` field: `payload["id"]`. This is the idempotency key used throughout the pipeline.

---

### GAP-19: Missing `to_id` and `to_id_type` in outbound payload
**Current:** Outbound message payload doesn't include the recipient's phone number.
**FRD (§4.2.1):** `to_id` = `channel.to.id` (customer's phone number), `to_id_type` = `channel.to.idType` — required for WhatsApp delivery.

---

### GAP-20: Missing retry logic for RabbitMQ publish
**Current:** Single publish attempt; failure is only logged.
**FRD (§3.1):**
- Retry once on publish failure (brief delay ~100ms)
- Log critical error if both attempts fail
- Do NOT block the HTTP response for retry

---

### GAP-21: Queue durability assertion
**Current:** Queues may be asserted but the assertion options aren't confirmed to match `{ durable: true }`.
**FRD (§3.1):** Queues must be durable, messages must be persistent (`deliveryMode: 2`). Verify both are set.

---

## Tasks

| # | Task | File(s) to Change |
|---|------|-------------------|
| 03-A | Rewrite outbound message publish to use FRD schema: `{ tenantId, genesysId, type: "message", timestamp, payload: { text, to_id, to_id_type, media } }` | `genesys-handler.service.ts` |
| 03-B | Implement status event publish with FRD schema: `{ tenantId, genesysId, originalMessageId, status, timestamp }` | `genesys-handler.service.ts` |
| 03-C | Implement status mapping: `Delivered→delivered`, `Read→read`, `Typing→typing`, `Disconnect→disconnect` | `genesys-handler.service.ts` |
| 03-D | Fix queue names to use `outboundQueue` (messages) and `statusQueue` (status) — align with `shared/constants/queues.js` | `rabbitmq.service.ts`, `config/config.ts` |
| 03-E | Ensure `genesysId` is always taken from top-level `payload.id` | `genesys-handler.service.ts` |
| 03-F | Add one-retry publish logic with 100ms delay; log critical on both failures | `rabbitmq.service.ts` |
| 03-G | Confirm queue assertion uses `{ durable: true }` and messages use `{ persistent: true }` | `rabbitmq.service.ts` |

---

## Acceptance Criteria
- Outbound text message published to `outboundQueue` matches FRD §4.2.1 schema exactly
- Outbound media message published to `outboundQueue` matches FRD §4.2.2 schema (with `media` object)
- Receipt event published to `statusQueue` matches FRD §4.2.3 schema with lowercase status
- On RabbitMQ publish failure: retries once, logs critical after both fail
- Queues are durable and messages are persistent
