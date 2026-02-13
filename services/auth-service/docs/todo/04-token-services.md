# Phase 04 — Token Services (Genesys + WhatsApp + Orchestrator)

**Depends on:** 02-redis-infrastructure, 03-credential-oauth-services
**Blocks:** 06-api-layer
**MVP Critical:** YES

---

## Gap Analysis

### Current State
- Token retrieval logic is inline in the `GET /auth/token` route handler in `src/index.js`
- `getValidToken(tenantId)` helper exists but only handles Genesys tokens
- WhatsApp token logic is in a separate `getWhatsAppCredentials()` helper
- **No distributed locking** — concurrent requests for the same tenant/provider all independently fetch tokens (token stampede risk)
- **No degraded mode** — if Redis goes down, the service crashes or behaves unpredictably
- No force-refresh toggle passed through to the caching layer
- Token type dispatch (genesys vs whatsapp) done via `X-Credential-Type` header; FRD uses `type` in request body

### FRD Requirements
- `services/token/genesys-token.service.js` — cache-aside + distributed lock + OAuth exchange
- `services/token/whatsapp-token.service.js` — cache-aside, no lock (static token)
- `services/token/token.service.js` — orchestrator dispatching by provider type
- Degraded mode: when `redisHealthMonitor.isHealthy === false`, bypass cache + apply in-memory rate limit
- Request collapsing: if lock is already held by another instance, wait up to 250ms for cache to be populated

---

## Tasks

### TASK-04-01: Implement Genesys token service
**Priority:** MVP
**File:** `src/services/token/genesys-token.service.js`

**Description:** Full cache-aside pattern with distributed locking. Implements the 7-step flow from FRD Section 5.1. Handles: cache hit, lock acquisition, credential fetch, OAuth exchange, cache write, lock release.

```javascript
// src/services/token/genesys-token.service.js
const logger = require('../../utils/logger');
const { AuthServiceError, CacheError, ErrorCode } = require('../../models/errors');

const WAIT_INTERVAL_MS = 50;
const MAX_WAIT_RETRIES = 5;

class GenesysTokenService {
  /**
   * @param {TokenCacheRepository} tokenCache
   * @param {LockRepository} lockRepo
   * @param {CredentialFetcherService} credentialFetcher
   * @param {GenesysOAuthClient} oauthClient
   * @param {RedisHealthMonitor} healthMonitor
   * @param {DegradedModeRateLimiter} degradedLimiter
   */
  constructor(tokenCache, lockRepo, credentialFetcher, oauthClient, healthMonitor, degradedLimiter) {
    this.tokenCache = tokenCache;
    this.lockRepo = lockRepo;
    this.credentialFetcher = credentialFetcher;
    this.oauthClient = oauthClient;
    this.healthMonitor = healthMonitor;
    this.degradedLimiter = degradedLimiter;
    this.provider = 'genesys';
  }

  async getToken(tenantId, forceRefresh = false, correlationId) {
    // Degraded mode: Redis is down
    if (!this.healthMonitor.isHealthy) {
      return this._getTokenDegraded(tenantId, correlationId);
    }

    // Step 1: Check cache (skip on forceRefresh)
    if (!forceRefresh) {
      const cached = await this.tokenCache.get(this.provider, tenantId);
      if (cached) {
        logger.debug('Genesys token cache hit', { tenantId, correlationId });
        return cached;
      }
    }

    // Step 2: Try to acquire lock (request collapsing)
    const { acquired, lockValue } = await this.lockRepo.acquire(this.provider, tenantId);

    if (!acquired) {
      // Another instance is fetching — wait for cache to be populated
      logger.debug('Lock held by another instance, waiting', { tenantId, correlationId });
      const token = await this._waitForCache(tenantId);
      if (token) return token;

      // Cache not populated after wait — try to get lock again
      const retry = await this.lockRepo.acquire(this.provider, tenantId);
      if (!retry.acquired) {
        throw new CacheError(
          ErrorCode.LOCK_ACQUISITION_FAILED,
          'Failed to acquire lock after cache wait timeout',
          'genesys_token_fetch',
          tenantId,
          correlationId
        );
      }
      // Proceed with the retry lock
      return this._fetchAndCache(tenantId, retry.lockValue, correlationId);
    }

    return this._fetchAndCache(tenantId, lockValue, correlationId);
  }

  async _waitForCache(tenantId) {
    for (let i = 0; i < MAX_WAIT_RETRIES; i++) {
      await new Promise(resolve => setTimeout(resolve, WAIT_INTERVAL_MS));
      const token = await this.tokenCache.get(this.provider, tenantId);
      if (token) {
        logger.debug('Cache populated by another request', { tenantId, attempt: i + 1 });
        return token;
      }
    }
    return null;
  }

  async _fetchAndCache(tenantId, lockValue, correlationId) {
    try {
      // Step 3: Fetch credentials from Tenant Service
      const credentials = await this.credentialFetcher.fetchCredentials(tenantId, this.provider);

      if (!credentials || (!credentials.clientId && !credentials.data?.clientId)) {
        throw new AuthServiceError(
          ErrorCode.CREDENTIALS_NOT_FOUND,
          `No Genesys credentials found for tenant ${tenantId}`,
          404,
          tenantId,
          correlationId
        );
      }

      // Normalize response shape from Tenant Service
      const creds = credentials.clientId ? credentials : credentials.data || credentials;

      // Step 4: OAuth exchange
      let oauthResponse;
      try {
        oauthResponse = await this.oauthClient.exchangeCredentials(creds, tenantId);
      } finally {
        // Zero out secret in memory
        if (creds.clientSecret) {
          creds.clientSecret = '\0'.repeat(creds.clientSecret.length);
        }
      }

      // Step 5: Cache token
      await this.tokenCache.set(
        this.provider,
        tenantId,
        oauthResponse.access_token,
        oauthResponse.expires_in
      );

      // Step 6: Return fresh token
      return {
        accessToken: oauthResponse.access_token,
        expiresIn: oauthResponse.expires_in,
        tokenType: oauthResponse.token_type || 'Bearer',
        source: 'fresh',
        expiresAt: new Date(Date.now() + oauthResponse.expires_in * 1000),
      };
    } finally {
      // Always release lock
      await this.lockRepo.release(this.provider, tenantId, lockValue);
    }
  }

  async _getTokenDegraded(tenantId, correlationId) {
    logger.warn('Genesys token fetch in degraded mode (Redis unavailable)', {
      tenantId,
      correlationId,
    });

    if (!this.degradedLimiter.isAllowed(this.provider, tenantId)) {
      throw new CacheError(
        ErrorCode.CACHE_UNAVAILABLE,
        'Rate limit exceeded in degraded mode — Redis unavailable',
        'genesys_degraded',
        tenantId,
        correlationId
      );
    }

    const credentials = await this.credentialFetcher.fetchCredentials(tenantId, this.provider);
    const creds = credentials.clientId ? credentials : credentials.data || credentials;

    let oauthResponse;
    try {
      oauthResponse = await this.oauthClient.exchangeCredentials(creds, tenantId);
    } finally {
      if (creds.clientSecret) {
        creds.clientSecret = '\0'.repeat(creds.clientSecret.length);
      }
    }

    return {
      accessToken: oauthResponse.access_token,
      expiresIn: oauthResponse.expires_in,
      tokenType: oauthResponse.token_type || 'Bearer',
      source: 'fresh',
      expiresAt: new Date(Date.now() + oauthResponse.expires_in * 1000),
    };
  }
}

module.exports = { GenesysTokenService };
```

**Acceptance:**
- Cache hit → returns immediately without calling Tenant Service
- Cache miss → fetches credentials, calls OAuth, caches result, returns fresh token
- 100 concurrent requests → lock ensures only 1 OAuth call (verify with nock interceptor count)
- Redis down → operates in degraded mode, respects in-memory rate limit
- Lock is always released (even when OAuth throws)

---

### TASK-04-02: Implement WhatsApp token service
**Priority:** MVP
**File:** `src/services/token/whatsapp-token.service.js`

**Description:** Simpler cache-aside for static token (no lock needed since there's no OAuth exchange to collapse). See FRD Section 5.2.

```javascript
// src/services/token/whatsapp-token.service.js
const logger = require('../../utils/logger');
const { AuthServiceError, CacheError, ErrorCode } = require('../../models/errors');
const { RedisTTL } = require('../../utils/redis-keys');

class WhatsAppTokenService {
  constructor(tokenCache, credentialFetcher, healthMonitor, degradedLimiter) {
    this.tokenCache = tokenCache;
    this.credentialFetcher = credentialFetcher;
    this.healthMonitor = healthMonitor;
    this.degradedLimiter = degradedLimiter;
    this.provider = 'whatsapp';
  }

  async getToken(tenantId, forceRefresh = false, correlationId) {
    if (!this.healthMonitor.isHealthy) {
      return this._getTokenDegraded(tenantId, correlationId);
    }

    // Check cache
    if (!forceRefresh) {
      const cached = await this.tokenCache.get(this.provider, tenantId);
      if (cached) {
        logger.debug('WhatsApp token cache hit', { tenantId, correlationId });
        return cached;
      }
    }

    return this._fetchAndCache(tenantId, correlationId);
  }

  async _fetchAndCache(tenantId, correlationId) {
    const credentials = await this.credentialFetcher.fetchCredentials(tenantId, this.provider);

    // Normalize credential shape from Tenant Service
    const token = credentials.systemUserToken || credentials.accessToken || credentials.token;
    const expiresAt = credentials.expiresAt ? new Date(credentials.expiresAt) : null;

    if (!token) {
      throw new AuthServiceError(
        ErrorCode.CREDENTIALS_NOT_FOUND,
        `No WhatsApp system user token found for tenant ${tenantId}`,
        404,
        tenantId,
        correlationId
      );
    }

    // Calculate TTL
    let expiresIn;
    if (expiresAt) {
      const secondsUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      expiresIn = secondsUntilExpiry - RedisTTL.WHATSAPP_SAFETY_BUFFER;
    } else {
      expiresIn = RedisTTL.WHATSAPP_DEFAULT_TTL;
    }

    if (expiresIn > 0) {
      await this.tokenCache.set(this.provider, tenantId, token, expiresIn);
    } else {
      logger.warn('WhatsApp token TTL too short to cache', { tenantId, expiresIn });
    }

    return {
      accessToken: token,
      expiresIn,
      tokenType: 'Bearer',
      source: 'fresh',
      expiresAt: expiresAt || new Date(Date.now() + expiresIn * 1000),
    };
  }

  async _getTokenDegraded(tenantId, correlationId) {
    logger.warn('WhatsApp token fetch in degraded mode', { tenantId, correlationId });

    if (!this.degradedLimiter.isAllowed(this.provider, tenantId)) {
      throw new CacheError(
        ErrorCode.CACHE_UNAVAILABLE,
        'Rate limit exceeded in degraded mode — Redis unavailable',
        'whatsapp_degraded',
        tenantId,
        correlationId
      );
    }

    return this._fetchAndCache(tenantId, correlationId);
  }
}

module.exports = { WhatsAppTokenService };
```

---

### TASK-04-03: Implement token orchestrator service
**Priority:** MVP
**File:** `src/services/token/token.service.js`

**Description:** Dispatch `getToken` to the correct provider-specific service. Logs timing and emits metrics hooks. This is the only class called by the API controller.

```javascript
// src/services/token/token.service.js
const logger = require('../../utils/logger');
const { AuthServiceError, ErrorCode } = require('../../models/errors');

class TokenService {
  /**
   * @param {GenesysTokenService} genesysTokenService
   * @param {WhatsAppTokenService} whatsappTokenService
   */
  constructor(genesysTokenService, whatsappTokenService) {
    this.genesysTokenService = genesysTokenService;
    this.whatsappTokenService = whatsappTokenService;
  }

  /**
   * @param {object} request - { tenantId, type, forceRefresh, correlationId }
   * @returns {object} TokenResponse
   */
  async getToken({ tenantId, type, forceRefresh = false, correlationId }) {
    logger.info('Token request received', { tenantId, type, forceRefresh, correlationId });

    const startTime = Date.now();

    try {
      let token;

      if (type === 'genesys') {
        token = await this.genesysTokenService.getToken(tenantId, forceRefresh, correlationId);
      } else if (type === 'whatsapp') {
        token = await this.whatsappTokenService.getToken(tenantId, forceRefresh, correlationId);
      } else {
        throw new AuthServiceError(
          ErrorCode.INVALID_REQUEST,
          `Unsupported provider type: ${type}. Must be 'genesys' or 'whatsapp'`,
          400,
          tenantId,
          correlationId
        );
      }

      const duration = Date.now() - startTime;
      logger.info('Token request completed', {
        tenantId,
        type,
        source: token.source,
        duration,
        correlationId,
      });

      return token;
    } catch (err) {
      const duration = Date.now() - startTime;
      logger.error('Token request failed', {
        tenantId,
        type,
        duration,
        correlationId,
        error: err.message,
        code: err.code,
      });
      throw err;
    }
  }
}

module.exports = { TokenService };
```

---

### TASK-04-04: Create service factory / dependency wiring
**Priority:** MVP
**File:** `src/services/factory.js`

**Description:** Wire all services together without a DI framework. Creates singletons that are shared across request handlers. Call this once at startup.

```javascript
// src/services/factory.js
const { connectRedis } = require('../repositories/redis.client');
const { TokenCacheRepository } = require('../repositories/token-cache.repository');
const { LockRepository } = require('../repositories/lock.repository');
const { CredentialFetcherService } = require('./credentials/credential-fetcher.service');
const { GenesysOAuthClient } = require('./oauth/genesys-oauth.client');
const { GenesysTokenService } = require('./token/genesys-token.service');
const { WhatsAppTokenService } = require('./token/whatsapp-token.service');
const { TokenService } = require('./token/token.service');
const { JWTValidatorService } = require('./jwt/jwt-validator.service');
const { RedisHealthMonitor } = require('./health/redis-health-monitor');
const { DegradedModeRateLimiter } = require('./health/degraded-rate-limiter');

let services = null;

async function createServices() {
  if (services) return services;

  const redis = await connectRedis();

  const healthMonitor = new RedisHealthMonitor(redis);
  healthMonitor.start();

  const degradedLimiter = new DegradedModeRateLimiter();

  const tokenCache = new TokenCacheRepository(redis);
  const lockRepo = new LockRepository(redis);
  const credentialFetcher = new CredentialFetcherService();
  const oauthClient = new GenesysOAuthClient();

  const genesysTokenService = new GenesysTokenService(
    tokenCache, lockRepo, credentialFetcher, oauthClient, healthMonitor, degradedLimiter
  );

  const whatsappTokenService = new WhatsAppTokenService(
    tokenCache, credentialFetcher, healthMonitor, degradedLimiter
  );

  const tokenService = new TokenService(genesysTokenService, whatsappTokenService);
  const jwtValidatorService = new JWTValidatorService(redis);

  services = {
    redis,
    healthMonitor,
    tokenService,
    jwtValidatorService,
    credentialFetcher,
  };

  return services;
}

module.exports = { createServices };
```

**Acceptance:** `createServices()` can be called multiple times and returns the same singleton set. All token service dependencies are injected (no hidden `require()` calls to global state inside services).
