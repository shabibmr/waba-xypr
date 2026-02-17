const SERVICES = {
    'whatsapp-webhook': process.env.WHATSAPP_WEBHOOK_URL || 'http://whatsapp-webhook:3009',
    'whatsapp-api': process.env.WHATSAPP_API_URL || 'http://whatsapp-api:3008',
    'genesys-webhook': process.env.GENESYS_WEBHOOK_URL || 'http://genesys-webhook:3011',
    'genesys-api': process.env.GENESYS_API_URL || 'http://genesys-api:3010',
    'genesys-api-service': process.env.GENESYS_API_URL || 'http://genesys-api:3010',
    'inbound-transformer': process.env.INBOUND_SERVICE_URL || 'http://inbound-transformer:3002',
    'outbound-transformer': process.env.OUTBOUND_SERVICE_URL || 'http://outbound-transformer:3003',
    'auth-service': process.env.AUTH_SERVICE_URL || 'http://auth-service:3004',
    'state-manager': process.env.STATE_SERVICE_URL || 'http://state-manager:3005',
    'tenant-service': process.env.TENANT_SERVICE_URL || 'http://tenant-service:3007',
    'agent-portal-service': process.env.AGENT_PORTAL_SERVICE_URL || 'http://agent-portal-service:3015',
    'agent-widget': process.env.AGENT_WIDGET_URL || 'http://agent-widget:3012'
};

const CONFIG = {
    port: process.env.PORT || 3000,
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3001',
        'http://localhost:3012',
        'http://localhost:3016',
        'http://localhost:3314',
        'http://localhost:3014',
        'http://localhost:3006'

    ],
    services: SERVICES
};

module.exports = CONFIG;
