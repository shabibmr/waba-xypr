// services/agent-widget/src/config/index.js

require('dotenv').config();

const config = {
    port: process.env.PORT || 3012,
    env: process.env.NODE_ENV || 'development',

    services: {
        agentPortalUrl: process.env.AGENT_PORTAL_SERVICE_URL || 'http://agent-portal-service:3015',
    },

    publicUrl: process.env.PUBLIC_URL || 'http://localhost:3012',
    genesysClientId: process.env.GENESYS_WIDGET_CLIENT_ID || process.env.GENESYS_CLIENT_ID || '',
    genesysRegion: process.env.GENESYS_REGION || 'mypurecloud.com',

    features: {
        messageHistory: true,
        quickTemplates: true,
        customerInfo: true,
        analytics: true
    }
};

module.exports = config;
