/**
 * RabbitMQ Configuration
 * Centralized configuration for RabbitMQ connection and queue settings
 */
// @ts-ignore
import { QUEUES } from '../../../../shared/constants';

export default {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',

    queues: {
        // Existing: WhatsApp inbound messages + status events from State Manager
        inbound: {
            name: QUEUES.INBOUND_ENRICHED,
            options: { durable: true }
        },
        // New: WhatsApp status events from State Manager
        inboundStatusEvents: {
            name: QUEUES.INBOUND_STATUS_EVENTS,
            options: { durable: true }
        },
        // New: Agent Widget Messages
        agentWidgetMessages: {
            name: QUEUES.OUTBOUND_AGENT_WIDGET_MESSAGES,
            options: { durable: true }
        }
    },

    // Output queues
    publish: {
        genesysInboundReadyMsg: QUEUES.GENESYS_INBOUND_READY_MSG,
        statusReady: QUEUES.INBOUND_STATUS_READY,
        agentReady: QUEUES.OUTBOUND_AGENT_READY
    },

    dlq: {
        exchange: 'inbound-transformer-dlx',
        queue: QUEUES.INBOUND_TRANSFORMER_DLQ,
        options: { durable: true }
    },

    consumer: {
        prefetch: 1,
        maxRetries: 3,
        retryDelay: 5000 // 5 seconds (base delay — doubles each retry)
    },

    connection: {
        reconnectDelay: 5000 // 5 seconds
    },

    // Feature flags
    ignoreSentStatus: process.env.IGNORE_SENT_STATUS !== 'false' // Default: true
};
