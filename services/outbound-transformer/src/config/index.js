require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3003,
    nodeEnv: process.env.NODE_ENV || 'development',

    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost',
        queue: require('../../../../shared/constants').QUEUES.OUTBOUND_GENESYS_MESSAGES,
        prefetch: 1
    },

    services: {
        stateManager: process.env.STATE_SERVICE_URL || 'http://state-manager:3005',
        tenantService: process.env.TENANT_SERVICE_URL || 'http://tenant-service:3007'
    },

    meta: {
        apiVersion: 'v18.0'
        // Note: Access token is now fetched per-tenant from tenant-service
    }
};
