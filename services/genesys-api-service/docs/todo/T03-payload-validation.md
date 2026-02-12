# T03 — Input Payload Validation (CRITICAL / MVP)

**Status:** NOT IMPLEMENTED
**Severity:** CRITICAL — Invalid payloads currently crash the consumer silently
**MVP Required:** YES
**Depends On:** T01 (consumer provides the payload), T02 (deduplication is part of this gate)
**Blocks:** Nothing (but required before T04/T05 can be called safely)

---

## Gap Description

The FRD defines explicit validation rules for the `inbound-processed` message schema. Currently there is **no validation anywhere** in the pipeline — the service just destructures payload fields directly. An invalid message (missing `metadata.tenantId`, wrong `direction`, malformed JSON) will throw an unhandled error.

**FRD reference:** Sections 5.1 (Input Schema), 5.1 (Validation Rules), 6.1 (Error Scenarios)

---

## Required Validation Rules (from FRD Section 5.1)

### Structure Checks

| Check | Error Action |
|-------|-------------|
| `metadata` section present | DLQ + ACK |
| `metadata.tenantId` present | DLQ + ACK |
| `metadata.tenantId` is valid format (non-empty string) | DLQ + ACK |
| `metadata.whatsapp_message_id` present | DLQ + ACK |
| `metadata.correlationId` present | DLQ + ACK |
| `genesysPayload` section present | DLQ + ACK |
| `genesysPayload.id` present | DLQ + ACK |
| `genesysPayload.direction` === `"Inbound"` | DLQ + ACK |
| `genesysPayload.channel` present | DLQ + ACK |
| If `genesysPayload.type` === `"Text"`: `genesysPayload.text` must be present | DLQ + ACK |

### Deduplication Check (Idempotency Gate)

After schema validation, check Redis for duplicate:
- Key: `genesys:dedupe:{tenantId}:{whatsapp_message_id}`
- Use atomic `SET NX EX 86400`
- If key already exists: **ACK silently, skip processing** (not an error)
- If Redis unavailable: **fail open** (allow through, log warning)

**FRD reference:** Section 6.2 (Idempotency Check)

---

## What Needs to Be Built

### 1. Validation Function (`src/utils/validate-payload.ts`)

A pure function:
```
validateInboundPayload(payload: unknown): { valid: true, data: InboundMessage } | { valid: false, reason: string }
```

- No external dependencies (pure logic)
- Returns structured result (not throws) to let consumer decide action
- Must check all rules in the table above

### 2. Type Definition (`src/types/inbound-message.ts`)

TypeScript interface matching the FRD section 5.1 schema:
```typescript
interface InboundMessage {
  metadata: {
    tenantId: string;
    whatsapp_message_id: string;
    timestamp: string;
    retryCount?: number;
    correlationId: string;
  };
  genesysPayload: {
    id: string;
    channel: object;
    type: string;
    text?: string;
    direction: 'Inbound';
  };
}
```

### 3. Integration into Consumer (T01)

In the consumer message handler:
1. Parse JSON → catch SyntaxError → DLQ
2. Call `validateInboundPayload(parsed)` → if invalid → DLQ
3. Check deduplication → if duplicate → silent ACK + return
4. Continue to processing pipeline

---

## Acceptance Criteria

- [ ] Missing `metadata.tenantId` routes to DLQ (not NACK)
- [ ] `direction !== "Inbound"` routes to DLQ
- [ ] Text message without `text` field routes to DLQ
- [ ] Valid payload passes through without error
- [ ] Duplicate `whatsapp_message_id` is silently ACK'd (not processed twice)
- [ ] Redis unavailability does not block validation (deduplication fails open)
