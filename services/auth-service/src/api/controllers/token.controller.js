class TokenController {
  constructor(tokenService) {
    this.tokenService = tokenService;
  }

  async issueToken(req, res, next) {
    try {
      const result = await this.tokenService.issueUserToken(req.body);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await this.tokenService.refreshUserToken(refreshToken);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getToken(req, res, next) {
    const { tenantId, type, forceRefresh, correlationId: bodyCorrelationId } = req.body;
    const correlationId = req.correlationId || bodyCorrelationId;

    try {
      const result = await this.tokenService.getToken({ tenantId, type, forceRefresh, correlationId });

      return res.status(200).json({
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        tokenType: result.tokenType,
        source: result.source,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = { TokenController };
