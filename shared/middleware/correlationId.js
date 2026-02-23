/**
 * Correlation ID Middleware
 *
 * Generates or extracts correlation IDs to trace requests across microservices.
 *
 * Usage:
 *   const { correlationId } = require('../../shared/middleware/correlationId');
 *   app.use(correlationId());
 *
 * The correlation ID is:
 * 1. Extracted from X-Correlation-ID header if present
 * 2. Generated as UUID v4 if not present
 * 3. Attached to req.correlationId
 * 4. Set in response headers
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Correlation ID middleware for Express
 * @param {Object} options - Configuration options
 * @param {string} options.header - Header name (default: 'X-Correlation-ID')
 * @param {boolean} options.setResponseHeader - Set header in response (default: true)
 * @returns {Function} Express middleware function
 */
function correlationId(options = {}) {
    const {
        header = 'X-Correlation-ID',
        setResponseHeader = true
    } = options;

    return (req, res, next) => {
        // Extract or generate correlation ID
        const correlationId = req.headers[header.toLowerCase()] ||
                            req.headers['x-correlation-id'] ||
                            uuidv4();

        // Attach to request object
        req.correlationId = correlationId;

        // Set in response header
        if (setResponseHeader) {
            res.setHeader(header, correlationId);
        }

        next();
    };
}

/**
 * Get correlation ID from request
 * @param {Object} req - Express request object
 * @returns {string|null} Correlation ID or null
 */
function getCorrelationId(req) {
    return req.correlationId || null;
}

/**
 * Attach correlation ID to Axios request config
 * @param {Object} config - Axios config object
 * @param {string} correlationId - Correlation ID to attach
 * @returns {Object} Modified config
 */
function attachToAxios(config, correlationId) {
    if (!config.headers) {
        config.headers = {};
    }
    config.headers['X-Correlation-ID'] = correlationId;
    return config;
}

/**
 * Attach correlation ID to RabbitMQ message payload
 * @param {Object} payload - Message payload
 * @param {string} correlationId - Correlation ID to attach
 * @returns {Object} Modified payload
 */
function attachToRabbitMQ(payload, correlationId) {
    return {
        ...payload,
        correlationId
    };
}

module.exports = {
    correlationId,
    getCorrelationId,
    attachToAxios,
    attachToRabbitMQ
};
