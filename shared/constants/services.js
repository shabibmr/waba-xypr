/**
 * Shared Service Configuration
 * Default ports and URLs for microservices
 */

const SERVICES = {
    API_GATEWAY: {
        name: 'api-gateway',
        port: 3000,
        url: 'http://api-gateway:3000'
    },
    WEBHOOK_HANDLER: {
        name: 'webhook-handler',
        port: 3001,
        url: 'http://webhook-handler:3001'
    },
    INBOUND_TRANSFORMER: {
        name: 'inbound-transformer',
        port: 3002,
        url: 'http://inbound-transformer:3002'
    },
    OUTBOUND_TRANSFORMER: {
        name: 'outbound-transformer',
        port: 3003,
        url: 'http://outbound-transformer:3003'
    },
    AUTH_SERVICE: {
        name: 'auth-service',
        port: 3004,
        url: 'http://auth-service:3004'
    },
    STATE_MANAGER: {
        name: 'state-manager',
        port: 3005,
        url: 'http://state-manager:3005'
    },
    ADMIN_DASHBOARD: {
        name: 'admin-dashboard',
        port: 3006,
        url: 'http://admin-dashboard:80'
    },
    TENANT_SERVICE: {
        name: 'tenant-service',
        port: 3007,
        url: 'http://tenant-service:3007'
    },
    WHATSAPP_API: {
        name: 'whatsapp-api-service',
        port: 3008,
        url: 'http://whatsapp-api-service:3008'
    },
    WHATSAPP_WEBHOOK: {
        name: 'whatsapp-webhook-service',
        port: 3009,
        url: 'http://whatsapp-webhook-service:3009'
    },
    GENESYS_API: {
        name: 'genesys-api-service',
        port: 3010,
        url: 'http://genesys-api-service:3010'
    },
    GENESYS_WEBHOOK: {
        name: 'genesys-webhook-service',
        port: 3011,
        url: 'http://genesys-webhook-service:3011'
    },
    AGENT_WIDGET: {
        name: 'agent-widget',
        port: 3012,
        url: 'http://agent-widget:3012'
    }
};

module.exports = SERVICES;
