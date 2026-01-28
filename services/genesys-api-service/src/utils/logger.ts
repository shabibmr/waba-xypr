/**
 * Logging utility
 * Provides structured logging with tenant context
 */

/**
 * Logging utility
 * Provides structured logging with tenant context
 */

// @ts-ignore
import config from '../config/config';

/**
 * Log info message with tenant context
 */
export function info(tenantId: string | null, message: string, ...args: any[]) {
    const prefix = tenantId ? `[${tenantId}]` : '';
    console.log(`${prefix} ${message}`, ...args);
}

/**
 * Log error message with tenant context
 */
export function error(tenantId: string | null, message: string, ...args: any[]) {
    const prefix = tenantId ? `[${tenantId}]` : '';
    console.error(`${prefix} ${message}`, ...args);
}

/**
 * Log warning message with tenant context
 */
export function warn(tenantId: string | null, message: string, ...args: any[]) {
    const prefix = tenantId ? `[${tenantId}]` : '';
    console.warn(`${prefix} ${message}`, ...args);
}

/**
 * Log debug message (only in development)
 */
export function debug(tenantId: string | null, message: string, ...args: any[]) {
    if (config.isDevelopment) {
        const prefix = tenantId ? `[${tenantId}]` : '';
        console.debug(`${prefix} [DEBUG] ${message}`, ...args);
    }
}
