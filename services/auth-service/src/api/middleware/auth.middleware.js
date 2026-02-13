const { timingSafeEqual } = require('crypto');
const logger = require('../../utils/logger');
const config = require('../../config');
const { ErrorCode } = require('../../models/errors');

function internalServiceAuth(req, res, next) {
  // If no secret configured, auth is disabled (dev mode)
  if (!config.internalAuth.secret) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: ErrorCode.INVALID_REQUEST, message: 'Missing or invalid Authorization header' },
    });
  }

  const token = authHeader.substring(7);
  const expected = config.internalAuth.secret;

  // Constant-time comparison to prevent timing attacks
  let valid = false;
  try {
    valid = token.length === expected.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch (_) {
    valid = false;
  }

  if (!valid) {
    logger.warn('Invalid internal service token', {
      correlationId: req.correlationId,
      path: req.path,
    });
    return res.status(401).json({
      error: { code: ErrorCode.INVALID_REQUEST, message: 'Invalid service token' },
    });
  }

  next();
}

module.exports = { internalServiceAuth };
