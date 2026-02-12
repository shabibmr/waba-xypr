# Task 02 — Media Handling & Message Type Support

**Priority**: HIGH
**Depends on**: Task 01 (critical fixes must be working first)
**Blocks**: Task 10 (accurate tests)

---

## 02-A: Forward Media Attachments to Genesys

**Gap ref**: G4

**Context**: The `whatsapp-webhook-service` already downloads media from Meta and stores it in MinIO. The payload delivered to the inbound-transformer queue includes:
```json
{
  "type": "image",
  "content": {
    "mediaId": "...",
    "mimeType": "image/jpeg",
    "caption": "Hello",
    "mediaUrl": "http://minio:9000/whatsapp-media/tenantId/...",
    "storagePath": "tenantId/...",
    "fileSize": 12345
  }
}
```

**Current behaviour**: `formatMessageText()` returns `[Image: caption]` — the `mediaUrl` is silently discarded. Genesys agents see a text placeholder with no media.

**Required behaviour**: When `content.mediaUrl` exists, the transformer must send the Genesys message with an attachment:
```json
{
  "from": { ... },
  "text": "caption text or empty string",
  "metadata": { ... },
  "content": [
    {
      "contentType": "Attachment",
      "attachment": {
        "mediaType": "image/jpeg",
        "url": "http://minio:9000/whatsapp-media/...",
        "filename": "image.jpg"
      }
    }
  ]
}
```

**Files to change**:
- `src/utils/messageFormatter.ts` — add `buildAttachmentContent(metaMessage)` helper
- `src/services/transformerService.ts` — pass attachment content in payload to genesys service
- `src/services/genesysService.ts` — include `content` array in the payload sent to genesys-api-service

**Note**: The `genesys-api-service` sendInboundMessage currently does not forward `content` (attachment array) to the Genesys API. A matching fix will also be required there (see genesys-api-service gap analysis). However the transformer must still correctly build and pass the `content` array so it is ready when the API service is updated.

**Acceptance criteria**:
- Sending an image message from WhatsApp results in an attachment being visible in the Genesys agent UI.
- Text-only messages are unaffected.

---

## 02-B: Handle `content.error` (Media Download Failed Upstream)

**Gap ref**: G4 (sub-case)

When media download failed upstream, the webhook-service sets:
```json
{ "mediaUrl": null, "error": "Media download failed", "rawError": "..." }
```

**Current behaviour**: The transformer tries to use `content.mediaUrl` which is `null`. `formatMessageText()` still returns `[Image: caption]` — no error context is passed to Genesys.

**Required behaviour**: When `content.error` is present, forward the message with a text note indicating media was unavailable, e.g.:
```
[Image unavailable — media download failed]
```
Log the error with the `rawError` for debugging.

**File to change**: `src/utils/messageFormatter.ts`

---

## 02-C: Interactive Message Type Support

**Gap ref**: G6

**WhatsApp interactive payload** (button reply):
```json
{
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": { "id": "btn_1", "title": "Yes" }
  }
}
```

**WhatsApp interactive payload** (list reply):
```json
{
  "type": "interactive",
  "interactive": {
    "type": "list_reply",
    "list_reply": { "id": "item_1", "title": "Option A", "description": "..." }
  }
}
```

**Required**: Extract the human-readable reply text and send it as a `Text` type message to Genesys:
- Button reply → text: `"Yes"` (the button title)
- List reply → text: `"Option A"` (the list item title)

**File to change**: `src/utils/messageFormatter.ts` — add `case 'interactive':` to `formatMessageText()`

---

## 02-D: Contact / vCard Message Support

**Gap ref**: G7

**WhatsApp contacts payload** (after extraction by webhook-service):
```json
{
  "type": "contacts",
  "content": {
    "contacts": [
      {
        "name": { "formatted_name": "Jane Doe" },
        "phones": [{ "phone": "+1234567890", "type": "MOBILE" }]
      }
    ]
  }
}
```

**Required**: Format as readable text for the agent:
```
[Contact: Jane Doe (+1234567890)]
```

**File to change**: `src/utils/messageFormatter.ts`

---

## 02-E: Sticker Message Support

**Gap ref**: G7

Stickers are a `mediaId`-based type with `mimeType: image/webp`. The upstream webhook-service processes them like images — `content.mediaUrl` will be populated.

**Required**: Treat like image (forward attachment). `formatMessageText()` should return `[Sticker]` when `mediaUrl` present.

**File to change**: `src/utils/messageFormatter.ts`

---

## 02-F: Filter `system` and `reaction` Message Types

**Gap ref**: G7

- `system` messages (user joined, group events) — should be silently acknowledged and not forwarded to Genesys.
- `reaction` messages — acknowledge but do not forward (Genesys Open Messaging does not support reactions natively).

**Required**: In `transformerService.ts`, check `metaMessage.type` before processing. If type is `system` or `reaction`, log a debug message and return without calling Genesys.

**File to change**: `src/services/transformerService.ts`
