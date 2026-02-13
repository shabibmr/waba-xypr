const { randomUUID } = require('crypto');

function correlationMiddleware(req, res, next) {
  req.correlationId = req.headers['x-correlation-id'] || randomUUID();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}

module.exports = { correlationMiddleware };
