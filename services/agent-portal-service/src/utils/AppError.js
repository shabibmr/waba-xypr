/**
 * Custom application error class following FRD error format.
 * 
 * Usage:
 *   throw new AppError('Invalid credentials', 401, 'AUTH_001', { field: 'password' });
 */
class AppError extends Error {
    /**
     * @param {string} message - Human-readable error message
     * @param {number} statusCode - HTTP status code (default: 500)
     * @param {string} code - Application error code (e.g. 'AUTH_001')
     * @param {object} details - Additional error details
     */
    constructor(message, statusCode = 500, code = 'SYSTEM_001', details = null) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true; // Distinguishes from programming errors

        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Serialize to FRD-compliant error response format.
     * @param {string} requestId - UUID request identifier
     * @returns {object}
     */
    toJSON(requestId) {
        return {
            error: {
                code: this.code,
                message: this.message,
                details: this.details || {},
                timestamp: new Date().toISOString(),
                requestId: requestId || null
            }
        };
    }
}

module.exports = AppError;
