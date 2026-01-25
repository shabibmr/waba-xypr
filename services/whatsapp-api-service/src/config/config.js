/**
 * Configuration module
 */
require('dotenv').config();

const config = {
    port: process.env.PORT || 3008,
    env: process.env.NODE_ENV || 'development',

    services: {
        tenant: {
            url: process.env.TENANT_SERVICE_URL || 'http://tenant-service:3007'
        }
    },

    whatsapp: {
        graphApiVersion: 'v18.0',
        get graphApiBaseUrl() {
            return `https://graph.facebook.com/${this.graphApiVersion}`;
        }
    }
};

module.exports = config;
