const jwt = require('jsonwebtoken');
const logger = require('../../utils/logger');
const { JWKSCacheService } = require('./jwks-cache.service');
const { AuthServiceError } = require('../../models/errors');

class JWTValidatorService {
  constructor() {
    this.jwksCache = new JWKSCacheService();
  }

  /**
   * Validate a Genesys SSO JWT.
   * Returns { isValid: true, userId, orgId, roles, expiresAt }
   *      OR { isValid: false, error: string }
   * Throws AuthServiceError only on JWKS fetch failure (503).
   */
  async validate(token, region) {
    try {
      const decoded = jwt.decode(token, { complete: true });

      if (!decoded || typeof decoded === 'string') {
        return { isValid: false, error: 'Invalid JWT format — could not decode' };
      }

      const { header, payload } = decoded;

      if (!header.kid) {
        return { isValid: false, error: 'Missing kid in JWT header' };
      }

      // May throw AuthServiceError(JWKS_FETCH_FAILED) → propagates as 503
      const signingKey = await this.jwksCache.getSigningKey(region, header.kid);

      let verified;
      try {
        verified = jwt.verify(token, signingKey, {
          algorithms: ['RS256'],
          clockTolerance: 30,
        });
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          logger.debug('JWT expired', { region });
          return { isValid: false, error: 'JWT has expired' };
        }
        if (err.name === 'JsonWebTokenError') {
          logger.debug('JWT signature invalid', { region, message: err.message });
          return { isValid: false, error: 'JWT signature verification failed' };
        }
        logger.error('JWT verification error', { region, error: err.message });
        return { isValid: false, error: err.message || 'JWT verification failed' };
      }

      if (typeof verified === 'string') {
        return { isValid: false, error: 'Invalid JWT payload format' };
      }

      const userId = verified.sub;
      if (!userId) {
        return { isValid: false, error: 'Missing required claim: sub' };
      }

      const orgId = verified.org_id || verified.organization_id || undefined;
      const roles = Array.isArray(verified.roles) ? verified.roles : [];
      const expiresAt = verified.exp ? new Date(verified.exp * 1000) : undefined;

      logger.info('JWT validation successful', { region, userId, orgId });

      return { isValid: true, userId, orgId, roles, expiresAt };
    } catch (err) {
      if (err instanceof AuthServiceError) throw err;

      logger.error('JWT validation unexpected error', { region, error: err.message });
      return { isValid: false, error: err.message || 'JWT validation failed' };
    }
  }
}

module.exports = { JWTValidatorService };
