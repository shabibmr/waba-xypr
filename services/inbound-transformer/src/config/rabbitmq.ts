/**
 * RabbitMQ Configuration
 * Centralized configuration for RabbitMQ connection and queue settings
 */
// @ts-ignore
import { QUEUES } from '../../../../shared/constants';

export default {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',

    queues: {
        inbound: {
            name: QUEUES.INBOUND_WHATSAPP_MESSAGES,
            options: {
                durable: true
            }
        }
    },

    dlq: {
        exchange: 'inbound-transformer-dlx',
        queue: 'inbound-transformer-dead',
        options: { durable: true }
    },

    consumer: {
        prefetch: 1,
        maxRetries: 3,
        retryDelay: 5000 // 5 seconds (base delay — doubles each retry)
    },

    connection: {
        reconnectDelay: 5000 // 5 seconds
    }
};
