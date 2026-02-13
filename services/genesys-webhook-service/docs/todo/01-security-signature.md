# Task File 01 — Security & Signature Validation
**Priority:** CRITICAL (must be first — everything downstream depends on correct tenant resolution)
**FRD Refs:** REQ-SEC-01, §2.1, §5.1.2, §8.1, §8.2

---

## Gaps

### GAP-01: Integration ID extracted from wrong field
**Current:** `genesys-handler.service.ts` and `validate-signature.middleware.ts` read `integrationId` from a non-standard location in the body (root-level `integrationId` or `conversationId`).
**FRD (§5.1.2, Step 1):** Must extract from `channel.from.id`.
```
integration_id = request_json["channel"]["from"]["id"]
```
**Impact:** Signature validation will fail for correctly-formed Genesys Open Messaging webhooks.

---

### GAP-02: Tenant lookup API endpoint is wrong
**Current (`tenant.service.ts`):**
- Step 1: tries `GET {STATE_SERVICE_URL}/state/conversation/{conversationId}` (State Manager — wrong service)
- Step 2: falls back to `GET {TENANT_SERVICE_URL}/tenants/{integrationId}/credentials/genesys`

**FRD (§3.3, §5.1.2, Step 2):** Single call:
```
GET /api/v1/tenants/by-integration/{integrationId}
Authorization: Bearer {service_token}
```
Returns: `{ tenantId, integrationId, webhookSecret, status }`

**Impact:** Tenant is never correctly resolved from `integrationId`. The State Manager lookup is inbound-only logic and irrelevant here.

---

### GAP-03: Incorrect HTTP status code for invalid signature
**Current (`validate-signature.middleware.ts`):** Returns `401 Unauthorized` on HMAC mismatch.
**FRD (§5.1.3):** Must return `403 Forbidden`.
```
| Invalid signature | 403 Forbidden | {"error": "Invalid signature"} |
```

---

### GAP-04: Incorrect HTTP status code for tenant not found
**Current:** Returns `404 Not Found` when tenant cannot be resolved.
**FRD (§5.1.3):** Must return `400 Bad Request` with body `{"error": "Unknown integration"}`.

---

### GAP-05: Signature validation format inconsistency
**Current:** Tries both hex and base64 formats for the signature.
**FRD (§2.1, §8.1.1):** Header format is fixed: `sha256=<hex-digest>`. Only hex is valid. Dual-format support is non-standard and may silently accept malformed signatures.
**Action:** Remove base64 fallback; only accept `sha256=<hex>`.

---

### GAP-06: Missing request size limit middleware
**Current:** No body size limit configured.
**FRD (§8.2.1):** Maximum request size `10 MB`. Should return `413 Request Entity Too Large`.
```js
app.use(express.json({ limit: '10mb' }))
// OR middleware:
// if (content-length > 10MB) → 413
```

---

### GAP-07: Missing Content-Type validation
**Current:** No content-type check.
**FRD (§8.2.2):** Only `application/json` webhooks must be accepted. Others should be rejected.

---

### GAP-08: Webhook secret not returned by tenant lookup
**Current:** Makes a separate `/credentials/genesys` call to get `webhookSecret` after tenant lookup.
**FRD (§3.3):** The `GET /api/v1/tenants/by-integration/{integrationId}` response already includes `webhookSecret`. No second call is needed.

---

## Tasks

| # | Task | File(s) to Change |
|---|------|-------------------|
| 01-A | Fix `channel.from.id` extraction for `integrationId` | `validate-signature.middleware.ts` |
| 01-B | Replace tenant lookup with `GET /api/v1/tenants/by-integration/{integrationId}` | `tenant.service.ts` |
| 01-C | Remove State Manager fallback from signature validation path | `tenant.service.ts` |
| 01-D | Change 401 → 403 for invalid signature | `validate-signature.middleware.ts` |
| 01-E | Change 404 → 400 for unknown integration | `validate-signature.middleware.ts` |
| 01-F | Remove base64 fallback from signature comparison; hex only | `validate-signature.middleware.ts` |
| 01-G | Add `express.json({ limit: '10mb' })` or custom 413 middleware | `index.ts` |
| 01-H | Add Content-Type validation (reject non-`application/json`) | `index.ts` or new middleware |

---

## Acceptance Criteria
- `POST /webhook` with correct Genesys payload extracts `channel.from.id` as `integrationId`
- Tenant lookup calls `GET /api/v1/tenants/by-integration/{integrationId}` and reads `webhookSecret` from response
- Invalid signature returns `403 { "error": "Invalid signature" }`
- Unknown integration returns `400 { "error": "Unknown integration" }`
- Body over 10MB returns `413`
- Non-JSON Content-Type returns `400`
