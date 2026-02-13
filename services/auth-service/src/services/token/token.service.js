const logger = require('../../utils/logger');
const { AuthServiceError, ErrorCode } = require('../../models/errors');

class TokenService {
  constructor(genesysTokenService, whatsappTokenService) {
    this.genesysTokenService = genesysTokenService;
    this.whatsappTokenService = whatsappTokenService;
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
