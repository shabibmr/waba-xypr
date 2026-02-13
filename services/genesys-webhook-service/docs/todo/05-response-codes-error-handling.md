# Task File 05 — Response Codes & Error Handling
**Priority:** HIGH — Depends on 01, 02 (correct flow must exist before responses can be validated)
**FRD Refs:** §5.1.3, §6.1.1, §7.1, §7.2, §7.3

---

## Gaps

### GAP-32: Controller always returns 200 immediately then processes async
**Current (`webhook.controller.ts` `handleWebhook`):**
```typescript
res.status(200).json({ status: 'accepted' }); // sent first
// ... processing happens asynchronously after
```
**FRD (§5.4):** The webhook handler does process synchronously (including media) and returns 200 only after publishing to RabbitMQ — but it must stay within the 4.5s timeout window. The `200 OK` should only be returned on success; error codes must be returned if the pipeline fails at pre-processing steps (signature check, tenant lookup, JSON parse) before async processing begins.

**Current Issue:** By sending 200 before validation, the service cannot return 403 for invalid signatures or 400 for unknown integrations — the response is already committed.

**Correct Approach:**
1. Synchronous gates (parse, tenant resolve, signature validate, echo check, classify) → can return 4xx
2. Async gates (media, RabbitMQ publish) → process async; if they fail, log but don't fail the HTTP response (already returned 200)

**Note:** The FRD's complete flow function in §5.4 returns different codes synchronously. The current "respond first" pattern must be replaced with "validate first, respond after".

---

### GAP-33: Missing 503 response for dependency failures
**Current:** Returns 500 for all server-side errors.
**FRD (§5.1.3, §7.1.2):**
- Tenant Service down → `503 Service Unavailable { "error": "Service temporarily unavailable" }`
- (RabbitMQ failure doesn't block the HTTP response per §3.1, but other dependency failures may)

---

### GAP-34: Missing timeout wrapper for webhook handler
**Current:** No request timeout.
**FRD (§6.1.1):** Must respond within 4.5 seconds (Genesys SLA is 5s). If handler exceeds 4.5s, return `500 { "error": "Processing timeout" }`.
```js
// Wrap handler with 4.5s timeout
// asyncio.wait_for(..., timeout=4.5) equivalent in Node.js
```

---

### GAP-35: Error response format inconsistency
**Current:** Uses `{ error: { message, status } }` nested format in `error-handler.ts`.
**FRD (§5.1.3):** Response body format is flat: `{ "error": "message string" }`.
```json
{ "error": "Invalid signature" }   // NOT { "error": { "message": "..." } }
```

---

### GAP-36: Malformed JSON error not returned correctly
**Current:** Express JSON parser middleware will 400 on bad JSON but with its default error format.
**FRD (§5.1.3):** Must return `400 { "error": "Invalid JSON" }` on parse failure.
**Action:** Add a JSON parse error handler that catches SyntaxError from body parser.

---

### GAP-37: Missing `integrationId` in body not caught before signature check
**Current:** If `channel.from.id` is absent, the service may throw an unhandled error.
**FRD (§5.4):** Should return `400 { "error": "Missing integration ID" }`.

---

## Tasks

| # | Task | File(s) to Change |
|---|------|-------------------|
| 05-A | Refactor `handleWebhook` to validate synchronously first (parse → tenant → signature → echo → classify), then respond, then process async (media → publish) | `webhook.controller.ts` |
| 05-B | Return `400 { "error": "Missing integration ID" }` when `channel.from.id` is absent | `webhook.controller.ts` |
| 05-C | Return `503 { "error": "Service temporarily unavailable" }` when Tenant Service call fails with network error | `webhook.controller.ts` or `validate-signature.middleware.ts` |
| 05-D | Add 4.5s timeout wrapper around `handleWebhook` using `Promise.race` with a timeout | `webhook.controller.ts` |
| 05-E | Fix error response format to flat `{ "error": "string" }` (not nested) | `error-handler.ts` |
| 05-F | Add SyntaxError handler for JSON parse failures → `400 { "error": "Invalid JSON" }` | `index.ts` or `error-handler.ts` |

---

## Response Code Reference (FRD §5.1.3)

| Scenario | Code | Response Body |
|---|---|---|
| Success | 200 | `{ "status": "accepted" }` |
| Invalid signature | 403 | `{ "error": "Invalid signature" }` |
| Tenant not found | 400 | `{ "error": "Unknown integration" }` |
| Malformed JSON | 400 | `{ "error": "Invalid JSON" }` |
| Missing integration ID | 400 | `{ "error": "Missing integration ID" }` |
| Service error | 500 | `{ "error": "Processing failed" }` |
| Dependency unavailable | 503 | `{ "error": "Service temporarily unavailable" }` |
| Echo filtered | 200 | `{ "status": "accepted", "echo_filtered": true }` |
| Health check event | 200 | `{ "status": "healthy" }` |
| Request too large | 413 | `{ "error": "Request too large" }` |

---

## Acceptance Criteria
- Validation errors (403, 400) are returned before async processing starts
- Tenant Service network failure → 503
- Handler completes within 4.5s or returns 500 timeout
- All error responses use flat `{ "error": "string" }` format
- Bad JSON → `400 { "error": "Invalid JSON" }`
