class JWTController {
  constructor(jwtValidatorService) {
    this.jwtValidatorService = jwtValidatorService;
  }

  async validateJWT(req, res, next) {
    const { token, region } = req.body;

    try {
      const result = await this.jwtValidatorService.validate(token, region);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = { JWTController };
