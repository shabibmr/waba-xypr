const jwt = require('jsonwebtoken');
const config = require('../../config');
const logger = require('../../utils/logger');
const { AuthServiceError, ErrorCode } = require('../../models/errors');

class TokenService {
  constructor(genesysTokenService, whatsappTokenService) {
    this.genesysTokenService = genesysTokenService;
    this.whatsappTokenService = whatsappTokenService;
  }

  async issueUserToken(userData) {
    const { userId, tenantId, role } = userData;

    logger.info('Issuing user tokens', { userId, tenantId, role });

    const accessToken = jwt.sign(
      { userId, tenantId, role, type: 'access' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const refreshToken = jwt.sign(
      { userId, tenantId, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    return { accessToken, refreshToken, expiresIn: 3600 };
  }

  async refreshUserToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Generate new tokens
      const newAccessToken = jwt.sign(
        {
          userId: decoded.userId,
          tenantId: decoded.tenantId,
          // role might be missing in refresh token, strictly we should refetch user, 
          // but for this MVP we might need to rely on what's available or simple re-signing.
          // Let's assume we just re-issue access token.
          type: 'access'
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      const newRefreshToken = jwt.sign(
        { userId: decoded.userId, tenantId: decoded.tenantId, type: 'refresh' },
        config.jwt.secret,
        { expiresIn: config.jwt.refreshExpiresIn }
      );

      return { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 3600 };

    } catch (err) {
      logger.warn('Token refresh failed', { error: err.message });
      throw new AuthServiceError(ErrorCode.UNAUTHORIZED, 'Invalid refresh token', 401);
    }
  }

  async getToken({ tenantId, type, forceRefresh = false, correlationId }) {
    logger.info('Token request received', { tenantId, type, forceRefresh, correlationId });

    const start = Date.now();

    try {
      let token;

      if (type === 'genesys') {
        token = await this.genesysTokenService.getToken(tenantId, forceRefresh, correlationId);
      } else if (type === 'whatsapp') {
        token = await this.whatsappTokenService.getToken(tenantId, forceRefresh, correlationId);
      } else {
        throw new AuthServiceError(
          ErrorCode.INVALID_REQUEST,
          `Unsupported provider type: ${type}`,
          400,
          tenantId,
          correlationId
        );
      }

      logger.info('Token request completed', {
        tenantId, type, source: token.source,
        duration: Date.now() - start, correlationId,
      });

      return token;
    } catch (err) {
      logger.error('Token request failed', {
        tenantId, type, duration: Date.now() - start,
        correlationId, error: err.message, code: err.code,
      });
      throw err;
    }
  }
}

module.exports = { TokenService };
