# T05 — Fix Genesys API URL & Payload Structure (CRITICAL / MVP)

**Status:** WRONG IMPLEMENTATION
**Severity:** CRITICAL — Current URL and payload do not match Genesys Open Messaging Inbound API spec
**MVP Required:** YES
**Depends On:** T06 (integrationId must come from tenant config)
**Blocks:** T04 (communicationId extraction), T08 (retry wraps this call)

---

## Gap Description

`genesys-api.service.ts::sendInboundMessage` has two major deviations from the FRD:

### Deviation 1 — Wrong API URL

**FRD specifies (Section 5.3):**
```
POST https://api.{region}.genesys.cloud/api/v2/conversations/messages/inbound/open
```

**Current implementation:**
```typescript
const url = `${baseUrl}/api/v2/conversations/messages/${credentials.integrationId}/inbound/open/message`;
```

The implemented URL:
- Embeds `integrationId` in the path (wrong — `to.id` in the body handles this)
- Appends `/message` (wrong path segment)
- Uses `https://api.${credentials.region}` instead of `https://api.${region}.genesys.cloud`

### Deviation 2 — Wrong Payload Structure

**FRD specifies (Section 5.3):** The body is the `genesysPayload` object directly from the inbound message:

```json
{
  "id": "uuid-from-genesysPayload",
  "channel": {
    "platform": "Open",
    "type": "Private",
    "messageId": "wamid...",
    "to": { "id": "integration-id-from-config" },
    "from": { "nickname": "John", "id": "919876543210", "idType": "Phone", "firstName": "John" },
    "time": "2023-11-15T03:33:20.000Z"
  },
  "type": "Text",
  "text": "Hello World",
  "direction": "Inbound"
}
```

**Current implementation reconstructs a new payload:**
```typescript
const payload = {
  channel: { platform, type, messageId, time, from: { nickname, id, idType, firstname } },
  direction: 'Inbound',
  type: 'Text',
  text,
  metadata: { ...metadata, tenantId, conversationId }  // ← Not in FRD spec
};
```

Issues:
- Missing `id` field (UUID from `genesysPayload.id`)
- Missing `channel.to.id` (integration ID — required by Genesys API)
- Has `firstname` (wrong casing — FRD uses `firstName`)
- Adds `metadata` wrapper (not in Genesys API schema — may cause 400)
- Takes `text` as a raw parameter instead of using `genesysPayload.text`
- Adds `conversationId` to metadata unnecessarily

### Deviation 3 — Missing X-Correlation-ID Header

**FRD specifies (Section 5.3):**
```python
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json",
    "X-Correlation-ID": message["metadata"]["correlationId"]
}
```

**Current implementation:** Does not add `X-Correlation-ID` header.

### Deviation 4 — No Timeout Configuration

**FRD specifies (Section 5.2):** `connectMs: 5000`, `readMs: 10000`

**Current implementation:** axios call has no timeout. Network hangs will block forever.

### Deviation 5 — communicationId Not Extracted from Response

**FRD specifies (Section 5.4):** Extract both `id` (conversationId) and `communicationId` from response.

**Current implementation:**
```typescript
return {
  conversationId: response.data.conversation?.id || conversationId,  // wrong path
  messageId: response.data.id,
};
```

The correct extraction per FRD 5.4:
- `conversationId` = `response.data.id`  (not `response.data.conversation?.id`)
- `communicationId` = `response.data.communicationId`

---

## What Needs to Be Fixed

### In `src/services/genesys-api.service.ts`

The `sendInboundMessage` function's signature and logic must change to accept the full `InboundMessage` (from T03) rather than destructured parts:

1. **Fix URL:**
   ```
   https://api.{region}.genesys.cloud/api/v2/conversations/messages/inbound/open
   ```
   Note: `region` format from tenant config is already like `usw2.pure.cloud`, so URL becomes `https://api.usw2.pure.cloud/api/v2/...`

2. **Fix payload body:** Pass `message.genesysPayload` directly as the request body — the inbound transformer already built it in the correct format.

3. **Inject `channel.to.id`:** The `integrationId` from tenant config must be set as `genesysPayload.channel.to.id` before sending (inbound-transformer may not always have this — verify).

4. **Add headers:** `X-Correlation-ID: metadata.correlationId`

5. **Add timeout:** `axios({ timeout: 10000 })` at minimum; ideally use per-tenant config values when available.

6. **Fix response extraction:**
   - `conversationId` = `response.data.id`
   - `communicationId` = `response.data.communicationId`

---

## Acceptance Criteria

- [ ] URL matches FRD: `https://api.{region}.genesys.cloud/api/v2/conversations/messages/inbound/open`
- [ ] Request body is the `genesysPayload` from the inbound message (not reconstructed)
- [ ] `channel.to.id` is set to tenant's `integrationId`
- [ ] `X-Correlation-ID` header is sent
- [ ] Axios call has a timeout (minimum 10 seconds)
- [ ] `conversationId` extracted from `response.data.id`
- [ ] `communicationId` extracted from `response.data.communicationId`
- [ ] Return value includes both `conversationId` and `communicationId` for T04 to use
