/**
 * Shared Library Entry Point
 * Exports all shared utilities and middleware for use across services
 */

module.exports = {
    // Constants
    constants: require('./constants'),
    KEYS: require('./constants/keys'),
    QUEUES: require('./constants/queues'),
    SERVICES: require('./constants/services'),

    // Middleware
    middleware: {
        tenantResolver: require('./middleware/tenantResolver')
    }
};
