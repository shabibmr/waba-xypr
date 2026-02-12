# Task 09 — Security: Tenant Isolation, CORS, PCI, Rate Limiting

**Priority:** MEDIUM (HIGH for production)
**Depends on:** 01_foundation (CORS fix), 02_auth (PCI mode)
**Blocks:** Nothing

---

## Gap Summary

| FRD Requirement | Current State | Status |
|----------------|---------------|--------|
| Tenant isolation enforced on every API + WebSocket call | Header passed but not validated | ❌ Partial |
| Token validated per call | No validation | ❌ Missing |
| CORS: allow `mypurecloud.com` | localhost only | ❌ Missing (started in 01) |
| PCI mode: disable input if flag set | No PCI handling | ❌ Missing |
| WebSocket auth handshake `{ token }` | No WebSocket | ❌ Missing (in 03) |
| Rate limiting (per tenant) | None | ❌ Missing |
| Helmet HTTP security headers | None | ❌ Missing |
| Input sanitization (XSS prevention) | None | ❌ Missing |

---

## Tasks

### T9.1 — HTTP Security Headers (Helmet)

```bash
npm install helmet
```

**File:** `src/server.js`

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.socket.io'], // allow Socket.IO CDN if used
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      mediaSrc: ["'self'", 'https:'],
      connectSrc: ["'self'", 'wss:', 'https:'],
      frameSrc: ["'none'"], // widget itself should not be framed except by Genesys
    },
  },
  frameguard: false, // Disable X-Frame-Options — widget IS embedded in iframe
  crossOriginEmbedderPolicy: false, // Required for iframe embedding
}));
```

> Note: `frameguard` and `crossOriginEmbedderPolicy` must be disabled because the widget is intentionally embedded in a Genesys Cloud iframe.

---

### T9.2 — Rate Limiting Per Tenant

```bash
npm install express-rate-limit
```

**New file:** `src/middleware/rateLimiter.js`

```javascript
const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests', code: 'RATE_LIMITED' } },
  keyGenerator: (req) => {
    // Rate limit by tenant if available, else by IP
    return req.headers['x-tenant-id'] || req.ip;
  },
});

// Stricter limiter for send endpoint
const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 messages per minute per tenant
  message: { error: { message: 'Message rate limit exceeded', code: 'SEND_RATE_LIMITED' } },
  keyGenerator: (req) => req.headers['x-tenant-id'] || req.ip,
});

module.exports = { apiLimiter, sendLimiter };
```

**Apply in routes:**
```javascript
const { apiLimiter, sendLimiter } = require('../middleware/rateLimiter');

router.use(apiLimiter);
router.post('/send', sendLimiter, widgetController.sendMessage);
router.post('/upload', sendLimiter, upload.single('file'), widgetController.uploadMedia);
```

---

### T9.3 — Input Sanitization

```bash
npm install dompurify jsdom
```

**New file:** `src/utils/sanitize.js`

```javascript
const { JSDOM } = require('jsdom');
const DOMPurify = require('dompurify');

const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Sanitize user-supplied text to prevent XSS.
 * Strips all HTML tags.
 */
function sanitizeText(input) {
  if (typeof input !== 'string') return input;
  return purify.sanitize(input, { ALLOWED_TAGS: [] });
}

module.exports = { sanitizeText };
```

**Apply in sendMessage controller:**
```javascript
const { sanitizeText } = require('../utils/sanitize');

// In sendMessage:
const text = sanitizeText(req.body.text);
```

---

### T9.4 — Tenant Isolation: Conversation Ownership Check

**File:** `src/services/widget.service.js`

When fetching a conversation, verify the `tenantId` in the mapping matches the requesting tenant:

```javascript
async resolveContext(conversationId, tenantId) {
  const mapping = await this._callService('state-manager', () =>
    this.axiosClient.get(`/state/conversation/${conversationId}`, {
      headers: { 'X-Tenant-ID': tenantId }
    })
  );

  if (!mapping.data) throw new Error('InvalidConversation');

  // Enforce tenant isolation
  const mappingTenantId = mapping.data.tenantId;
  if (mappingTenantId && mappingTenantId !== tenantId) {
    const err = new Error('Access denied: conversation belongs to a different tenant');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  return { valid: true, tenantId, wa_id: mapping.data.waId };
}
```

---

### T9.5 — WebSocket Tenant Isolation

**File:** `src/sockets/widgetSocket.js` (from T3.3)

Validate tenant on connection and ensure agents can only join rooms for their tenant:

```javascript
io.use(async (socket, next) => {
  const { tenantId, conversationId } = socket.handshake.query;
  const token = socket.handshake.auth?.token;

  if (!token) return next(new Error('Authentication required'));
  if (!tenantId || !conversationId) return next(new Error('Missing tenantId or conversationId'));

  const agent = await validateToken(token);
  if (!agent) return next(new Error('Invalid token'));

  // Enforce tenant isolation: agent's token tenant must match requested tenant
  if (agent.tenantId && agent.tenantId !== tenantId) {
    return next(new Error('Tenant mismatch'));
  }

  socket.agent = agent;
  next();
});
```

---

### T9.6 — Internal Emit Endpoint Protection

**File:** `src/routes/internal.routes.js` (from T3.4)

Add internal API key check to prevent unauthorized external access:

```javascript
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

router.use((req, res, next) => {
  const key = req.headers['x-internal-api-key'];
  if (!INTERNAL_API_KEY || key !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: { message: 'Unauthorized internal request', code: 'UNAUTHORIZED' } });
  }
  next();
});
```

Add `INTERNAL_API_KEY` to `.env` and config.

---

### T9.7 — CORS Complete Fix

**File:** `src/server.js`

Full CORS configuration (extends T1.5 from foundation):

```javascript
const ALLOWED_ORIGINS = [
  ...(process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
  // Genesys Cloud regional domains
  /^https:\/\/(apps|login|api)\.(mypurecloud\.com|mypurecloud\.de|mypurecloud\.jp|mypurecloud\.ie|usw2\.pure\.cloud|cac1\.pure\.cloud|euw2\.pure\.cloud|apse2\.pure\.cloud)$/,
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = ALLOWED_ORIGINS.some(o => typeof o === 'string' ? o === origin : o.test(origin));
    cb(allowed ? null : new Error('Not allowed by CORS'), allowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Internal-API-Key'],
}));
```

---

## Acceptance Criteria

- [ ] Helmet adds security headers to all responses
- [ ] `X-Frame-Options` is NOT set (to allow Genesys iframe embedding)
- [ ] API rate limit returns 429 with `RATE_LIMITED` error code after 100 req/min
- [ ] Send endpoint rate limit returns 429 with `SEND_RATE_LIMITED` after 30 msg/min
- [ ] Text input is sanitized (HTML stripped) before forwarding to downstream services
- [ ] Conversation fetch returns 403 if conversation belongs to different tenant
- [ ] WebSocket rejects connections with mismatched tenant
- [ ] Internal emit endpoint returns 401 without correct `X-Internal-API-Key`
- [ ] CORS allows `*.mypurecloud.com` origins
