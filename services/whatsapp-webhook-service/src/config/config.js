/**
 * Configuration module
 * Centralizes all environment variables and application configuration
 */

require('dotenv').config();

const config = {
    // Server configuration
    port: process.env.PORT || 3009,

    // RabbitMQ configuration
    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost',
        queues: {
            inboundMessages: require('../../../../shared/constants').QUEUES.INBOUND_WHATSAPP_MESSAGES,
            statusUpdates: require('../../../../shared/constants').QUEUES.WHATSAPP_STATUS_UPDATES,
            templateStatusUpdates: require('../../../../shared/constants').QUEUES.TEMPLATE_STATUS_UPDATES
        },
        reconnectInterval: 5000
    },

    // MinIO configuration
    minio: {
        endpoint: process.env.MINIO_ENDPOINT || 'minio',
        port: parseInt(process.env.MINIO_PORT || '9000'),
        accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
        secretKey: process.env.MINIO_SECRET_KEY || 'admin123',
        bucket: process.env.MINIO_BUCKET || 'whatsapp-media',
        useSSL: process.env.MINIO_USE_SSL === 'true',
        publicUrl: process.env.MINIO_PUBLIC_URL
    },

    // Meta/WhatsApp configuration
    meta: {
        verifyToken: process.env.META_VERIFY_TOKEN
    },

    // External services
    services: {
        tenantService: {
            url: process.env.TENANT_SERVICE_URL || 'http://tenant-service:3007'
        }
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
    const required = [
        { key: 'META_VERIFY_TOKEN', value: config.meta.verifyToken }
    ];

    const missing = required.filter(item => !item.value);

    if (missing.length > 0) {
        const missingKeys = missing.map(item => item.key).join(', ');
        throw new Error(`Missing required environment variables: ${missingKeys}`);
    }
}

// Validate on module load
validateConfig();

module.exports = config;
