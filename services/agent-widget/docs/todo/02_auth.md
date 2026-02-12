# Task 02 — Authentication & Authorization

**Priority:** HIGH — required before any protected endpoint is used in production
**Depends on:** 01_foundation
**Blocks:** 03_websockets (auth handshake), 04_react_frontend (token handling)

---

## Gap Summary

| FRD Requirement | Current State | Status |
|----------------|---------------|--------|
| Genesys SSO token (expires 5 min), validated per call | Token extracted from URL param, forwarded as-is, never validated | ❌ Not validated |
| Portal: Bearer token OR HTTP-only cookie | Only URL param `?token=`, defaults to `'demo'` | ❌ Incomplete |
| `POST /auth/validate` called on every request | No auth validation at all | ❌ Missing |
| PCI mode: if `pciCheck=true`, disable input | No PCI flag handling anywhere | ❌ Missing |
| WebSocket auth handshake `{ token }` | No WebSocket exists yet | ❌ Missing (in 03) |
| Tenant isolation enforced on every call | `X-Tenant-ID` header passed, but no validation it is legitimate | ❌ Partial |

---

## Tasks

### T2.1 — Create Auth Validation Middleware

**New file:** `src/middleware/authenticate.js`

```javascript
const axios = require('axios');
const config = require('../config');

module.exports = async function authenticate(req, res, next) {
  // Skip auth for health check and config
  const skipPaths = ['/health', '/api/v1/widget/config'];
  if (skipPaths.includes(req.path)) return next();

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: { message: 'Authentication required', code: 'UNAUTHORIZED' } });
  }

  try {
    // Validate token with auth-service
    const response = await axios.post(
      `${config.services.authServiceUrl}/auth/validate`,
      { token },
      { timeout: 3000 }
    );
    req.agent = response.data; // { agentId, tenantId, pciMode, ... }
    // Inject tenantId from token if not provided via header
    if (!req.headers['x-tenant-id'] && req.agent.tenantId) {
      req.headers['x-tenant-id'] = req.agent.tenantId;
    }
    next();
  } catch (err) {
    if (err.response?.status === 401) {
      return res.status(401).json({ error: { message: 'Invalid or expired token', code: 'TOKEN_INVALID' } });
    }
    // Auth service unavailable — fail open in dev, closed in prod
    if (config.env === 'production') {
      return res.status(503).json({ error: { message: 'Auth service unavailable', code: 'AUTH_UNAVAILABLE' } });
    }
    next(); // dev: skip auth if auth service is down
  }
};

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  // HTTP-only cookie (portal mode)
  if (req.cookies?.session_token) return req.cookies.session_token;
  return null;
}
```

**Register in server.js:**
```javascript
const authenticate = require('./middleware/authenticate');
app.use(authenticate);
```

Add `cookie-parser` dependency:
```bash
npm install cookie-parser
```

---

### T2.2 — Add Auth Service URL to Config

**File:** `src/config/index.js`

```javascript
services: {
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://auth-service:3004',
  stateManagerUrl: ...,
  whatsappApiUrl: ...,
}
```

**File:** `.env`
```
AUTH_SERVICE_URL=http://localhost:3004
```

---

### T2.3 — PCI Mode Handling

**File:** `src/controllers/widget.controller.js`

Add `getConfig()` to expose `pciMode` flag based on token claims:

```javascript
getConfig(req, res) {
  const pciMode = req.agent?.pciMode || false;
  res.json({
    widgetUrl: config.publicUrl,
    apiBaseUrl: config.publicUrl,
    features: config.features,
    pciMode, // <-- expose to frontend
  });
}
```

**File:** `src/public/widget.html` (and future React frontend)

When `pciMode === true`:
- Disable the message input field
- Hide the Send button
- Show a banner: "Input disabled — PCI compliance mode active"

```javascript
if (widgetConfig.pciMode) {
  document.getElementById('message-input').disabled = true;
  document.getElementById('send-btn').style.display = 'none';
  showBanner('Input disabled — PCI compliance mode');
}
```

---

### T2.4 — Tenant Identity Validation

**New file:** `src/middleware/requireTenant.js`

```javascript
module.exports = function requireTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: { message: 'X-Tenant-ID header is required', code: 'TENANT_REQUIRED' } });
  }
  req.tenantId = tenantId;
  next();
};
```

Apply to all `/api/v1/widget/*` routes.

---

### T2.5 — Conversation Access Authorization

**File:** `src/services/widget.service.js`, `src/middleware/authenticate.js`

After token validation, verify the agent has access to the requested conversation. This can be done either:

1. **Simple:** Check `req.agent.tenantId === req.tenantId` (conversation belongs to same tenant as agent)
2. **Strict:** Call agent-portal-service or state-manager to confirm agent is assigned to conversation

For MVP: implement option 1 (tenant match check).

```javascript
// In authenticate middleware or a separate authorizeConversation middleware:
if (req.agent && req.agent.tenantId && req.tenantId) {
  if (req.agent.tenantId !== req.tenantId) {
    return res.status(403).json({ error: { message: 'Access denied', code: 'FORBIDDEN' } });
  }
}
```

---

## Acceptance Criteria

- [ ] Requests without `Authorization` header return 401
- [ ] Requests with invalid token return 401 (when auth-service available)
- [ ] Requests without `X-Tenant-ID` return 400
- [ ] `GET /api/v1/widget/config` returns `pciMode: true/false`
- [ ] When `pciMode` is true, frontend disables the input
- [ ] In development mode, auth failures are non-blocking (auth service may be down)
