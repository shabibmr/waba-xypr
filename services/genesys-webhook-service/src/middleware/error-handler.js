const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    if (res.headersSent) {
        return next(err);
    }

    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: err.status || 500
        }
    });
}

module.exports = errorHandler;
