/**
 * Error Handler Middleware
 * Centralized error handling for Express application
 */

const Logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
    Logger.error('Unhandled error in request', err, {
        method: req.method,
        path: req.path,
        body: req.body
    });

    // Don't send error details in production
    const errorResponse = {
        error: 'Internal server error'
    };

    if (config.isDevelopment) {
        errorResponse.message = err.message;
        errorResponse.stack = err.stack;
    }

    res.status(err.status || 500).json(errorResponse);
}

/**
 * 404 handler
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        error: 'Not found',
        path: req.path
    });
}

module.exports = {
    errorHandler,
    notFoundHandler
};
