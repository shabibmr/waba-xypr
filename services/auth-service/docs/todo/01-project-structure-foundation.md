# Phase 01 — Project Structure & Foundation

**Depends on:** Nothing
**Blocks:** All other phases
**MVP Critical:** YES

---

## Gap Analysis

### Current State
- All code is in a single `src/index.js` (~300 lines)
- No separation of concerns: routes, business logic, data access, and config are all inline
- No custom error classes — uses plain `res.status(500).json({ error: 'message' })`
- No structured logging — uses `console.log` / `console.error`
- No config validation on startup — missing env vars fail silently mid-request
- No correlation ID propagation
- Dependencies: only `express`, `axios`, `redis`, `dotenv` — missing `joi`, `winston`/`pino`, `jsonwebtoken`, `jwks-rsa`

### FRD Requirement
```
src/
├── api/
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   └── validators/
├── services/
│   ├── token/
│   ├── oauth/
│   ├── jwt/
│   ├── credentials/
│   └── health/
├── repositories/
├── models/
├── config/
├── utils/
├── app.ts
└── server.ts
```

---

## Tasks

### TASK-01-01: Establish directory structure
**Priority:** MVP
**Description:** Create the folder layout under `src/` to match the FRD recommended structure.
No code needs to move yet — just create the directories and empty index files.

```
src/
├── api/
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   └── validators/
├── services/
│   ├── token/
│   ├── oauth/
│   ├── jwt/
│   ├── credentials/
│   └── health/
├── repositories/
├── models/
├── config/
└── utils/
```

**Acceptance:** `ls -R src/` shows the above structure.

---

### TASK-01-02: Add missing npm dependencies
**Priority:** MVP
**Description:** Install packages required by FRD that are not yet in `package.json`.

**Add to `dependencies`:**
```json
{
  "joi": "^17.x",
  "winston": "^3.x",
  "jsonwebtoken": "^9.x",
  "jwks-rsa": "^3.x",
  "uuid": "^9.x"
}
```

**Add to `devDependencies`:**
```json
{
  "nock": "^13.x"
}
```

**Note:** FRD recommends TypeScript but current codebase is JS. Defer TypeScript migration to post-MVP. If migrating, add `typescript`, `ts-node`, `@types/*`.

**Acceptance:** `npm install` completes without error; `node -e "require('joi')"` succeeds.

---

### TASK-01-03: Implement custom error classes
**Priority:** MVP
**File:** `src/models/errors.js`

**Description:** Create error hierarchy matching FRD Section 3.2.

```javascript
// src/models/errors.js

const ErrorCode = {
  // Credential errors
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  CREDENTIALS_NOT_FOUND: 'CREDENTIALS_NOT_FOUND',
  CREDENTIALS_INVALID: 'CREDENTIALS_INVALID',
  CREDENTIALS_DECRYPT_FAILED: 'CREDENTIALS_DECRYPT_FAILED',
  // OAuth errors
  OAUTH_EXCHANGE_FAILED: 'OAUTH_EXCHANGE_FAILED',
  OAUTH_INVALID_GRANT: 'OAUTH_INVALID_GRANT',
  OAUTH_TIMEOUT: 'OAUTH_TIMEOUT',
  OAUTH_RATE_LIMITED: 'OAUTH_RATE_LIMITED',
  // Cache errors
  CACHE_UNAVAILABLE: 'CACHE_UNAVAILABLE',
  LOCK_TIMEOUT: 'LOCK_TIMEOUT',
  LOCK_ACQUISITION_FAILED: 'LOCK_ACQUISITION_FAILED',
  // JWT errors
  JWT_INVALID_SIGNATURE: 'JWT_INVALID_SIGNATURE',
  JWT_EXPIRED: 'JWT_EXPIRED',
  JWT_INVALID_FORMAT: 'JWT_INVALID_FORMAT',
  JWT_MISSING_CLAIMS: 'JWT_MISSING_CLAIMS',
  JWKS_FETCH_FAILED: 'JWKS_FETCH_FAILED',
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
};

class AuthServiceError extends Error {
  constructor(code, message, statusCode = 500, tenantId, correlationId) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.tenantId = tenantId;
    this.correlationId = correlationId;
  }
}

class OAuthError extends AuthServiceError {
  constructor(code, message, provider, providerError, tenantId, correlationId) {
    super(code, message, 401, tenantId, correlationId);
    this.name = 'OAuthError';
    this.provider = provider;
    this.providerError = providerError;
  }
}

class CacheError extends AuthServiceError {
  constructor(code, message, operation, tenantId, correlationId) {
    super(code, message, 503, tenantId, correlationId);
    this.name = 'CacheError';
    this.operation = operation;
  }
}

module.exports = { ErrorCode, AuthServiceError, OAuthError, CacheError };
```

**Acceptance:** `require('./models/errors')` returns all three classes; `new AuthServiceError('CODE', 'msg')` has `.code`, `.statusCode`, `.name`.

---

### TASK-01-04: Implement configuration module with startup validation
**Priority:** MVP
**File:** `src/config/index.js`

**Description:** Centralize all config with Joi schema validation. Service must fail fast on startup if required env vars are missing.

```javascript
// src/config/index.js
const Joi = require('joi');

const schema = Joi.object({
  port:              Joi.number().port().default(3004),
  nodeEnv:           Joi.string().valid('development', 'staging', 'production', 'test').default('development'),
  logLevel:          Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),

  redis: Joi.object({
    url:      Joi.string().required(),
    password: Joi.string().allow('').optional(),
    db:       Joi.number().integer().min(0).max(15).default(0),
  }),

  tenantService: Joi.object({
    url:     Joi.string().uri().required(),
    timeout: Joi.number().integer().positive().default(3000),
  }),

  internalAuth: Joi.object({
    secret: Joi.string().min(16).required(),
  }),

  ttls: Joi.object({
    tokenSafetyBuffer:    Joi.number().integer().positive().default(60),
    lockTTL:              Joi.number().integer().positive().default(30),
    jwksTTL:              Joi.number().integer().positive().default(21600),
    whatsappDefault:      Joi.number().integer().positive().default(86400),
    whatsappSafetyBuffer: Joi.number().integer().positive().default(3600),
  }),

  oauth: Joi.object({
    timeout:    Joi.number().integer().positive().default(5000),
    maxRetries: Joi.number().integer().min(0).max(5).default(2),
  }),
});

function loadConfig() {
  const raw = {
    port:    parseInt(process.env.PORT || '3004'),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    redis: {
      url:      process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      db:       parseInt(process.env.REDIS_DB || '0'),
    },
    tenantService: {
      url:     process.env.TENANT_SERVICE_URL,
      timeout: parseInt(process.env.TENANT_SERVICE_TIMEOUT || '3000'),
    },
    internalAuth: {
      secret: process.env.INTERNAL_SERVICE_SECRET,
    },
    ttls: {
      tokenSafetyBuffer:    parseInt(process.env.TOKEN_SAFETY_BUFFER_SECONDS || '60'),
      lockTTL:              parseInt(process.env.LOCK_TTL_SECONDS || '30'),
      jwksTTL:              parseInt(process.env.JWKS_TTL_SECONDS || '21600'),
      whatsappDefault:      parseInt(process.env.WHATSAPP_DEFAULT_TTL_SECONDS || '86400'),
      whatsappSafetyBuffer: parseInt(process.env.WHATSAPP_SAFETY_BUFFER_SECONDS || '3600'),
    },
    oauth: {
      timeout:    parseInt(process.env.OAUTH_TIMEOUT_MS || '5000'),
      maxRetries: parseInt(process.env.OAUTH_MAX_RETRIES || '2'),
    },
  };

  const { error, value } = schema.validate(raw, { abortEarly: false });
  if (error) {
    throw new Error(`Config validation failed:\n${error.message}`);
  }
  return value;
}

module.exports = loadConfig();
```

**Environment variables to add to `.env.example`:**
```
INTERNAL_SERVICE_SECRET=<min-16-chars>
LOG_LEVEL=info
TOKEN_SAFETY_BUFFER_SECONDS=60
LOCK_TTL_SECONDS=30
JWKS_TTL_SECONDS=21600
WHATSAPP_DEFAULT_TTL_SECONDS=86400
OAUTH_TIMEOUT_MS=5000
OAUTH_MAX_RETRIES=2
```

**Acceptance:** Starting without `REDIS_URL` or `TENANT_SERVICE_URL` throws on `require('./config')`. All env vars have documented defaults.

---

### TASK-01-05: Implement structured logger utility
**Priority:** MVP
**File:** `src/utils/logger.js`

**Description:** Replace all `console.log`/`console.error` calls with a structured logger that outputs JSON in production and pretty-prints in development. Follow FRD Section 7.2 — never log secrets.

```javascript
// src/utils/logger.js
const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.logLevel,
  defaultMeta: { service: 'auth-service' },
  format: config.nodeEnv === 'production'
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${level}] ${message} ${metaStr}`;
        })
      ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
```

**Security rules (enforce in code review):**
- Never pass `clientSecret`, `accessToken`, `systemUserToken`, or decrypted credentials to logger
- Safe to log: `tenantId`, `provider`, `region`, `ttl`, `expiresAt`, `source`, `duration`, `tokenLength`

**Acceptance:** `logger.info('test', { tenantId: 'abc' })` outputs JSON with `service: 'auth-service'` and `timestamp`. No secrets appear in any log output.

---

### TASK-01-06: Implement Redis key constants
**Priority:** MVP
**File:** `src/utils/redis-keys.js`

**Description:** Centralize Redis key generation to match FRD Section 3.3. Current code uses inconsistent key patterns.

```javascript
// src/utils/redis-keys.js

const RedisKeys = {
  token(provider, tenantId) {
    return `auth:token:${provider}:${tenantId}`;
  },
  lock(provider, tenantId) {
    return `auth:lock:${provider}:${tenantId}`;
  },
  jwks(region) {
    return `auth:jwks:${region}`;
  },
  rateLimit(provider, tenantId) {
    const minute = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    return `auth:ratelimit:${provider}:${tenantId}:${minute}`;
  },
};

const RedisTTL = {
  TOKEN_SAFETY_BUFFER:    60,
  LOCK_TTL:               30,
  JWKS_TTL:               21600,
  WHATSAPP_DEFAULT_TTL:   86400,
  WHATSAPP_SAFETY_BUFFER: 3600,
};

module.exports = { RedisKeys, RedisTTL };
```

**Migration note:** Current code uses `KEYS.genesysToken(tenantId)` from shared constants and `tenant:${tenantId}:whatsapp:token`. These must be replaced with `RedisKeys.token('genesys', tenantId)` and `RedisKeys.token('whatsapp', tenantId)`. Existing cached keys in Redis will expire naturally; no migration script needed.

**Acceptance:** `RedisKeys.token('genesys', 'abc')` returns `'auth:token:genesys:abc'`. All Redis operations in the service use this module.

---

### TASK-01-07: Create .env.example with all required variables
**Priority:** MVP
**File:** `.env.example` (update existing)

**Description:** Document every environment variable the service uses. Current `.env.example` is incomplete.

```bash
# App
NODE_ENV=development
PORT=3004
LOG_LEVEL=info

# Redis
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# Tenant Service
TENANT_SERVICE_URL=http://localhost:3007
TENANT_SERVICE_TIMEOUT=3000

# Internal Service Auth (min 16 chars)
INTERNAL_SERVICE_SECRET=change-me-in-production

# Cache TTLs
TOKEN_SAFETY_BUFFER_SECONDS=60
LOCK_TTL_SECONDS=30
JWKS_TTL_SECONDS=21600
WHATSAPP_DEFAULT_TTL_SECONDS=86400
WHATSAPP_SAFETY_BUFFER_SECONDS=3600

# OAuth
OAUTH_TIMEOUT_MS=5000
OAUTH_MAX_RETRIES=2
```

**Note:** Remove actual credentials from `.env`. Add `.env` to `.gitignore` if not already there.

**Acceptance:** Every variable used in `src/config/index.js` is documented in `.env.example` with a placeholder value and comment.
