const SHARED_SERVICES = require('../../shared/constants').SERVICES;

const SERVICES = {
    'webhook-handler': process.env.WEBHOOK_SERVICE_URL || SHARED_SERVICES.WEBHOOK_HANDLER.url,
    'inbound-transformer': process.env.INBOUND_SERVICE_URL || SHARED_SERVICES.INBOUND_TRANSFORMER.url,
    'outbound-transformer': process.env.OUTBOUND_SERVICE_URL || SHARED_SERVICES.OUTBOUND_TRANSFORMER.url,
    'auth-service': process.env.AUTH_SERVICE_URL || SHARED_SERVICES.AUTH_SERVICE.url,
    'state-manager': process.env.STATE_SERVICE_URL || SHARED_SERVICES.STATE_MANAGER.url,
    'tenant-service': process.env.TENANT_SERVICE_URL || 'http://tenant-service:3006',
    'agent-portal-service': process.env.AGENT_PORTAL_SERVICE_URL || 'http://agent-portal-service:3015',
    'genesys-api-service': process.env.GENESYS_API_URL || 'http://genesys-api:3010'
};

const CONFIG = {
    port: process.env.PORT || 3000,
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
    services: SERVICES
};

module.exports = CONFIG;
