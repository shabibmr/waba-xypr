# Inbound Transformer — Gap Analysis

**Reference**: `services/inbound-transformer/implementation_plan.md`
> Note: `docs/inbound-transformer-frd.md` is empty. The `implementation_plan.md` in the service root is treated as the authoritative spec.

---

## Summary

| Category | Status |
|----------|--------|
| Queue subscription (upstream contract) | BROKEN — wrong queue name |
| API contract with genesys-api-service | BROKEN — `from` field missing for existing conversations; wrong response field |
| Text message transformation | Partial — works for new conversations only |
| Media message transformation | Broken — `mediaUrl` from upstream ignored; no attachment object built |
| Interactive messages | Missing |
| Contact / sticker / reaction messages | Missing |
| TypeScript types | Missing (`any` used throughout) |
| Input validation | Missing |
| Dead-letter queue | Missing |
| Exponential backoff on retry | Missing |
| Structured logging | Missing (console.log only) |
| RabbitMQ channel recovery | Missing |
| Health check completeness | Partial |
| Tests | Placeholder only — no actual logic tested |
| Environment config | Inconsistent (`GENESYS_BASE_URL` vs `GENESYS_API_URL`) |

---

## G1 — Queue Name Mismatch (CRITICAL / BLOCKING)

**FRD**: Consume messages published by `whatsapp-webhook-service`.

**Implemented**: Consumer listens on `INBOUND_TRANSFORMER_WORK` (`inbound-transformer-work`).

**Actual upstream**: `whatsapp-webhook-service/src/config/config.js` publishes to:
```js
config.rabbitmq.queues.inboundMessages = QUEUES.INBOUND_WHATSAPP_MESSAGES  // "inbound-whatsapp-messages"
```

**Impact**: The inbound-transformer **never receives any messages**. All inbound WhatsApp messages pile up in `inbound-whatsapp-messages` unprocessed.

**File**: `src/config/rabbitmq.ts` line 13 — `QUEUES.INBOUND_TRANSFORMER_WORK` must be `QUEUES.INBOUND_WHATSAPP_MESSAGES`.

---

## G2 — Missing `from` Field for Existing Conversations (CRITICAL)

**File**: `src/utils/messageFormatter.ts` — `transformToGenesysFormat()`

For `isNew = false`, the returned object is:
```js
{ channel, direction, text, metadata, conversationId }
```
The `from` field is **not included**.

The `genesys-api-service` controller always destructures `from` from `req.body` and passes it to `genesys-api.service.sendInboundMessage()`, which then accesses `from.nickname` and `from.id`. This throws `TypeError: Cannot read property 'nickname' of undefined` for every message in an ongoing conversation.

**Required fix**: `from` must be included in all messages regardless of `isNew`.

---

## G3 — Wrong Response Field (`response.id` vs `response.messageId`) (CRITICAL)

**File**: `src/services/genesysService.ts` line 39, and `src/services/transformerService.ts` line 57/64

The `genesys-api-service` returns:
```json
{ "success": true, "conversationId": "...", "messageId": "...", "tenantId": "..." }
```

`genesysService.ts` validates `response.data.id` — this is always `undefined`. The check should be `response.data.messageId`.

`transformerService.ts` passes `response.id` as `genesysMessageId` — also always `undefined`.

---

## G4 — Media Attachments Not Forwarded to Genesys (HIGH)

**FRD**: Rich media messages (image, document, audio, video) must be forwarded as attachment objects in the Genesys message.

**Upstream reality**: `whatsapp-webhook-service` already downloads media and stores it in MinIO. The queued payload includes `content.mediaUrl`, `content.storagePath`, `content.fileSize`.

**Implemented**: `formatMessageText()` returns a text placeholder (`[Image: caption]`). The `mediaUrl` is completely ignored. No `content[{contentType:"Attachment",attachment:{...}}]` array is built.

**Impact**: Agents see `[Image]` text instead of the actual image/document/audio in the Genesys UI.

---

## G5 — Genesys Payload Shape Mismatch (MEDIUM)

**File**: `src/utils/messageFormatter.ts`

The transformer builds a full Genesys Open Messaging payload (with `channel.platform`, `channel.type`, `to`, etc.) but the `genesys-api-service` controller only uses `{ conversationId, from, text, metadata, isNew }` — it rebuilds the Genesys payload internally.

Extra fields (`channel`, `direction`, `type`, `to`) are silently ignored by the API service, but the `from` structure expected by the API service (`{ nickname, id }`) differs from what the transformer provides (`{ nickname, id, idType: 'Phone' }`). The extra `idType` field is harmless but the missing `from` for existing conversations (G2) is fatal.

---

## G6 — Interactive Messages Not Handled (MEDIUM)

**FRD Phase 1.2**: Interactive message types (button replies, list replies) must be parsed and forwarded.

**Implemented**: `formatMessageText()` falls through to `[Unsupported message type: interactive]`. The actual response text (button reply body or list reply title) is never extracted from `message.interactive.button_reply.title` or `message.interactive.list_reply.title`.

---

## G7 — Missing Message Types (LOW-MEDIUM)

- `sticker` — no handler, falls to unsupported
- `reaction` — no handler
- `contacts` (vCard) — no handler; FRD Phase 1.2 explicitly requires contact parsing
- `order` — no handler
- `system` — not filtered out (should be ignored)

---

## G8 — No TypeScript Types (MEDIUM)

**FRD Phases 1, 2**: Requires `src/types/whatsapp.types.ts` and `src/types/genesys.types.ts`.

**Implemented**: All parameters typed as `any`. No interfaces for the upstream payload shape from webhook-service or for the Genesys API service contract.

---

## G9 — No Input Validation (MEDIUM)

**FRD Phase 8**: Payload must be validated before processing.

**Implemented**: None. A malformed message (e.g. missing `tenantId`, missing `from`, `type` with missing `content`) causes a thrown exception deep inside processing. The consumer catches it and nacks/requeues it — causing an infinite retry loop on invalid data.

---

## G10 — No Dead Letter Queue (HIGH)

**FRD Phase 8.2**: After max retries, messages must be moved to DLQ.

**Implemented**: The consumer always nacks with `requeue: true` after any error. There is no maximum retry count, no DLQ exchange, and no `x-dead-letter-exchange` queue configuration. A single permanently invalid message will loop forever, blocking the consumer.

---

## G11 — No Exponential Backoff (MEDIUM)

**FRD Phase 8.2**: Retry with exponential backoff.

**Implemented**: Fixed 5 000 ms setTimeout before nack. No retry counter, no backoff progression.

---

## G12 — No Structured Logging (MEDIUM)

**FRD Phase 8**: Correlation ID-based error logging.

**Implemented**: `console.log` / `console.error` throughout. No request correlation IDs, no tenant-scoped log context, no log levels, no Winston/Pino.

---

## G13 — RabbitMQ Channel Recovery Missing (MEDIUM)

**File**: `src/consumers/inboundConsumer.ts`

The `startConsumer()` wraps the initial connection in a try/catch with reconnect. However:
- There is no `connection.on('close')` or `connection.on('error')` handler after successful startup.
- If the RabbitMQ connection drops while the service is running, the consumer silently stops without reconnecting.

---

## G14 — Environment Config Inconsistency (LOW)

**File**: `src/config/services.ts` line 23 reads `process.env.GENESYS_API_URL`.

**`.env.example`** has `GENESYS_BASE_URL` — the variable `GENESYS_API_URL` is absent, so the env var is never set and the default `http://genesys-api:3010` is always used even when operators intend to override it.

---

## G15 — Tests Are Placeholder-Only (MEDIUM)

**Implemented**:
- `tests/unit/services/transformer.test.js` — asserts fixture object shapes, never calls any transformer code.
- `tests/api/transform.api.test.js` — creates its own Express app with inline handlers, never imports the actual service code.
- `tests/fixtures/messages.js` — fixture format does not match the actual payload schema published by the webhook-service (missing `tenantId`, `contactName`, `metadata.phoneNumberId`).

---

## G16 — Health Check Incomplete (LOW)

**Implemented**: Returns `{ status: 'healthy', rabbitmq: 'connected|disconnected' }`.

**FRD / best practice**: Should include `service`, `version`, `uptime`, and optionally reachability of downstream services (state-manager, genesys-api-service). Currently `status: 'healthy'` is returned even when RabbitMQ is disconnected.
