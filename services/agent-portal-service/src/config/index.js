require('dotenv').config();
const { QUEUES } = require('../../../../shared/constants');

module.exports = {
    port: process.env.PORT || 3015,
    database: {
        connectionString: process.env.DATABASE_URL
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    },
    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
        queues: {
            inboundMessages: QUEUES.INBOUND_WHATSAPP_MESSAGES,
            agentPortalEvents: QUEUES.AGENT_PORTAL_EVENTS,
            agentWidgetMessages: QUEUES.OUTBOUND_AGENT_WIDGET_MESSAGES
        },
        reconnectInterval: 5000
    },
    minio: {
        endpoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000'),
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        bucket: process.env.MINIO_BUCKET || 'waba-media',
        useSSL: process.env.MINIO_USE_SSL === 'true',
        publicUrl: process.env.MINIO_PUBLIC_URL
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'default_secret_change_in_production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },
    genesys: {
        clientId: process.env.GENESYS_CLIENT_ID,
        clientSecret: process.env.GENESYS_CLIENT_SECRET,
        region: process.env.GENESYS_REGION || 'mypurecloud.com',
        redirectUri: process.env.GENESYS_REDIRECT_URI
    },
    services: {
        authService: process.env.AUTH_SERVICE_URL || 'http://localhost:3004',
        tenantService: process.env.TENANT_SERVICE_URL || 'http://localhost:3007',
        agentWidget: process.env.AGENT_WIDGET_URL || 'http://localhost:3012',
        stateManager: process.env.STATE_MANAGER_URL || 'http://localhost:3005',
        whatsappApi: process.env.WHATSAPP_API_URL || 'http://localhost:3008',
        inboundTransformer: process.env.INBOUND_TRANSFORMER_URL || 'http://localhost:3002'
    },
    frontend: {
        url: process.env.AGENT_PORTAL_FRONTEND_URL || 'http://localhost:3314'
    }
};
