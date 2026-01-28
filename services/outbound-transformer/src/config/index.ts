import dotenv from 'dotenv';
// @ts-ignore
import { QUEUES } from '../../../../shared/constants';

dotenv.config();

export default {
    port: process.env.PORT || 3003,
    nodeEnv: process.env.NODE_ENV || 'development',

    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost',
        queue: QUEUES.OUTBOUND_GENESYS_MESSAGES,
        prefetch: 1
    },

    services: {
        stateManager: process.env.STATE_SERVICE_URL || 'http://state-manager:3005',
        tenantService: process.env.TENANT_SERVICE_URL || 'http://tenant-service:3007',
        whatsappService: process.env.WHATSAPP_API_URL || 'http://whatsapp-api:3008'
    },

    meta: {
        apiVersion: 'v18.0',
        appSecret: process.env.META_APP_SECRET || ''
        // Note: Access token is now fetched per-tenant from tenant-service
    }
};
