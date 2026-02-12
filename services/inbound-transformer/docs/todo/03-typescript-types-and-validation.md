# Task 03 — TypeScript Types and Input Validation

**Priority**: MEDIUM
**Depends on**: Task 01 (understand correct field shapes first)
**Blocks**: nothing directly, but reduces bugs in Task 02

---

## 03-A: Define WhatsApp Upstream Payload Types

**Gap ref**: G8

Create `src/types/whatsapp.types.ts` with interfaces matching the payload format published by `whatsapp-webhook-service`:

```typescript
export interface WhatsAppContent {
    text?: string;
    caption?: string;
    mediaId?: string;
    mimeType?: string;
    filename?: string;
    mediaUrl?: string | null;
    storagePath?: string;
    fileSize?: number;
    error?: string;
    rawError?: string;
    // location
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
    // interactive
    interactive?: {
        type: 'button_reply' | 'list_reply';
        button_reply?: { id: string; title: string };
        list_reply?: { id: string; title: string; description?: string };
    };
    // contacts
    contacts?: Array<{
        name: { formatted_name: string };
        phones?: Array<{ phone: string; type?: string }>;
    }>;
}

export interface InboundWhatsAppMessage {
    tenantId: string;
    messageId: string;
    from: string;              // customer phone number (wa_id)
    contactName: string;
    timestamp: string;
    type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker'
         | 'location' | 'contacts' | 'interactive' | 'reaction' | 'system';
    content: WhatsAppContent;
    metadata: {
        phoneNumberId: string;
        displayPhoneNumber: string;
    };
}
```

**File to create**: `src/types/whatsapp.types.ts`

---

## 03-B: Define Genesys API Service Contract Types

**Gap ref**: G8

Create `src/types/genesys.types.ts` reflecting the contract with `genesys-api-service`:

```typescript
export interface GenesysFrom {
    nickname: string;
    id: string;
}

export interface GenesysAttachment {
    mediaType: string;
    url: string;
    filename?: string;
}

export interface GenesysContentItem {
    contentType: 'Attachment';
    attachment: GenesysAttachment;
}

// Payload sent to genesys-api-service POST /genesys/messages/inbound
export interface GenesysInboundPayload {
    from: GenesysFrom;
    text: string;
    metadata: {
        whatsappMessageId: string;
        whatsappPhone: string;
        phoneNumberId: string;
        [key: string]: unknown;
    };
    conversationId: string | null;
    isNew: boolean;
    content?: GenesysContentItem[];
}

// Response from genesys-api-service
export interface GenesysApiResponse {
    success: boolean;
    messageId: string;
    conversationId: string;
    tenantId: string;
}
```

**File to create**: `src/types/genesys.types.ts`

---

## 03-C: Apply Types Across the Codebase

**Files to update** (replace `any` with proper types):
- `src/utils/messageFormatter.ts` — parameter and return types
- `src/services/transformerService.ts` — `metaMessage: InboundWhatsAppMessage`
- `src/services/stateService.ts` — response types
- `src/services/genesysService.ts` — `GenesysInboundPayload` parameter, `GenesysApiResponse` return

---

## 03-D: Input Validation with Joi (or Zod)

**Gap ref**: G9

Create `src/validators/inboundMessageSchema.ts`:

```typescript
import Joi from 'joi';

export const inboundMessageSchema = Joi.object({
    tenantId: Joi.string().required(),
    messageId: Joi.string().required(),
    from: Joi.string().required(),
    contactName: Joi.string().default('Unknown'),
    timestamp: Joi.string().required(),
    type: Joi.string().required(),
    content: Joi.object().required(),
    metadata: Joi.object({
        phoneNumberId: Joi.string().required(),
        displayPhoneNumber: Joi.string().required()
    }).required()
});
```

**Where to apply**: In `src/consumers/inboundConsumer.ts`, validate the parsed payload before calling `processInboundMessage()`. If validation fails, **do not requeue** — ack the message and send to DLQ or log as invalid. Invalid structure will never be valid upon retry.

**Add dependency**: `joi` to `package.json` (already listed in implementation_plan.md dependencies).

---

## 03-E: Validate Genesys API Response

**Gap ref**: G3 (hardening)

In `src/services/genesysService.ts`, after receiving the response, validate it matches `GenesysApiResponse` shape before returning. Throw a descriptive error if `messageId` is missing.
