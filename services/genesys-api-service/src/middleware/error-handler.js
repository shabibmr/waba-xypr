/**
 * Error handler middleware
 * Centralized error handling with consistent formatting
 */

const logger = require('../utils/logger');

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
    const tenantId = req.tenant?.id || null;

    // Log the error
    logger.error(tenantId, 'Error occurred:', err.response?.data || err.message);

    // Determine status code
    const statusCode = err.response?.status || err.statusCode || 500;

    // Send error response
    res.status(statusCode).json({
        error: err.message || 'Internal server error',
        details: err.response?.data || undefined,
        tenantId
    });
}

module.exports = errorHandler;
