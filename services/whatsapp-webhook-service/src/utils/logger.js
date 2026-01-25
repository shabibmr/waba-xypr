/**
 * Logging utility
 * Provides structured logging with tenant context
 */

const config = require('../config/config');

class Logger {
    /**
     * Log informational message
     */
    static info(message, data = {}) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [INFO] ${message}`, data);
    }

    /**
     * Log error message
     */
    static error(message, error = null, data = {}) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [ERROR] ${message}`, {
            ...data,
            error: error ? {
                message: error.message,
                stack: config.isDevelopment ? error.stack : undefined
            } : undefined
        });
    }

    /**
     * Log warning message
     */
    static warn(message, data = {}) {
        const timestamp = new Date().toISOString();
        console.warn(`[${timestamp}] [WARN] ${message}`, data);
    }

    /**
     * Log debug message (only in development)
     */
    static debug(message, data = {}) {
        if (config.isDevelopment) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [DEBUG] ${message}`, data);
        }
    }

    /**
     * Create tenant-scoped logger
     */
    static forTenant(tenantId) {
        return {
            info: (message, data = {}) => Logger.info(`[${tenantId}] ${message}`, data),
            error: (message, error = null, data = {}) => Logger.error(`[${tenantId}] ${message}`, error, data),
            warn: (message, data = {}) => Logger.warn(`[${tenantId}] ${message}`, data),
            debug: (message, data = {}) => Logger.debug(`[${tenantId}] ${message}`, data)
        };
    }
}

module.exports = Logger;
