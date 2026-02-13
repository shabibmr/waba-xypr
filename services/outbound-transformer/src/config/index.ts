import dotenv from 'dotenv';
// @ts-ignore
import { QUEUES } from '../../../../shared/constants';

dotenv.config();

export default {
    port: process.env.PORT || 3003,
    nodeEnv: process.env.NODE_ENV || 'development',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',

    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost',
        inputQueue: process.env.QUEUE_INPUT || QUEUES.OUTBOUND_PROCESSED,
        outputQueue: process.env.QUEUE_OUTPUT || QUEUES.OUTBOUND_READY,
        dlqQueue: process.env.QUEUE_DLQ || QUEUES.OUTBOUND_TRANSFORMER_DLQ,
        exchange: process.env.RABBITMQ_EXCHANGE || 'outbound.exchange',
        prefetch: parseInt(process.env.RABBITMQ_PREFETCH_COUNT || '10'),
    },

    services: {
        stateManager: process.env.STATE_SERVICE_URL || 'http://state-manager:3005',
        tenantService: process.env.TENANT_SERVICE_URL || 'http://tenant-service:3007',
        whatsappService: process.env.WHATSAPP_API_URL || 'http://whatsapp-api-service:3008',
    },

    behavior: {
        unsupportedMime: process.env.UNSUPPORTED_MIME_BEHAVIOR || 'reject',
        audioText: process.env.AUDIO_TEXT_BEHAVIOR || 'separate_message',
    },

    retry: {
        maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    },

    pipelineMode: process.env.PIPELINE_MODE_ENABLED === 'true',

    meta: {
        apiVersion: 'v18.0',
        appSecret: process.env.META_APP_SECRET || '',
    },
};
