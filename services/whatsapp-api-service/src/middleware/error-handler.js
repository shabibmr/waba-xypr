/**
 * Centralized Error Handler
 */
const Logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
    const tenantId = req.tenant?.id || 'unknown';

    Logger.error(`Unhandled error in request`, err, {
        tenantId,
        path: req.path,
        method: req.method
    });

    const statusCode = err.status || 500;
    const response = {
        error: err.message || 'Internal Server Error',
        requestId: req.id
    };

    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
        if (err.response?.data) {
            response.externalError = err.response.data;
        }
    }

    res.status(statusCode).json(response);
}

module.exports = { errorHandler };
