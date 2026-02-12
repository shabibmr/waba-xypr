# Phase 5 (Deferred) — Security & Authentication 🔒

> **Status**: Deferred to post-MVP
> **Estimated Effort**: ~12–16 hours
> **Reference**: [Gap Analysis](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/docs/gap-analysis.md) — Gap #12, Cross-cutting

---

## D.1 JWT Authentication Middleware 🔴

> **New file**: `src/middleware/auth.js`

### Context
OpenAPI spec declares `BearerAuth` (JWT) on all tenant/WhatsApp/credential endpoints. Currently all endpoints are completely open.

### Steps

- [ ] **D.1.1** Choose JWT library: `npm install jsonwebtoken` (or use existing project standard)
- [ ] **D.1.2** Create `src/middleware/auth.js`:
  ```js
  const jwt = require('jsonwebtoken');
  
  function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid token', code: 'UNAUTHORIZED' });
    }
    
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      req.tenantId = decoded.tenantId; // if multi-tenant scoped
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token', code: 'TOKEN_INVALID' });
    }
  }
  module.exports = { authenticate };
  ```
- [ ] **D.1.3** Add `JWT_SECRET` to `.env.example`
- [ ] **D.1.4** Consider tenant-scoping: validate that the JWT's `tenantId` matches the `:tenantId` in the request path

---

## D.2 Apply Auth to Routes 🔴

> **File**: [routes/index.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/routes/index.js) and individual route files

### Steps

- [ ] **D.2.1** Import auth middleware in route files:
  ```js
  const { authenticate } = require('../middleware/auth');
  ```
- [ ] **D.2.2** Apply to all protected routes:
  ```js
  router.post('/', authenticate, tenantController.createTenant);
  router.get('/', authenticate, tenantController.getAllTenants);
  router.get('/:tenantId', authenticate, tenantController.getTenantById);
  // ... all tenant, whatsapp, credential routes
  ```
- [ ] **D.2.3** **Exclude** from auth:
  - `GET /health` — always public
  - `POST /api/whatsapp/signup` — callback from Meta (no JWT)
- [ ] **D.2.4** Consider admin-only routes (e.g., `GET /tenants` list all, `DELETE /tenants/:id`) with role-based checks
- [ ] **D.2.5** Update all tests to include Bearer token in requests

---

## D.3 CORS Middleware 🟡

> **File**: [app.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/app.js)

### Steps

- [ ] **D.3.1** Install cors: `npm install cors`
- [ ] **D.3.2** Configure in `app.js`:
  ```js
  const cors = require('cors');
  
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));
  ```
- [ ] **D.3.3** Add `ALLOWED_ORIGINS` to `.env.example`

---

## D.4 Rate Limiting 🟢

> **New file**: `src/middleware/rateLimit.js`

### Context
The `tenants` table has a `rate_limit` column (default: 100) but no middleware uses it.

### Steps

- [ ] **D.4.1** Install rate limiter: `npm install express-rate-limit`
- [ ] **D.4.2** Create `src/middleware/rateLimit.js`:
  ```js
  const rateLimit = require('express-rate-limit');
  
  // Global rate limit (fallback)
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: { error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' }
  });
  
  // Per-tenant rate limit (uses tenant's rate_limit value)
  function tenantRateLimiter(req, res, next) {
    // Uses req.tenantId set by auth middleware
    // Look up tenant's rate_limit from cache
    // Apply dynamic limit
    next();
  }
  ```
- [ ] **D.4.3** Apply global limiter to all routes
- [ ] **D.4.4** Integrate with Redis for distributed rate limiting (if running multiple instances)

---

## D.5 OpenAPI Runtime Validation 🟢

> **File**: [app.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/app.js)

### Steps

- [ ] **D.5.1** Install: `npm install express-openapi-validator`
- [ ] **D.5.2** Configure in `app.js`:
  ```js
  const OpenApiValidator = require('express-openapi-validator');
  
  app.use(OpenApiValidator.middleware({
    apiSpec: path.join(__dirname, '../docs/openapi.yaml'),
    validateRequests: true,
    validateResponses: process.env.NODE_ENV !== 'production'
  }));
  ```
- [ ] **D.5.3** Add error handler for OpenAPI validation errors:
  ```js
  app.use((err, req, res, next) => {
    if (err.status === 400) {
      return res.status(400).json({
        error: err.message,
        code: 'OPENAPI_VALIDATION_ERROR'
      });
    }
    next(err);
  });
  ```
- [ ] **D.5.4** Ensure the OpenAPI spec (task 2.12) is complete and accurate before enabling this
