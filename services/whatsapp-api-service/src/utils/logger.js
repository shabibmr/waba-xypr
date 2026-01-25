/**
 * Logger Utility
 */
const config = require('../config/config');

class Logger {
    static info(message, meta = {}) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [INFO] ${message}`, meta);
    }

    static error(message, error = null, meta = {}) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [ERROR] ${message}`, {
            ...meta,
            error: error ? (error.response?.data || error.message) : undefined
        });
    }

    static warn(message, meta = {}) {
        const timestamp = new Date().toISOString();
        console.warn(`[${timestamp}] [WARN] ${message}`, meta);
    }

    static debug(message, meta = {}) {
        if (config.env === 'development') {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [DEBUG] ${message}`, meta);
        }
    }

    // Create a logger instance bound to a tenant
    static forTenant(tenantId) {
        return {
            info: (message, meta) => Logger.info(`[${tenantId}] ${message}`, meta),
            error: (message, error, meta) => Logger.error(`[${tenantId}] ${message}`, error, meta),
            warn: (message, meta) => Logger.warn(`[${tenantId}] ${message}`, meta),
            debug: (message, meta) => Logger.debug(`[${tenantId}] ${message}`, meta)
        };
    }
}

module.exports = Logger;
