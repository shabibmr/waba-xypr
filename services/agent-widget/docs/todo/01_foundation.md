# Task 01 — Foundation: API Paths, Config & Context Resolution

**Priority:** CRITICAL — all other tasks depend on this
**Depends on:** Nothing
**Blocks:** 02_auth, 03_websockets, 04_react_frontend, 05_messaging

---

## Gap Summary

| FRD Requirement | Current State | Status |
|----------------|---------------|--------|
| API path prefix `/api/v1/widget/*` | Mounted at `/widget/api/*` | ❌ Mismatch |
| `GET /api/v1/widget/context/{conversationId}` returns `{ valid, tenantId, wa_id }` | No `/context` endpoint; uses `/api/conversation/:id` which returns full detail | ❌ Missing |
| Context response fields: `valid`, `tenantId`, `wa_id` | Returns `{ conversationId, waId, contactName, ... }` — no `valid` flag | ❌ Wrong shape |
| `integrationId` as required initialization input | Not accepted or stored | ❌ Missing |
| Error on invalid context → 400 with structured error | Returns 500 on any failure | ❌ Wrong |
| CORS allow `mypurecloud.com` | Only allows `localhost:3014` and `localhost:3000` | ❌ Missing |
| Health check at `/health` | Exists at `/health` | ✅ OK |

---

## Tasks

### T1.1 — Fix API Route Prefix

**File:** `src/routes/index.js`, `src/routes/widget.routes.js`

Rename route mount point from `/widget` to `/api/v1/widget`.

```javascript
// src/routes/index.js — change:
router.use('/widget', widgetRoutes);
// to:
router.use('/api/v1/widget', widgetRoutes);
```

Update the frontend `widget.html` to call `/api/v1/widget/*` instead of `/widget/api/*`.

> Note: The static file route (`GET /`) should still work from the same Express server, served at root or via a dedicated path. Decide whether `widget.html` is served from `/api/v1/widget/` or a separate `/widget` static route.

---

### T1.2 — Add Context Resolution Endpoint

**File:** `src/routes/widget.routes.js`, `src/controllers/widget.controller.js`, `src/services/widget.service.js`

Add `GET /api/v1/widget/context/:conversationId`.

**Controller logic:**
```javascript
async getContext(req, res) {
  const { conversationId } = req.params;
  const tenantId = req.headers['x-tenant-id'];
  try {
    const result = await widgetService.resolveContext(conversationId, tenantId);
    res.json(result); // { valid: true, tenantId, wa_id }
  } catch (err) {
    if (err.message === 'InvalidConversation') {
      return res.status(400).json({ error: { message: 'Invalid or unknown conversation', code: 'INVALID_CONVERSATION' } });
    }
    next(err);
  }
}
```

**Service logic (widget.service.js):**
```javascript
async resolveContext(conversationId, tenantId) {
  // Call state-manager: GET /state/conversation/{conversationId}
  const mapping = await this.axiosClient.get(`/state/conversation/${conversationId}`, {
    headers: { 'X-Tenant-ID': tenantId }
  });
  if (!mapping || !mapping.data) throw new Error('InvalidConversation');
  return {
    valid: true,
    tenantId: mapping.data.tenantId || tenantId,
    wa_id: mapping.data.waId
  };
}
```

---

### T1.3 — Accept `integrationId` Input

**Files:** `src/controllers/widget.controller.js`, `src/services/widget.service.js`

Add `integrationId` to:
- URL query param handling in frontend init
- `getContext` / `sendMessage` payloads
- Forwarded as header or body field to downstream services

```javascript
// In send message payload (future):
{ conversationId, tenantId, text, mediaUrl, integrationId }
```

Store `integrationId` in widget config if passed as URL param.

---

### T1.4 — Fix Error Response Shape

**File:** `src/server.js` (global error handler), all controllers

Change all error responses to match system standard:
```javascript
// Standard error shape:
res.status(4xx|5xx).json({
  error: { message: '...', code: 'ERROR_CODE' }
});
```

Replace bare `{ error: 'Internal Server Error' }` in the global handler.

Define an error code enum in `src/utils/errorCodes.js`:
```javascript
module.exports = {
  INVALID_CONVERSATION: 'INVALID_CONVERSATION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TENANT_REQUIRED: 'TENANT_REQUIRED',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
};
```

---

### T1.5 — Fix CORS Origins

**File:** `src/server.js`

Add `mypurecloud.com` and its regional variants to allowed origins:
```javascript
const allowedOrigins = [
  ...(process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
  /\.mypurecloud\.com$/,
  /\.mypurecloud\.de$/,
  /\.mypurecloud\.jp$/,
  /\.mypurecloud\.ie$/,
  /\.usw2\.pure\.cloud$/,
];

cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser requests
    const allowed = allowedOrigins.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    callback(allowed ? null : new Error('CORS not allowed'), allowed);
  },
  credentials: true,
})
```

Also add `ALLOWED_ORIGINS` env var documentation to `.env.example`.

---

### T1.6 — Add `integrationId` to `.env` / Config

**File:** `src/config/index.js`, `.env`

```javascript
integrationId: process.env.INTEGRATION_ID || null,
tenantServiceUrl: process.env.TENANT_SERVICE_URL || 'http://tenant-service:3007',
```

This is needed for multi-tenant WhatsApp integration resolution.

---

## Acceptance Criteria

- [ ] `GET /api/v1/widget/context/abc123` returns `{ valid: true, tenantId, wa_id }` for a known conversation
- [ ] `GET /api/v1/widget/context/unknown` returns 400 `{ error: { message, code: 'INVALID_CONVERSATION' } }`
- [ ] All existing routes reachable under `/api/v1/widget/`
- [ ] CORS allows requests from `*.mypurecloud.com`
- [ ] Error responses across all endpoints use `{ error: { message, code } }` shape
