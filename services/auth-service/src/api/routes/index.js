const { Router } = require('express');
const { internalServiceAuth } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validation.middleware');
const { tokenRequestSchema } = require('../validators/token.validator');
const { jwtValidationRequestSchema } = require('../validators/jwt.validator');

function createRouter({ tokenController, jwtController, healthController }) {
  const router = Router();

  // Health check — no auth required
  router.get('/health', (req, res) => healthController.getHealth(req, res));

  // All other API routes require internal service auth
  router.use(internalServiceAuth);

  // POST /api/v1/token
  router.post('/token',
    validateBody(tokenRequestSchema),
    (req, res, next) => tokenController.getToken(req, res, next)
  );

  // POST /api/v1/validate/jwt
  router.post('/validate/jwt',
    validateBody(jwtValidationRequestSchema),
    (req, res, next) => jwtController.validateJWT(req, res, next)
  );

  return router;
}

module.exports = { createRouter };
