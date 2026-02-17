require('dotenv').config();

const { QUEUES } = require('../../../../shared/constants');

const config = {
    port: process.env.PORT || 3008,
    env: process.env.NODE_ENV || 'development',

    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost',
        inputQueue: process.env.QUEUE_INPUT || QUEUES.OUTBOUND_READY,
        dlqQueue: process.env.QUEUE_DLQ || QUEUES.WHATSAPP_API_DLQ,
        prefetch: parseInt(process.env.RABBITMQ_PREFETCH_COUNT || '10'),
        reconnectDelay: 5000,
        maxRetries: parseInt(process.env.MAX_RETRIES || '3')
    },

    whatsapp: {
        graphApiVersion: 'v18.0',
        get graphApiBaseUrl() {
            return `https://graph.facebook.com/${this.graphApiVersion}`;
        }
    },

    services: {
        tenant: {
            url: process.env.TENANT_SERVICE_URL || 'http://tenant-service:3007'
        }
    }
};

module.exports = config;
