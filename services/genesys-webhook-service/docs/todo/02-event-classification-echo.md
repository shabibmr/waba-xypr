# Task File 02 — Event Classification & Echo Detection
**Priority:** CRITICAL — Depends on 01 (correct tenant resolution must be done first)
**FRD Refs:** REQ-OUT-01, REQ-OUT-06, §2.2, §2.4, §5.1.2 Steps 4–6

---

## Gaps

### GAP-09: Wrong Genesys payload schema assumed
**Current (`genesys-handler.service.ts`):** The handler reads from a different payload structure — uses root-level `eventType`, `conversationId`, `message`, `channel`, `metadata`. This is a different Genesys event format (likely Genesys Notification Service or Conversation API format).

**FRD (§4.1):** Genesys Open Messaging webhooks use this schema:
```json
{
  "id": "msg-abc-123",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "to": { "id": "919876543210", "idType": "Phone" },
    "from": { "id": "integration-id-5678", "idType": "Email" },
    "time": "2023-01-01T12:00:00.000Z",
    "messageId": null
  },
  "type": "Text",
  "text": "Hello, how can I help you?",
  "direction": "Outbound"
}
```
**Impact:** The entire classification and routing logic is built around the wrong event shape.

---

### GAP-10: Event classification logic missing
**Current:** Routes based on `eventType` string and presence of `message` field using ad-hoc logic.
**FRD (§5.1.2, Step 4):** Must classify by `type` + `direction`:
```
if direction != "Outbound" → "unknown"
if type == "Text" or "Structured" → "outbound_message"
if type in ["Receipt", "Typing", "Disconnect"] → "status_event"
if type == "HealthCheck" → "health_check"
else → "unknown"
```
**Impact:** Inbound messages (from customers) may be incorrectly processed as outbound, causing loops.

---

### GAP-11: Echo detection completely missing
**Current:** No echo detection anywhere in the codebase.
**FRD (§2.4, §5.1.2, Step 5):** Before routing, check `channel.messageId`:
- If `messageId` starts with `mw-`, `middleware-`, or `injected-` → suppress
- If `messageId` matches internal UUID pattern (v4 UUID) → suppress
- Return `200 OK { "status": "accepted", "echo_filtered": true }` (do NOT publish to queue)
- Log as `echo_filtered`

**Impact:** Messages sent by the middleware's own `genesys-api-service` will echo back as webhooks, creating an infinite loop.

---

### GAP-12: HealthCheck event not handled
**Current:** No handling for `type: "HealthCheck"`.
**FRD (§2.2, §5.1.2, Step 7):** Must return `200 { "status": "healthy" }` immediately without publishing to any queue. Genesys sends these as connectivity tests.

---

### GAP-13: `unknown` event type not handled gracefully
**Current:** Falls through to processing logic.
**FRD:** Unknown events should be logged as a warning and return `200 OK` without publishing.

---

### GAP-14: Direction field not checked
**Current:** No `direction` field check.
**FRD (§5.1.2, Step 4):** Only `direction: "Outbound"` events should be processed. All inbound events must be ignored (they are handled by the WhatsApp webhook service pipeline).

---

## Tasks

| # | Task | File(s) to Change |
|---|------|-------------------|
| 02-A | Refactor `genesys-handler.service.ts` to read FRD-compliant Open Messaging payload schema (`id`, `channel.from.id`, `channel.to.id`, `type`, `direction`, `text`, `content[]`) | `genesys-handler.service.ts` |
| 02-B | Implement `classifyEvent(payload)` function: check `direction == "Outbound"`, map `type` → event class | `genesys-handler.service.ts` or new `event-classifier.ts` |
| 02-C | Implement `isEchoEvent(payload)` function: check `channel.messageId` for `mw-`/`middleware-`/`injected-` prefixes and v4 UUID pattern | new `echo-detector.ts` or inline |
| 02-D | Add echo check in `webhook.controller.ts` before routing; return `200 { status: "accepted", echo_filtered: true }` | `webhook.controller.ts` |
| 02-E | Handle `health_check` type: return `200 { "status": "healthy" }` without queue publish | `webhook.controller.ts` |
| 02-F | Handle `unknown` type: log warning, return `200 OK`, no queue publish | `webhook.controller.ts` |
| 02-G | Remove or deprecate legacy endpoints (`/outbound`, `/events`, `/agent-state`) — they assume wrong payload schema | `webhook.routes.ts` |

---

## Acceptance Criteria
- `type: "Text", direction: "Outbound"` → classified as `outbound_message`
- `type: "Receipt", direction: "Outbound"` → classified as `status_event`
- `type: "HealthCheck"` → `200 { "status": "healthy" }`, nothing published
- `direction: "Inbound"` → ignored, `200 OK`, nothing published
- `channel.messageId: "mw-xyz"` → `200 { echo_filtered: true }`, nothing published
- `channel.messageId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"` (v4 UUID) → `200 { echo_filtered: true }`, nothing published
- A real Genesys message with `messageId: null` → NOT filtered
