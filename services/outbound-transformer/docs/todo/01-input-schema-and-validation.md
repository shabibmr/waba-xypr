# Phase 1: Input Schema & Validation

**Priority:** Critical | **Dependency:** None (foundation layer)
**FRD Refs:** REQ-OUT-01, Section 3.1, Section 5.1

---

## Gap Summary

The current service consumes a **legacy Genesys webhook object** with flat fields (`text`, `mediaUrl`, `mediaType`, `conversationId`, `messageId`). The FRD specifies a completely different **enriched message schema** from the state-manager with nested `payload.text` / `payload.media` structure and explicit fields like `internalId`, `tenantId`, `waId`, `phoneNumberId`, `genesysId`, `timestamp`, `type`.

**No input validation exists at all** -- no field presence checks, no format validation, no length limits.

---

## Current State

- **Input format:** `{ conversationId, messageId, text, mediaUrl, mediaType, direction, ... }` (ad-hoc Genesys format)
- **Validation:** Zero -- any shape is accepted
- **waId / tenantId resolution:** Fetched via HTTP from state-manager using `conversationId` (not from message)
- **Files affected:** `src/services/message-processor.service.ts`, `src/services/transformer.service.ts`

## Expected State (FRD)

- **Input format:** `{ internalId, tenantId, conversationId, genesysId, waId, phoneNumberId, timestamp, type, payload: { text?, media? } }`
- **All fields self-contained** -- no external lookups needed for core routing data
- **Full validation** on every field before processing

---

## Tasks

### T1.1 - Define Input Message Interface/Type
- Create `src/types/messages.ts` (or `src/models/input-message.ts`)
- Define TypeScript interface matching FRD Section 3.1:
  ```typescript
  interface InputMessage {
    internalId: string;     // UUID v4
    tenantId: string;       // UUID v4
    conversationId: string; // 1-255 chars
    genesysId: string;      // 1-255 chars
    waId: string;           // E.164 no +, regex: ^[1-9][0-9]{6,14}$
    phoneNumberId: string;  // numeric string
    timestamp: number;      // Unix epoch seconds 1000000000-9999999999
    type: 'message';
    payload: {
      text?: string;        // 1-4096 chars if present
      media?: {
        url: string;
        mime_type: string;
        filename?: string;
      }
    }
  }
  ```

### T1.2 - Define Output Message Interface/Type
- In same or separate types file, define FRD Section 3.2 output:
  ```typescript
  interface OutputMessage {
    metadata: {
      tenantId: string;
      phoneNumberId: string;
      internalId: string;
      correlationId: string;
    };
    wabaPayload: {
      messaging_product: 'whatsapp';
      recipient_type: 'individual';
      to: string;
      type: 'text' | 'image' | 'video' | 'document' | 'audio';
      text?: { body: string };
      image?: { link: string; caption?: string };
      video?: { link: string; caption?: string };
      document?: { link: string; filename?: string; caption?: string };
      audio?: { link: string };
    }
  }
  ```

### T1.3 - Implement Input Validation Service
- Create `src/services/validator.service.ts`
- Implement `validateInputMessage(message: unknown): { valid: boolean; errors: string[] }`
- Validation rules per FRD Section 5.1:
  - Required fields: `internalId`, `tenantId`, `conversationId`, `genesysId`, `waId`, `phoneNumberId`, `timestamp`, `type`, `payload`
  - UUID v4 regex for `internalId` and `tenantId`: `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`
  - `waId` regex: `^[1-9][0-9]{6,14}$`
  - `phoneNumberId` regex: `^[0-9]+$`
  - `timestamp` range: `1000000000 <= ts <= 9999999999`
  - `type` must be `'message'`
  - `payload` must have `text` OR `media`
  - If `text`: trim, check `length > 0`, check `length <= 4096`
  - If `media`: require `url` and `mime_type`

### T1.4 - Integrate Validation into RabbitMQ Consumer
- Modify `src/services/rabbitmq.service.ts`:
  - After JSON parse, call `validateInputMessage()`
  - If invalid: log error with field details, ACK the message (don't retry invalid), increment metric counter
  - If valid: proceed to processing

### T1.5 - Update Message Processor for New Schema
- Rewrite `src/services/message-processor.service.ts`:
  - Remove HTTP call to state-manager for `getConversationMapping()` -- data now in message
  - Extract `waId`, `phoneNumberId`, `tenantId`, `internalId`, `genesysId` directly from message
  - Pass full `InputMessage` to transformer instead of flat Genesys object
  - Remove references to `genesysMessage.messageId`, `genesysMessage.text`, `genesysMessage.mediaUrl`

### T1.6 - Handle Invalid JSON Gracefully
- In `rabbitmq.service.ts`, wrap `JSON.parse()` in try/catch
- On `SyntaxError`: log error, ACK message (remove from queue), return early
- Currently NACK+requeue on parse errors causes infinite retry loop

---

## Acceptance Criteria

- [ ] TypeScript interfaces defined for input and output schemas
- [ ] All 9 required fields validated with correct regexes
- [ ] Invalid messages are ACKed (not re-queued) and logged
- [ ] `payload` presence check: must have `text` or `media`
- [ ] Text length validated: 1-4096 chars after trim
- [ ] Media object validated: requires `url` and `mime_type`
- [ ] Invalid JSON ACKed and logged (no infinite retry)
- [ ] Message processor reads from new schema, not legacy Genesys format
