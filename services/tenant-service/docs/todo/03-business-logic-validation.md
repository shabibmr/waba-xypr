# Phase 3 — Business Logic & Validation ✅

> **Depends on**: Phase 1, Phase 2
> **Estimated Effort**: ~10–14 hours
> **Reference**: [Gap Analysis](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/docs/gap-analysis.md) — Gaps #17, #18, #19, Cross-cutting

---

## 3.1 Input Validation Middleware 🟡 P1

> **New file**: `src/middleware/validation.js`
> **Affected**: All controllers

### Problem
All validation is ad-hoc `if (!field)` checks in controllers. No schema-based validation, no type checking, no length constraints.

### Steps

- [ ] **3.1.1** Install Joi: `npm install joi`
- [ ] **3.1.2** Create `src/middleware/validation.js`:
  ```js
  const Joi = require('joi');
  
  function validate(schema, source = 'body') {
    return (req, res, next) => {
      const { error, value } = schema.validate(req[source], { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: error.details.map(d => d.message).join(', '),
          code: 'VALIDATION_ERROR'
        });
      }
      req[source] = value;
      next();
    };
  }
  module.exports = { validate };
  ```
- [ ] **3.1.3** Create `src/schemas/tenant.schema.js`:
  ```js
  const Joi = require('joi');
  
  const createTenant = Joi.object({
    name: Joi.string().max(255).required(),
    email: Joi.string().email().max(255).required(),
    domain: Joi.string().max(255).optional(),
    settings: Joi.object({
      timezone: Joi.string().optional(),
      language: Joi.string().max(10).optional()
    }).optional()
  });
  
  const updateTenant = Joi.object({
    name: Joi.string().max(255),
    email: Joi.string().email().max(255),
    domain: Joi.string().max(255),
    subdomain: Joi.string().max(100),
    plan: Joi.string().valid('standard', 'premium', 'enterprise'),
    status: Joi.string().valid('active', 'suspended', 'deleted'),
    settings: Joi.object().optional()
  }).min(1);
  ```
- [ ] **3.1.4** Create `src/schemas/whatsapp.schema.js`:
  ```js
  const createWhatsAppConfig = Joi.object({
    wabaId: Joi.string().required(),
    phoneNumberId: Joi.string().required(),
    accessToken: Joi.string().required(),
    businessAccountId: Joi.string().optional(),
    verifyToken: Joi.string().optional()
  });
  
  const signupCallback = Joi.object({
    code: Joi.string().required(),
    state: Joi.string().required()
  });
  ```
- [ ] **3.1.5** Create `src/schemas/credential.schema.js`:
  ```js
  const storeCredentials = Joi.object({
    type: Joi.string().valid('genesys', 'whatsapp').required(),
    credentials: Joi.object().required()
  });
  ```
- [ ] **3.1.6** Apply middleware to routes:
  ```js
  // In tenantRoutes.js
  const { validate } = require('../middleware/validation');
  const schemas = require('../schemas/tenant.schema');
  
  router.post('/', validate(schemas.createTenant), tenantController.createTenant);
  router.patch('/:tenantId', validate(schemas.updateTenant), tenantController.updateTenant);
  ```
- [ ] **3.1.7** Remove ad-hoc `if (!field)` checks from controllers (now handled by middleware)

### Acceptance Criteria
- Invalid requests return `400` with `VALIDATION_ERROR` code and specific field errors
- Valid requests pass through to controller

---

## 3.2 Enforce Tenant Status Enum 🟡 P1

> **Files**: [tenantService.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/tenantService.js), Schema definition

### Problem
Spec defines `active | suspended | deleted`. No validation exists. Any string can be set as status.

### Steps

- [ ] **3.2.1** Add CHECK constraint to DB:
  ```sql
  ALTER TABLE tenants
    DROP CONSTRAINT IF EXISTS tenants_status_check,
    ADD CONSTRAINT tenants_status_check
    CHECK (status IN ('active', 'suspended', 'deleted'));
  ```
- [ ] **3.2.2** Already covered by Joi schema in 3.1.4 (`Joi.string().valid(...)`) — verify it's applied on the update route
- [ ] **3.2.3** Ensure `createTenant()` defaults to `'active'` (currently uses DB default ✅)
- [ ] **3.2.4** Ensure `deleteTenant()` could optionally soft-delete by setting status to `'deleted'` instead of hard delete (future consideration)

---

## 3.3 Startup Environment Validation 🟡 P1

> **File**: [server.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/server.js)

### Problem
Service starts without checking if required env vars exist. Missing `DB_HOST` or `REDIS_URL` only surfaces as a cryptic runtime error later.

### Steps

- [ ] **3.3.1** Create `src/config/env.js`:
  ```js
  const REQUIRED_VARS = ['DB_HOST', 'DB_NAME', 'DB_USER', 'REDIS_URL'];
  const OPTIONAL_VARS = ['META_APP_ID', 'META_APP_SECRET', 'PORT', 'DB_PASSWORD'];
  
  function validateEnv() {
    const missing = REQUIRED_VARS.filter(v => !process.env[v]);
    if (missing.length > 0) {
      console.error(`Missing required env vars: ${missing.join(', ')}`);
      process.exit(1);
    }
    
    // Warn about optional vars that affect features
    if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
      console.warn('META_APP_ID/META_APP_SECRET not set — WhatsApp signup flow disabled');
    }
  }
  module.exports = { validateEnv };
  ```
- [ ] **3.3.2** Call `validateEnv()` at the top of `startServer()` in `server.js`, before DB/Redis connect
- [ ] **3.3.3** Update `.env.example` to document all vars

---

## 3.4 WhatsApp Signup End-to-End Persistence 🔴 P0

> **File**: [whatsappController.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/controllers/whatsappController.js)

### Context
This extends task 2.9. After the signup flow saves WhatsApp config, we need to ensure all side-effects are handled.

### Steps

- [ ] **3.4.1** After saving WhatsApp config, update `tenants.whatsapp_configured = true`:
  ```js
  await pool.query(
    'UPDATE tenants SET whatsapp_configured = true WHERE tenant_id = $1',
    [tenantId]
  );
  ```
- [ ] **3.4.2** Denormalize `phone_number_id` to `tenants` table:
  ```js
  await pool.query(
    'UPDATE tenants SET phone_number_id = $1 WHERE tenant_id = $2',
    [phoneData.id, tenantId]
  );
  ```
- [ ] **3.4.3** Invalidate cache entries:
  ```js
  await redisClient.del(KEYS.tenant(tenantId));
  await redisClient.del(KEYS.whatsappConfig(tenantId));
  ```
- [ ] **3.4.4** Wrap the entire flow in a try/catch with specific error messages for each Meta API call
- [ ] **3.4.5** Add a safeguard: verify the tenant exists before attempting the signup flow
- [ ] **3.4.6** Handle edge case: if tenant already has WhatsApp configured, update instead of fail

### Acceptance Criteria
- After signup callback: tenant's `whatsapp_configured = true`, `phone_number_id` populated
- WhatsApp config stored in `tenant_whatsapp_config`
- Cache invalidated
- `GET /tenants/:id` reflects `whatsappConfigured: true`

---

## 3.5 Structured Logging 🟢 P2

> **New file**: `src/config/logger.js`
> **Affected**: All files using `console.log`/`console.error`

### Steps

- [ ] **3.5.1** Install pino: `npm install pino`
- [ ] **3.5.2** Create `src/config/logger.js`:
  ```js
  const pino = require('pino');
  const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined
  });
  module.exports = logger;
  ```
- [ ] **3.5.3** Replace `console.log` → `logger.info()`, `console.error` → `logger.error()` across all files
- [ ] **3.5.4** Add request ID to logs using `express-pino-logger` or manual middleware
- [ ] **3.5.5** Log key events: tenant created, credentials stored, WhatsApp config updated, signup completed

---

## 3.6 Graceful Shutdown 🟢 P2

> **File**: [server.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/server.js)

### Steps

- [ ] **3.6.1** Add shutdown handler:
  ```js
  async function gracefulShutdown(signal) {
    console.log(`Received ${signal}, shutting down...`);
    
    // Stop accepting new requests
    server.close(() => {
      console.log('HTTP server closed');
    });
    
    // Close Redis
    try {
      await redisClient.quit();
      console.log('Redis disconnected');
    } catch (err) { }
    
    // Close DB pool
    try {
      await pool.end();
      console.log('Database pool closed');
    } catch (err) { }
    
    process.exit(0);
  }
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  ```
- [ ] **3.6.2** Store the server reference: `const server = app.listen(...)`
- [ ] **3.6.3** Add health check liveness probe that returns `503` during shutdown
