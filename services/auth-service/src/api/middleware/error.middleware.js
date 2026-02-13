const logger = require('../../utils/logger');
const { AuthServiceError } = require('../../models/errors');

function errorMiddleware(err, req, res, next) {
  const correlationId = req.correlationId;

  if (err instanceof AuthServiceError) {
    const logFn = err.statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
    logFn('Request failed', {
      code: err.code,
      statusCode: err.statusCode,
      tenantId: err.tenantId,
      correlationId,
      message: err.message,
    });

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
        tenantId: err.tenantId,
        correlationId,
      },
    });
  }

  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    correlationId,
    path: req.path,
    method: req.method,
  });

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      correlationId,
    },
  });
}

module.exports = { errorMiddleware };
