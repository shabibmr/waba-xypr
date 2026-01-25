/**
 * RabbitMQ Configuration
 * Centralized configuration for RabbitMQ connection and queue settings
 */

module.exports = {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',

    queues: {
        inbound: {
            name: require('../../../../shared/constants').QUEUES.INBOUND_WHATSAPP_MESSAGES,
            options: {
                durable: true
            }
        }
    },

    consumer: {
        prefetch: 1,
        retryDelay: 5000 // 5 seconds
    },

    connection: {
        reconnectDelay: 5000 // 5 seconds
    }
};
