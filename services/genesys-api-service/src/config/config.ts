/**
 * Configuration module
 * Centralizes all environment variables and application configuration
 */

import dotenv from 'dotenv';
dotenv.config();

const config = {
    // Server configuration
    port: process.env.PORT || 3010,

    // External services
    services: {
        tenantService: {
            url: process.env.TENANT_SERVICE_URL || 'http://tenant-service:3007'
        },
        authService: {
            url: process.env.AUTH_SERVICE_URL || 'http://auth-service:3004'
        }
    },

    // RabbitMQ
    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672',
        prefetch: parseInt(process.env.RABBITMQ_PREFETCH || '10', 10)
    },

    // Redis
    redis: {
        url: process.env.REDIS_URL || 'redis://redis:6379'
    },

    // Environment
    env: process.env.NODE_ENV || 'development',
    isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
    isProduction: process.env.NODE_ENV === 'production'
};

/**
 * Validate required configuration
 */
function validateConfig() {
    const warnings = [];

    if (!config.services.tenantService.url) {
        warnings.push('TENANT_SERVICE_URL not configured, using default');
    }

    if (!config.services.authService.url) {
        warnings.push('AUTH_SERVICE_URL not configured, using default');
    }

    if (warnings.length > 0 && config.isDevelopment) {
        console.warn('Configuration warnings:', warnings.join(', '));
    }
}

// Validate on module load
validateConfig();

export default config;
