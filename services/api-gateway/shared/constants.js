const SERVICES = {
    WEBHOOK_HANDLER: {
        url: 'http://webhook-handler:3001',
        name: 'Webhook Handler'
    },
    INBOUND_TRANSFORMER: {
        url: 'http://inbound-transformer:3002',
        name: 'Inbound Transformer'
    },
    OUTBOUND_TRANSFORMER: {
        url: 'http://outbound-transformer:3003',
        name: 'Outbound Transformer'
    },
    AUTH_SERVICE: {
        url: 'http://auth-service:3004',
        name: 'Auth Service'
    },
    STATE_MANAGER: {
        url: 'http://state-manager:3005',
        name: 'State Manager'
    },
    // Note: Tenant service is on port 3007
    TENANT_SERVICE: {
        url: 'http://tenant-service:3007',
        name: 'Tenant Service'
    },
    WHATSAPP_API: {
        url: 'http://whatsapp-api:3008',
        name: 'WhatsApp API'
    },
    WHATSAPP_WEBHOOK: {
        url: 'http://whatsapp-webhook:3009',
        name: 'WhatsApp Webhook'
    },
    GENESYS_API: {
        url: 'http://genesys-api:3010',
        name: 'Genesys API'
    },
    GENESYS_WEBHOOK: {
        url: 'http://genesys-webhook:3011',
        name: 'Genesys Webhook'
    },
    AGENT_PORTAL_SERVICE: {
        url: 'http://agent-portal-service:3015',
        name: 'Agent Portal Service'
    }
};

module.exports = { SERVICES };
