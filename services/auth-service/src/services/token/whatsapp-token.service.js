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

    // Normalize various response shapes from Tenant Service
    const token = credentials.systemUserToken
      || credentials.accessToken
      || credentials.token
      || credentials.access_token;

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
    logger.warn('WhatsApp token in degraded mode (Redis unavailable)', { tenantId, correlationId });

    if (!this.degradedLimiter.isAllowed(this.provider, tenantId)) {
      throw new CacheError(
        ErrorCode.CACHE_UNAVAILABLE,
        'Rate limit exceeded in degraded mode',
        'whatsapp_degraded',
        tenantId,
        correlationId
      );
    }

    return this._fetchAndCache(tenantId, correlationId);
  }
}

module.exports = { WhatsAppTokenService };
