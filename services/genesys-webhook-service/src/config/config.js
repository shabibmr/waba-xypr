require('dotenv').config();

const config = {
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3011,
    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost',
        queues: {
            outbound: require('../../../../shared/constants').QUEUES.OUTBOUND_GENESYS_MESSAGES,
            events: 'genesys-events'
        },
        reconnectInterval: 5000
    },
    services: {
        tenant: {
            url: process.env.TENANT_SERVICE_URL || 'http://tenant-service:3007'
        },
        state: {
            url: process.env.STATE_SERVICE_URL || 'http://state-manager:3005'
        }
    }
};

module.exports = config;
