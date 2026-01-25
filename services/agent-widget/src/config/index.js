// services/agent-widget/src/config/index.js

require('dotenv').config();

const config = {
    port: process.env.PORT || 3012,
    env: process.env.NODE_ENV || 'development',

    services: {
        stateManagerUrl: process.env.STATE_SERVICE_URL || 'http://state-manager:3005',
        whatsappApiUrl: process.env.WHATSAPP_API_URL || 'http://whatsapp-api:3008'
    },

    publicUrl: process.env.PUBLIC_URL || 'http://localhost:3012',

    features: {
        messageHistory: true,
        quickTemplates: true,
        customerInfo: true,
        analytics: true
    }
};

module.exports = config;
