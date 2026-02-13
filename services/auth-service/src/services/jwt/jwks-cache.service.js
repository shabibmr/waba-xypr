const jwksRsa = require('jwks-rsa');
const logger = require('../../utils/logger');
const { getGenesysEndpoints } = require('../../config/providers.config');
const { AuthServiceError, ErrorCode } = require('../../models/errors');
const { RedisTTL } = require('../../utils/redis-keys');

class JWKSCacheService {
  constructor() {
    this._clients = new Map();
  }

  _getClient(region) {
    if (!this._clients.has(region)) {
      const { jwksUrl } = getGenesysEndpoints(region);

      const client = jwksRsa({
        jwksUri: jwksUrl,
        cache: true,
        cacheMaxAge: RedisTTL.JWKS_TTL * 1000,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        timeout: 5000,
      });

      this._clients.set(region, client);
      logger.debug('JWKS client created', { region, jwksUrl });
    }

    return this._clients.get(region);
  }

  async getSigningKey(region, kid) {
    const client = this._getClient(region);

    try {
      const key = await client.getSigningKey(kid);
      return key.getPublicKey();
    } catch (err) {
      logger.error('Failed to fetch JWKS signing key', { region, kid, error: err.message });
      throw new AuthServiceError(
        ErrorCode.JWKS_FETCH_FAILED,
        `Failed to fetch JWKS signing key for region ${region}: ${err.message}`,
        503
      );
    }
  }
}

module.exports = { JWKSCacheService };
