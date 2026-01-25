/**
 * Logging utility
 * Provides structured logging with tenant context
 */

const config = require('../config/config');

/**
 * Log info message with tenant context
 */
function info(tenantId, message, ...args) {
    const prefix = tenantId ? `[${tenantId}]` : '';
    console.log(`${prefix} ${message}`, ...args);
}

/**
 * Log error message with tenant context
 */
function error(tenantId, message, ...args) {
    const prefix = tenantId ? `[${tenantId}]` : '';
    console.error(`${prefix} ${message}`, ...args);
}

/**
 * Log warning message with tenant context
 */
function warn(tenantId, message, ...args) {
    const prefix = tenantId ? `[${tenantId}]` : '';
    console.warn(`${prefix} ${message}`, ...args);
}

/**
 * Log debug message (only in development)
 */
function debug(tenantId, message, ...args) {
    if (config.isDevelopment) {
        const prefix = tenantId ? `[${tenantId}]` : '';
        console.debug(`${prefix} [DEBUG] ${message}`, ...args);
    }
}

module.exports = {
    info,
    error,
    warn,
    debug
};
