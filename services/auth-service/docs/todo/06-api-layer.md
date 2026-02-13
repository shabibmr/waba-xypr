# Phase 06 — API Layer (Routes, Controllers, Middleware)

**Depends on:** 01 (foundation), 04 (token services), 05 (JWT validation)
**Blocks:** 07-observability, 08-testing
**MVP Critical:** YES

---

## Gap Analysis

### Current State

| Issue | Details |
|-------|---------|
| Base path wrong | Current: `/auth/...` — FRD: `/api/v1/...` |
| Token endpoint method wrong | Current: `GET /auth/token` — FRD: `POST /api/v1/token` |
| JWT validation wrong | Current: `POST /auth/validate` calls Genesys users/me — FRD: JWKS-based |
| Health check path wrong | Current: `GET /health` — FRD: `GET /api/v1/health` |
| No input validation | No Joi schemas; arbitrary headers/body accepted |
| No service-to-service auth | No Bearer token validation on routes |
| No error handling middleware | Errors are caught inline with `res.status(500).json({ error })` |
| No correlation ID propagation | No `X-Correlation-ID` header handling |
| No layering | Routes and business logic are in the same file |

### FRD Requirements (Section 4.1)
- `POST /api/v1/token` — body: `{ tenantId, type, forceRefresh?, correlationId? }`
- `POST /api/v1/validate/jwt` — body: `{ token, region }`
- `GET /api/v1/health` — returns dependency status
- Service-to-service auth middleware on `/api/v1` routes
- Joi validation middleware for each endpoint
- Centralized error handling middleware
- Correlation ID middleware (generate if not provided)

---

## Tasks

### TASK-06-01: Implement service-to-service auth middleware
**Priority:** MVP
**File:** `src/api/middleware/auth.middleware.js`

**Description:** Validate `Authorization: Bearer <token>` header on all `/api/v1` routes. Token is a shared secret configured via `INTERNAL_SERVICE_SECRET`. See FRD Section 7.3.

```javascript
// src/api/middleware/auth.middleware.js
const logger = require('../../utils/logger');
const config = require('../../config');
const { ErrorCode } = require('../../models/errors');

/**
 * Internal service authentication middleware.
 * Validates Authorization: Bearer <INTERNAL_SERVICE_SECRET>
 *
 * Skip in test environment if SKIP_AUTH=true.
 */
function internalServiceAuth(req, res, next) {
  // Allow health check without auth
  if (req.path === '/health') return next();

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: ErrorCode.INVALID_REQUEST,
        message: 'Missing or invalid Authorization header',
      },
    });
  }

  const token = authHeader.substring(7);

  // Simple shared-secret comparison (timing-safe)
  const expected = config.internalAuth.secret;
  if (token.length !== expected.length || !timingSafeEqual(token, expected)) {
    logger.warn('Invalid internal service token', {
      correlationId: req.correlationId,
      path: req.path,
    });

    return res.status(401).json({
      error: {
        code: ErrorCode.INVALID_REQUEST,
        message: 'Invalid service token',
      },
    });
  }

  next();
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  const { timingSafeEqual: cryptoEqual } = require('crypto');
  return cryptoEqual(Buffer.from(a), Buffer.from(b));
}

module.exports = { internalServiceAuth };
```

**Note:** For MVP, shared-secret Bearer is sufficient. Post-MVP, consider upgrading to signed JWTs per FRD Section 7.3.

**Acceptance:** Request without `Authorization` header → 401. Correct token → passes through. Wrong token → 401. Timing attack not viable (constant-time comparison).

---

### TASK-06-02: Implement correlation ID middleware
**Priority:** MVP
**File:** `src/api/middleware/correlation.middleware.js`

**Description:** Extract or generate a correlation ID for every request. Attach to `req.correlationId` and echo back in the response `X-Correlation-ID` header.

```javascript
// src/api/middleware/correlation.middleware.js
const { randomUUID } = require('crypto');

function correlationMiddleware(req, res, next) {
  req.correlationId = req.headers['x-correlation-id'] || randomUUID();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}

module.exports = { correlationMiddleware };
```

**Acceptance:** Response always has `X-Correlation-ID` header. If `X-Correlation-ID` is in the request, the same value is echoed back.

---

### TASK-06-03: Implement Joi validation middleware
**Priority:** MVP
**Files:**
- `src/api/validators/token.validator.js`
- `src/api/validators/jwt.validator.js`
- `src/api/middleware/validation.middleware.js`

**Description:** Validate request bodies against Joi schemas. Return `400 INVALID_REQUEST` with a descriptive message on validation failure. See FRD Section 7.4.

```javascript
// src/api/validators/token.validator.js
const Joi = require('joi');

const tokenRequestSchema = Joi.object({
  tenantId:      Joi.string().required().min(1).max(100),
  type:          Joi.string().valid('genesys', 'whatsapp').required(),
  forceRefresh:  Joi.boolean().optional().default(false),
  correlationId: Joi.string().max(100).optional(),
});

module.exports = { tokenRequestSchema };
```

```javascript
// src/api/validators/jwt.validator.js
const Joi = require('joi');

const VALID_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-2', 'ca-central-1',
  'eu-west-1', 'eu-west-2', 'eu-central-1',
  'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2', 'ap-south-1',
];

const jwtValidationRequestSchema = Joi.object({
  token:  Joi.string().required().min(1),
  region: Joi.string().valid(...VALID_REGIONS).required(),
});

module.exports = { jwtValidationRequestSchema };
```

```javascript
// src/api/middleware/validation.middleware.js
const { ErrorCode } = require('../../models/errors');

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        error: {
          code: ErrorCode.INVALID_REQUEST,
          message: `Validation failed: ${error.details.map(d => d.message).join('; ')}`,
        },
      });
    }

    req.body = value;  // Replace with coerced/defaulted values
    next();
  };
}

module.exports = { validateBody };
```

**Acceptance:** `POST /api/v1/token` with no body → 400 with `INVALID_REQUEST`. With `{ tenantId: 'abc', type: 'genesys' }` → passes validation. `type: 'unknown'` → 400.

---

### TASK-06-04: Implement token controller
**Priority:** MVP
**File:** `src/api/controllers/token.controller.js`

**Description:** Handle `POST /api/v1/token`. Delegate to `TokenService.getToken()`. Map service errors to HTTP responses.

```javascript
// src/api/controllers/token.controller.js
const logger = require('../../utils/logger');

class TokenController {
  constructor(tokenService) {
    this.tokenService = tokenService;
  }

  async getToken(req, res, next) {
    const { tenantId, type, forceRefresh, correlationId: bodyCorrelationId } = req.body;
    const correlationId = req.correlationId || bodyCorrelationId;

    try {
      const result = await this.tokenService.getToken({
        tenantId,
        type,
        forceRefresh,
        correlationId,
      });

      return res.status(200).json({
        accessToken: result.accessToken,
        expiresIn:   result.expiresIn,
        tokenType:   result.tokenType,
        source:      result.source,
        expiresAt:   result.expiresAt,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = { TokenController };
```

---

### TASK-06-05: Implement JWT controller
**Priority:** MVP
**File:** `src/api/controllers/jwt.controller.js`

**Description:** Handle `POST /api/v1/validate/jwt`. Delegate to `JWTValidatorService.validate()`.

```javascript
// src/api/controllers/jwt.controller.js
const logger = require('../../utils/logger');

class JWTController {
  constructor(jwtValidatorService) {
    this.jwtValidatorService = jwtValidatorService;
  }

  async validateJWT(req, res, next) {
    const { token, region } = req.body;
    const correlationId = req.correlationId;

    try {
      const result = await this.jwtValidatorService.validate(token, region);

      // Always 200 — isValid field communicates validity
      // (503 is only thrown if JWKS endpoint unreachable)
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = { JWTController };
```

---

### TASK-06-06: Implement health controller
**Priority:** MVP
**File:** `src/api/controllers/health.controller.js`

**Description:** `GET /api/v1/health` checks Redis connectivity and Tenant Service reachability. Returns 200 if healthy, 503 if any critical dependency is down. See FRD Section 4.1.3.

```javascript
// src/api/controllers/health.controller.js
const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

class HealthController {
  constructor(redisClient, redisHealthMonitor) {
    this.redis = redisClient;
    this.healthMonitor = redisHealthMonitor;
  }

  async getHealth(req, res) {
    const checks = await Promise.allSettled([
      this._checkRedis(),
      this._checkTenantService(),
    ]);

    const redisStatus    = checks[0].status === 'fulfilled' ? checks[0].value : { status: 'unhealthy', error: checks[0].reason?.message };
    const tenantStatus   = checks[1].status === 'fulfilled' ? checks[1].value : { status: 'unhealthy', error: checks[1].reason?.message };

    const isHealthy = redisStatus.status === 'healthy' && tenantStatus.status === 'healthy';

    const body = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      dependencies: {
        redis: redisStatus,
        tenantService: tenantStatus,
      },
    };

    // 200 even in degraded mode (Redis can be down and service still partially works)
    return res.status(200).json(body);
  }

  async _checkRedis() {
    const start = Date.now();
    try {
      await this.redis.ping();
      return { status: 'healthy', latency: Date.now() - start };
    } catch (err) {
      return { status: 'unhealthy', error: err.message, latency: Date.now() - start };
    }
  }

  async _checkTenantService() {
    const start = Date.now();
    try {
      await axios.get(`${config.tenantService.url}/health`, {
        timeout: 2000,
      });
      return { status: 'healthy', latency: Date.now() - start };
    } catch (err) {
      return { status: 'unhealthy', error: err.message, latency: Date.now() - start };
    }
  }
}

module.exports = { HealthController };
```

---

### TASK-06-07: Implement routes
**Priority:** MVP
**Files:**
- `src/api/routes/token.routes.js`
- `src/api/routes/jwt.routes.js`
- `src/api/routes/health.routes.js`
- `src/api/routes/index.js`

```javascript
// src/api/routes/token.routes.js
const { Router } = require('express');
const { validateBody } = require('../middleware/validation.middleware');
const { tokenRequestSchema } = require('../validators/token.validator');

function createTokenRouter(tokenController) {
  const router = Router();
  router.post('/', validateBody(tokenRequestSchema), (req, res, next) =>
    tokenController.getToken(req, res, next)
  );
  return router;
}

module.exports = { createTokenRouter };
```

```javascript
// src/api/routes/jwt.routes.js
const { Router } = require('express');
const { validateBody } = require('../middleware/validation.middleware');
const { jwtValidationRequestSchema } = require('../validators/jwt.validator');

function createJWTRouter(jwtController) {
  const router = Router();
  router.post('/', validateBody(jwtValidationRequestSchema), (req, res, next) =>
    jwtController.validateJWT(req, res, next)
  );
  return router;
}

module.exports = { createJWTRouter };
```

```javascript
// src/api/routes/index.js
const { Router } = require('express');
const { internalServiceAuth } = require('../middleware/auth.middleware');
const { createTokenRouter } = require('./token.routes');
const { createJWTRouter } = require('./jwt.routes');

function createRouter({ tokenController, jwtController, healthController }) {
  const router = Router();

  // Health check — no auth required
  router.get('/health', (req, res) => healthController.getHealth(req, res));

  // All other routes require internal service auth
  router.use(internalServiceAuth);

  router.use('/token', createTokenRouter(tokenController));
  router.use('/validate/jwt', createJWTRouter(jwtController));

  return router;
}

module.exports = { createRouter };
```

---

### TASK-06-08: Implement error handling middleware
**Priority:** MVP
**File:** `src/api/middleware/error.middleware.js`

**Description:** Centralized error handler. Maps `AuthServiceError` subclasses to appropriate HTTP status codes and structured JSON responses. See FRD Section 4.1.1 error table.

```javascript
// src/api/middleware/error.middleware.js
const logger = require('../../utils/logger');
const { AuthServiceError } = require('../../models/errors');

function errorMiddleware(err, req, res, next) {
  const correlationId = req.correlationId;

  if (err instanceof AuthServiceError) {
    // Known, expected error — log at appropriate level
    const logFn = err.statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);

    logFn('Request failed with AuthServiceError', {
      code: err.code,
      statusCode: err.statusCode,
      tenantId: err.tenantId,
      correlationId,
      message: err.message,
    });

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        tenantId: err.tenantId,
        correlationId,
      },
    });
  }

  // Unknown error — log at error level
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    correlationId,
    path: req.path,
    method: req.method,
  });

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      correlationId,
    },
  });
}

module.exports = { errorMiddleware };
```

---

### TASK-06-09: Rewrite app.js and server.js
**Priority:** MVP
**Files:** `src/app.js`, `src/server.js`

**Description:** Replace the monolithic `src/index.js` with a proper `app.js` (Express setup) and `server.js` (startup). Keep `index.js` as a thin entry point that calls `server.js`.

```javascript
// src/app.js
const express = require('express');
const { correlationMiddleware } = require('./api/middleware/correlation.middleware');
const { errorMiddleware } = require('./api/middleware/error.middleware');
const { createRouter } = require('./api/routes');

function createApp({ tokenController, jwtController, healthController }) {
  const app = express();

  app.use(express.json());
  app.use(correlationMiddleware);

  app.use('/api/v1', createRouter({ tokenController, jwtController, healthController }));

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.path} not found` } });
  });

  app.use(errorMiddleware);

  return app;
}

module.exports = { createApp };
```

```javascript
// src/server.js
const { createServices } = require('./services/factory');
const { TokenController } = require('./api/controllers/token.controller');
const { JWTController } = require('./api/controllers/jwt.controller');
const { HealthController } = require('./api/controllers/health.controller');
const { createApp } = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

async function start() {
  const services = await createServices();

  const tokenController = new TokenController(services.tokenService);
  const jwtController   = new JWTController(services.jwtValidatorService);
  const healthController = new HealthController(services.redis, services.healthMonitor);

  const app = createApp({ tokenController, jwtController, healthController });

  const server = app.listen(config.port, () => {
    logger.info('Auth service started', { port: config.port, env: config.nodeEnv });
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received — shutting down');
    server.close(async () => {
      services.healthMonitor.stop();
      await services.redis.quit();
      process.exit(0);
    });
  });

  return server;
}

module.exports = { start };
```

```javascript
// src/index.js (thin entry point — keep for backward compat)
require('./server').start().catch(err => {
  console.error('Failed to start auth service:', err);
  process.exit(1);
});
```

**Acceptance:**
- `npm start` starts the service on port 3004
- `POST /api/v1/token` with valid body returns 200 or appropriate error
- `POST /api/v1/validate/jwt` returns 200 with `isValid` field
- `GET /api/v1/health` returns 200 with dependency status
- `GET /old/auth/token` returns 404 (old routes are gone)
- `SIGTERM` causes graceful shutdown (Redis connection closed, in-flight requests completed)

---

### TASK-06-10: Remove or redirect old route paths
**Priority:** MVP
**Description:** The following routes exist in the current `src/index.js` and must be retired:

| Old Route | Action | Reason |
|-----------|--------|--------|
| `GET /auth/token` | Remove | Replaced by `POST /api/v1/token` |
| `POST /auth/refresh` | Remove | Covered by `forceRefresh: true` in `POST /api/v1/token` |
| `GET /auth/info` | Remove | Debug endpoint, not in FRD |
| `POST /auth/validate` | Remove | Replaced by `POST /api/v1/validate/jwt` |
| `GET /auth/genesys/authorize` | Move/Remove | Belongs in agent-portal-service, not auth-service |
| `GET /auth/genesys/callback` | Move/Remove | Same — portal OAuth flow belongs in portal service |
| `GET /health` | Remove or redirect | Replaced by `GET /api/v1/health` |

**Note on authorize/callback:** Check whether any other service currently calls these endpoints. If `agent-portal-service` depends on them, coordinate migration to agent-portal-service before removing from auth-service. Consider adding temporary 301 redirect during transition.
