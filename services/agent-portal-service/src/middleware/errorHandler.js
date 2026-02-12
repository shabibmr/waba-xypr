const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const ERROR_CODES = require('../utils/errorCodes');

/**
 * Global error handler — FRD Section 10.1
 * Outputs standardized error format:
 * { error: { code, message, details, timestamp, requestId } }
 */
function errorHandler(err, req, res, next) {
    const requestId = req.headers['x-request-id'] || uuidv4();

    logger.error('Error occurred', {
        error: err.message,
        code: err.code,
        stack: err.stack,
        path: req.path,
        method: req.method,
        requestId,
        ip: req.ip
    });

    // 1. AppError — our custom operational errors
    if (err instanceof AppError) {
        return res.status(err.statusCode).json(err.toJSON(requestId));
    }

    // 2. Joi ValidationError
    if (err.isJoi || err.name === 'ValidationError') {
        return res.status(400).json({
            error: {
                code: ERROR_CODES.VALIDATION_001,
                message: 'Validation failed',
                details: err.details || err.message,
                timestamp: new Date().toISOString(),
                requestId
            }
        });
    }

    // 3. JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: {
                code: ERROR_CODES.AUTH_001,
                message: 'Invalid token',
                details: {},
                timestamp: new Date().toISOString(),
                requestId
            }
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: {
                code: ERROR_CODES.AUTH_001,
                message: 'Token expired',
                details: {},
                timestamp: new Date().toISOString(),
                requestId
            }
        });
    }

    // 4. Axios errors (external service failures)
    if (err.isAxiosError) {
        const status = err.response?.status || 502;
        return res.status(status >= 500 ? 502 : status).json({
            error: {
                code: ERROR_CODES.SYSTEM_002,
                message: 'External service error',
                details: {
                    service: err.config?.url,
                    status: err.response?.status,
                    data: err.response?.data
                },
                timestamp: new Date().toISOString(),
                requestId
            }
        });
    }

    // 5. Default — unknown/programming errors
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
        error: {
            code: ERROR_CODES.SYSTEM_001,
            message: process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : err.message || 'Internal server error',
            details: {},
            timestamp: new Date().toISOString(),
            requestId
        }
    });
}

module.exports = errorHandler;
