const logger = require('../../utils/logger');
const { AuthServiceError, CacheError, ErrorCode } = require('../../models/errors');

const WAIT_INTERVAL_MS = 50;
const MAX_WAIT_RETRIES = 5;

class GenesysTokenService {
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
    if (!this.healthMonitor.isHealthy) {
      return this._getTokenDegraded(tenantId, correlationId);
    }

    if (!forceRefresh) {
      const cached = await this.tokenCache.get(this.provider, tenantId);
      if (cached) {
        logger.debug('Genesys token cache hit', { tenantId, correlationId });
        return cached;
      }
    }

    const { acquired, lockValue } = await this.lockRepo.acquire(this.provider, tenantId);

    if (!acquired) {
      logger.debug('Lock held by another instance, waiting for cache', { tenantId, correlationId });
      const token = await this._waitForCache(tenantId);
      if (token) return token;

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
      return this._fetchAndCache(tenantId, retry.lockValue, correlationId);
    }

    return this._fetchAndCache(tenantId, lockValue, correlationId);
  }

  async _waitForCache(tenantId) {
    for (let i = 0; i < MAX_WAIT_RETRIES; i++) {
      await new Promise(resolve => setTimeout(resolve, WAIT_INTERVAL_MS));
      const token = await this.tokenCache.get(this.provider, tenantId);
      if (token) {
        logger.debug('Cache populated by concurrent request', { tenantId, attempt: i + 1 });
        return token;
      }
    }
    return null;
  }

  async _fetchAndCache(tenantId, lockValue, correlationId) {
    try {
      const credentials = await this.credentialFetcher.fetchCredentials(tenantId, this.provider);

      // Normalize credential shape — Tenant Service may wrap in data or return flat
      const creds = this._normalizeCredentials(credentials, tenantId, correlationId);

      let oauthResponse;
      try {
        oauthResponse = await this.oauthClient.exchangeCredentials(creds, tenantId);
      } finally {
        if (creds.clientSecret) {
          creds.clientSecret = '\0'.repeat(creds.clientSecret.length);
        }
      }

      await this.tokenCache.set(
        this.provider,
        tenantId,
        oauthResponse.access_token,
        oauthResponse.expires_in
      );

      return {
        accessToken: oauthResponse.access_token,
        expiresIn: oauthResponse.expires_in,
        tokenType: oauthResponse.token_type || 'Bearer',
        source: 'fresh',
        expiresAt: new Date(Date.now() + oauthResponse.expires_in * 1000),
      };
    } finally {
      await this.lockRepo.release(this.provider, tenantId, lockValue);
    }
  }

  _normalizeCredentials(raw, tenantId, correlationId) {
    const creds = raw?.clientId ? raw : (raw?.data || raw);
    if (!creds?.clientId) {
      throw new AuthServiceError(
        ErrorCode.CREDENTIALS_NOT_FOUND,
        `No Genesys credentials configured for tenant ${tenantId}`,
        404,
        tenantId,
        correlationId
      );
    }
    return creds;
  }

  async _getTokenDegraded(tenantId, correlationId) {
    logger.warn('Genesys token in degraded mode (Redis unavailable)', { tenantId, correlationId });

    if (!this.degradedLimiter.isAllowed(this.provider, tenantId)) {
      throw new CacheError(
        ErrorCode.CACHE_UNAVAILABLE,
        'Rate limit exceeded in degraded mode',
        'genesys_degraded',
        tenantId,
        correlationId
      );
    }

    const credentials = await this.credentialFetcher.fetchCredentials(tenantId, this.provider);
    const creds = this._normalizeCredentials(credentials, tenantId, correlationId);

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
