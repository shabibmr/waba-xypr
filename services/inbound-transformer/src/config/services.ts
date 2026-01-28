/**
 * External Services Configuration
 * Centralized URLs for all external service dependencies
 */

export default {
    stateManager: {
        url: process.env.STATE_SERVICE_URL || 'http://state-manager:3005',
        endpoints: {
            mapping: '/state/mapping',
            message: '/state/message'
        }
    },

    authService: {
        url: process.env.AUTH_SERVICE_URL || 'http://auth-service:3004',
        endpoints: {
            token: '/auth/token'
        }
    },

    genesys: {
        baseUrl: process.env.GENESYS_API_URL || 'http://genesys-api:3010',
        endpoints: {
            sendMessage: '/genesys/messages/inbound'
        }
    }
};
