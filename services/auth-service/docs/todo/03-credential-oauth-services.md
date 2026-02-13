# Phase 03 — Credential Fetcher & Genesys OAuth Client

**Depends on:** 01-project-structure-foundation
**Blocks:** 04-token-services
**MVP Critical:** YES

---

## Gap Analysis

### Current State
- `getTenantGenesysCredentials(tenantId)` is an inline function in `src/index.js`
- Calls `GET /tenants/${tenantId}/genesys/credentials` — **wrong endpoint** (FRD specifies `GET /tenants/{tenantId}/credentials?type=genesys` or `GET /tenants/{tenantId}/credentials/:type`)
- `getWhatsAppCredentials(tenantId)` is also inline — calls `GET /tenants/${tenantId}/credentials?type=whatsapp`
- No retry logic on Tenant Service failure (FRD requires up to 2 retries with exponential backoff)
- OAuth exchange (`axios.post` to Genesys login URL) is inline in the route handler
- Hardcoded to single region — region comes from `process.env.GENESYS_REGION`
- No multi-region login URL mapping
- No credential decryption step (FRD requires decrypt in-memory; current impl assumes plaintext from Tenant Service)
- No secret zeroization after OAuth exchange

### FRD Requirements
- `services/credentials/credential-fetcher.service.js` — calls Tenant Service, retries on 5xx, no retry on 404/400
- `services/oauth/genesys-oauth.client.js` — POST to correct region endpoint, retry on timeout/5xx, NO retry on 401
- Genesys region → login URL mapping (11 regions documented in FRD Appendix A)
- In-memory secret zeroization after use (FRD Section 7.1)

---

## Tasks

### TASK-03-01: Implement Genesys region URL map
**Priority:** MVP
**File:** `src/config/providers.config.js`

**Description:** Map region identifiers to correct Genesys login and JWKS endpoints. FRD Appendix A documents all 11 regions. Current code uses `https://login.${region}.genesys.cloud/oauth/token` which is only correct for some regions.

```javascript
// src/config/providers.config.js

/**
 * Genesys Cloud region → OAuth + JWKS endpoint mapping
 * Source: FRD Appendix A
 */
const GENESYS_REGIONS = {
  'us-east-1': {
    oauthUrl:  'https://login.use1.us-gov-pure-cloud.com/oauth/token',
    jwksUrl:   'https://login.use1.us-gov-pure-cloud.com/.well-known/jwks.json',
  },
  'us-east-2': {
    oauthUrl:  'https://login.us-east-2.pure.cloud/oauth/token',
    jwksUrl:   'https://login.us-east-2.pure.cloud/.well-known/jwks.json',
  },
  'us-west-2': {
    oauthUrl:  'https://login.usw2.pure.cloud/oauth/token',
    jwksUrl:   'https://login.usw2.pure.cloud/.well-known/jwks.json',
  },
  'ca-central-1': {
    oauthUrl:  'https://login.cac1.pure.cloud/oauth/token',
    jwksUrl:   'https://login.cac1.pure.cloud/.well-known/jwks.json',
  },
  'eu-west-1': {
    oauthUrl:  'https://login.mypurecloud.ie/oauth/token',
    jwksUrl:   'https://login.mypurecloud.ie/.well-known/jwks.json',
  },
  'eu-west-2': {
    oauthUrl:  'https://login.euw2.pure.cloud/oauth/token',
    jwksUrl:   'https://login.euw2.pure.cloud/.well-known/jwks.json',
  },
  'eu-central-1': {
    oauthUrl:  'https://login.mypurecloud.de/oauth/token',
    jwksUrl:   'https://login.mypurecloud.de/.well-known/jwks.json',
  },
  'ap-southeast-2': {
    oauthUrl:  'https://login.mypurecloud.com.au/oauth/token',
    jwksUrl:   'https://login.mypurecloud.com.au/.well-known/jwks.json',
  },
  'ap-northeast-1': {
    oauthUrl:  'https://login.mypurecloud.jp/oauth/token',
    jwksUrl:   'https://login.mypurecloud.jp/.well-known/jwks.json',
  },
  'ap-northeast-2': {
    oauthUrl:  'https://login.apne2.pure.cloud/oauth/token',
    jwksUrl:   'https://login.apne2.pure.cloud/.well-known/jwks.json',
  },
  'ap-south-1': {
    oauthUrl:  'https://login.aps1.pure.cloud/oauth/token',
    jwksUrl:   'https://login.aps1.pure.cloud/.well-known/jwks.json',
  },
};

function getGenesysEndpoints(region) {
  const endpoints = GENESYS_REGIONS[region];
  if (!endpoints) {
    throw new Error(`Unknown Genesys region: ${region}. Valid regions: ${Object.keys(GENESYS_REGIONS).join(', ')}`);
  }
  return endpoints;
}

module.exports = { GENESYS_REGIONS, getGenesysEndpoints };
```

**Acceptance:** `getGenesysEndpoints('ap-south-1').oauthUrl` returns `'https://login.aps1.pure.cloud/oauth/token'`. `getGenesysEndpoints('invalid')` throws.

---

### TASK-03-02: Implement credential fetcher service
**Priority:** MVP
**File:** `src/services/credentials/credential-fetcher.service.js`

**Description:** Fetch credentials from Tenant Service with retry on 5xx/network errors. No retry on 404/400 (fail fast). See FRD Section 5.1 Step 4 and Section 6.3.

**Important:** The current code calls `GET /tenants/${tenantId}/genesys/credentials` for Genesys. The FRD and tenant-service MEMORY.md show the canonical endpoint is `GET /tenants/:id/credentials/:type`. Update accordingly.

```javascript
// src/services/credentials/credential-fetcher.service.js
const axios = require('axios');
const logger = require('../../utils/logger');
const config = require('../../config');
const { AuthServiceError, ErrorCode } = require('../../models/errors');

class CredentialFetcherService {
  constructor() {
    this.client = axios.create({
      baseURL: config.tenantService.url,
      timeout: config.tenantService.timeout,
      headers: {
        'X-Service-Name': 'auth-service',
      },
    });
  }

  /**
   * Fetch credentials for a tenant+provider from Tenant Service.
   * Returns credentials object (already decrypted by Tenant Service if applicable).
   * Retries up to 2 times on 5xx or network errors.
   * Throws AuthServiceError on 404 (tenant not found) or after max retries.
   */
  async fetchCredentials(tenantId, provider) {
    const maxRetries = 2;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Canonical endpoint from tenant-service: GET /tenants/:id/credentials/:type
        const response = await this.client.get(
          `/tenants/${tenantId}/credentials/${provider}`
        );

        return response.data;
      } catch (err) {
        lastError = err;

        const status = err.response?.status;

        // 404 → tenant or credentials not found — don't retry
        if (status === 404) {
          throw new AuthServiceError(
            ErrorCode.CREDENTIALS_NOT_FOUND,
            `No ${provider} credentials found for tenant ${tenantId}`,
            404,
            tenantId
          );
        }

        // 400 → bad request — don't retry
        if (status === 400) {
          throw new AuthServiceError(
            ErrorCode.INVALID_REQUEST,
            `Invalid credential request for tenant ${tenantId}`,
            400,
            tenantId
          );
        }

        // 5xx or network error → retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.min(500 * Math.pow(2, attempt), 4000);
          logger.warn('Tenant Service request failed, retrying', {
            tenantId,
            provider,
            attempt,
            delay,
            status,
            error: err.message,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    logger.error('Tenant Service request failed after retries', {
      tenantId,
      provider,
      error: lastError?.message,
    });

    throw new AuthServiceError(
      ErrorCode.CREDENTIALS_NOT_FOUND,
      `Failed to fetch ${provider} credentials for tenant ${tenantId} after retries`,
      503,
      tenantId
    );
  }
}

module.exports = { CredentialFetcherService };
```

**Acceptance:**
- 404 from Tenant Service → throws `AuthServiceError` with code `CREDENTIALS_NOT_FOUND`, status 404
- 503 from Tenant Service (first 2 attempts) then 200 → returns credentials
- 3 consecutive 503s → throws after max retries

---

### TASK-03-03: Implement Genesys OAuth client
**Priority:** MVP
**File:** `src/services/oauth/genesys-oauth.client.js`

**Description:** Perform OAuth 2.0 Client Credentials exchange against Genesys login endpoint. Retry on timeout/5xx. Do NOT retry on 401 (invalid credentials). See FRD Section 5.1 Step 5.

**Security:** Never log `clientId` or `clientSecret`. After use, zero out `clientSecret` in the credentials object.

```javascript
// src/services/oauth/genesys-oauth.client.js
const axios = require('axios');
const logger = require('../../utils/logger');
const config = require('../../config');
const { OAuthError, ErrorCode } = require('../../models/errors');
const { getGenesysEndpoints } = require('../../config/providers.config');

class GenesysOAuthClient {
  /**
   * Exchange client credentials for an access token.
   * @param {object} credentials - { clientId, clientSecret, region }
   * @param {string} tenantId - For logging/error context only (never log credentials)
   * @returns {object} { access_token, token_type, expires_in }
   */
  async exchangeCredentials(credentials, tenantId) {
    const { oauthUrl } = getGenesysEndpoints(credentials.region);

    // Basic auth: base64(clientId:clientSecret)
    const basicAuth = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`
    ).toString('base64');

    const maxRetries = config.oauth.maxRetries;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(
          oauthUrl,
          'grant_type=client_credentials',
          {
            timeout: config.oauth.timeout,
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        logger.info('Genesys OAuth exchange successful', {
          tenantId,
          region: credentials.region,
          // NEVER log access_token or basicAuth
        });

        return response.data;
      } catch (err) {
        lastError = err;
        const status = err.response?.status;

        // 401 → invalid credentials, do NOT retry
        if (status === 401) {
          logger.error('Genesys OAuth credentials rejected', {
            tenantId,
            region: credentials.region,
            providerError: err.response?.data?.error_description,
            // NO clientId or clientSecret logged
          });

          throw new OAuthError(
            ErrorCode.OAUTH_INVALID_GRANT,
            'OAuth credentials were rejected by Genesys',
            'genesys',
            err.response?.data?.error_description,
            tenantId
          );
        }

        // 429 → rate limited, exponential backoff
        if (status === 429) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          logger.warn('Genesys OAuth rate limited, backing off', {
            tenantId,
            attempt,
            delay,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Timeout or 5xx → retry with backoff
        const isRetriable = err.code === 'ECONNABORTED' ||
                            err.code === 'ETIMEDOUT' ||
                            (status >= 500 && status < 600);

        if (isRetriable && attempt < maxRetries) {
          const delay = Math.min(500 * Math.pow(2, attempt), 4000);
          logger.warn('Genesys OAuth request failed, retrying', {
            tenantId,
            attempt,
            delay,
            status,
            code: err.code,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Non-retriable or max retries exceeded
        break;
      }
    }

    logger.error('Genesys OAuth exchange failed after retries', {
      tenantId,
      maxRetries,
      error: lastError?.message,
    });

    throw new OAuthError(
      ErrorCode.OAUTH_EXCHANGE_FAILED,
      'Failed to exchange OAuth credentials after retries',
      'genesys',
      undefined,
      tenantId
    );
  }
}

module.exports = { GenesysOAuthClient };
```

**Security note on secret zeroization:** After calling `exchangeCredentials()`, the calling service (token service) should zero out the credential:
```javascript
try {
  const result = await oauthClient.exchangeCredentials(creds, tenantId);
  return result;
} finally {
  if (creds.clientSecret) {
    creds.clientSecret = '\0'.repeat(creds.clientSecret.length);
  }
}
```

**Acceptance:**
- 401 from Genesys → throws `OAuthError` with `OAUTH_INVALID_GRANT`, does not retry
- Timeout on first attempt, success on second → returns token
- 3 consecutive timeouts → throws `OAuthError` with `OAUTH_EXCHANGE_FAILED`
- `clientSecret` is never present in any log output
