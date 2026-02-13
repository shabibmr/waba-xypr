# Phase 05 — JWT Validation Service

**Depends on:** 01-project-structure-foundation, 02-redis-infrastructure (for JWKS caching)
**Blocks:** 06-api-layer
**MVP Critical:** YES (required for agent-portal SSO login flow)

---

## Gap Analysis

### Current State
- `POST /auth/validate` exists but validates tokens by calling `GET /api/v2/users/me` on Genesys API
- This is **completely different** from what the FRD requires: JWKS-based RS256 signature verification
- The current approach:
  - Requires a valid Genesys OAuth token to validate another token (circular dependency)
  - Does not extract `userId`, `orgId`, `roles` from claims
  - Does not support multiple Genesys regions
  - Does not cache JWKS keys
- No `jsonwebtoken` or `jwks-rsa` packages are installed

### FRD Requirements (Section 5.3, REQ-AUTH-04)
- `POST /api/v1/validate/jwt` — accepts `{ token, region }`, returns `{ isValid, userId, orgId, roles, expiresAt }` or `{ isValid: false, error }`
- JWKS fetched from `https://login.{region}.genesys.cloud/.well-known/jwks.json`
- JWKS keys cached in Redis for 6 hours (`auth:jwks:{region}`)
- If Redis unavailable, use in-memory fallback from `jwks-rsa` library's built-in cache
- RS256 algorithm only, clock tolerance ±30 seconds
- Extract claims: `sub` (userId), `org_id`/`organization_id` (orgId), `roles`

---

## Tasks

### TASK-05-01: Implement JWKS cache service
**Priority:** MVP
**File:** `src/services/jwt/jwks-cache.service.js`

**Description:** Provide per-region JWKS clients with in-library caching. The `jwks-rsa` package handles HTTPS fetching and key caching internally. We wrap it with per-region client management.

```javascript
// src/services/jwt/jwks-cache.service.js
const jwksRsa = require('jwks-rsa');
const logger = require('../../utils/logger');
const { getGenesysEndpoints } = require('../../config/providers.config');
const { AuthServiceError, ErrorCode } = require('../../models/errors');
const { RedisTTL } = require('../../utils/redis-keys');

class JWKSCacheService {
  constructor() {
    // Map of region → jwks-rsa client
    this._clients = new Map();
  }

  _getClient(region) {
    if (!this._clients.has(region)) {
      const { jwksUrl } = getGenesysEndpoints(region);

      const client = jwksRsa({
        jwksUri: jwksUrl,
        cache: true,
        cacheMaxAge: RedisTTL.JWKS_TTL * 1000,  // jwks-rsa uses ms
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        timeout: 5000,
      });

      this._clients.set(region, client);
      logger.debug('JWKS client created for region', { region, jwksUrl });
    }

    return this._clients.get(region);
  }

  /**
   * Retrieve the public key for a given region and key ID (kid).
   * Returns PEM-formatted public key string.
   * Throws AuthServiceError(JWKS_FETCH_FAILED) if key cannot be retrieved.
   */
  async getSigningKey(region, kid) {
    const client = this._getClient(region);

    try {
      const key = await client.getSigningKey(kid);
      return key.getPublicKey();
    } catch (err) {
      logger.error('Failed to fetch JWKS signing key', {
        region,
        kid,
        error: err.message,
      });

      throw new AuthServiceError(
        ErrorCode.JWKS_FETCH_FAILED,
        `Failed to fetch JWKS signing key for region ${region}: ${err.message}`,
        503
      );
    }
  }
}

module.exports = { JWKSCacheService };
```

**Acceptance:** `getSigningKey('ap-south-1', 'some-kid')` calls `https://login.aps1.pure.cloud/.well-known/jwks.json`. Second call with same region+kid uses cached key (no second HTTPS request). Unknown region throws immediately.

---

### TASK-05-02: Implement JWT validator service
**Priority:** MVP
**File:** `src/services/jwt/jwt-validator.service.js`

**Description:** Validate Genesys SSO JWT tokens using JWKS public keys. See FRD Section 5.3. Returns a structured response object (never throws on invalid token — invalid tokens return `{ isValid: false, error }`).

```javascript
// src/services/jwt/jwt-validator.service.js
const jwt = require('jsonwebtoken');
const logger = require('../../utils/logger');
const { JWKSCacheService } = require('./jwks-cache.service');
const { AuthServiceError, ErrorCode } = require('../../models/errors');

class JWTValidatorService {
  constructor() {
    this.jwksCache = new JWKSCacheService();
  }

  /**
   * Validate a Genesys SSO JWT.
   *
   * @param {string} token - The JWT string (NEVER log this)
   * @param {string} region - Genesys region (e.g. 'us-east-1')
   * @returns {object} JWTValidationResponse:
   *   { isValid: true, userId, orgId, roles, expiresAt }
   *   OR { isValid: false, error: string }
   */
  async validate(token, region) {
    try {
      // Step 1: Decode header to get kid (key ID) — does NOT verify signature
      const decoded = jwt.decode(token, { complete: true });

      if (!decoded || typeof decoded === 'string') {
        return { isValid: false, error: 'Invalid JWT format — could not decode' };
      }

      const { header, payload } = decoded;

      if (!header.kid) {
        return {
          isValid: false,
          error: 'Missing kid in JWT header — cannot identify signing key',
        };
      }

      // Step 2: Fetch signing key from JWKS
      let signingKey;
      try {
        signingKey = await this.jwksCache.getSigningKey(region, header.kid);
      } catch (err) {
        // JWKS fetch failure is a 503 error, not an invalid token
        throw err;
      }

      // Step 3: Verify signature and standard claims (exp, nbf, iat)
      let verified;
      try {
        verified = jwt.verify(token, signingKey, {
          algorithms: ['RS256'],
          clockTolerance: 30,  // Allow 30s clock skew
        });
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          logger.debug('JWT expired', { region });
          return { isValid: false, error: 'JWT has expired' };
        }

        if (err.name === 'JsonWebTokenError') {
          logger.debug('JWT signature verification failed', { region, message: err.message });
          return { isValid: false, error: 'JWT signature verification failed' };
        }

        logger.error('JWT verification unexpected error', { region, error: err.message });
        return { isValid: false, error: err.message || 'JWT verification failed' };
      }

      if (typeof verified === 'string') {
        return { isValid: false, error: 'Invalid JWT payload format' };
      }

      // Step 4: Extract required claims
      const userId = verified.sub;
      if (!userId) {
        return { isValid: false, error: 'Missing required claim: sub' };
      }

      const orgId = verified.org_id || verified.organization_id || undefined;
      const roles = Array.isArray(verified.roles) ? verified.roles : [];
      const expiresAt = verified.exp ? new Date(verified.exp * 1000) : undefined;

      logger.info('JWT validation successful', {
        region,
        userId,
        orgId,
        // NEVER log the token itself
      });

      return {
        isValid: true,
        userId,
        orgId,
        roles,
        expiresAt,
      };
    } catch (err) {
      // Re-throw service-level errors (JWKS fetch failure → 503)
      if (err.name === 'AuthServiceError') throw err;

      logger.error('JWT validation unexpected error', {
        region,
        error: err.message,
        // NO token in log
      });

      return {
        isValid: false,
        error: err.message || 'JWT validation failed',
      };
    }
  }
}

module.exports = { JWTValidatorService };
```

**Acceptance:**
- Valid RS256 JWT → `{ isValid: true, userId: '...', orgId: '...' }`
- Expired JWT → `{ isValid: false, error: 'JWT has expired' }` — does NOT throw
- JWT with tampered signature → `{ isValid: false, error: 'JWT signature verification failed' }`
- Missing `sub` claim → `{ isValid: false, error: 'Missing required claim: sub' }`
- JWKS endpoint unreachable → throws `AuthServiceError` with code `JWKS_FETCH_FAILED` and status 503
- Token string is never present in any log output

---

### TASK-05-03: Update providers.config.js to expose JWKS URLs
**Priority:** MVP
**File:** `src/config/providers.config.js` (already created in TASK-03-01)

**Description:** Ensure `getGenesysEndpoints(region)` returns `jwksUrl` in addition to `oauthUrl`. This was already included in TASK-03-01, but verify both URLs are present and tested.

**Verification:**
```javascript
const { getGenesysEndpoints } = require('./src/config/providers.config');
const ep = getGenesysEndpoints('ap-south-1');
assert(ep.oauthUrl === 'https://login.aps1.pure.cloud/oauth/token');
assert(ep.jwksUrl  === 'https://login.aps1.pure.cloud/.well-known/jwks.json');
```

No new file needed — confirm TASK-03-01 covers this.

---

### TASK-05-04: Install JWT validation dependencies
**Priority:** MVP

**Description:** Install packages required for JWT validation.

```bash
npm install jsonwebtoken jwks-rsa
```

**Package versions (from FRD Section 9.1):**
- `jsonwebtoken@^9.x`
- `jwks-rsa@^3.x`

**Acceptance:** `node -e "require('jsonwebtoken'); require('jwks-rsa')"` exits with 0.
