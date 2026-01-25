/**
 * External Services Configuration
 * Centralized URLs for all external service dependencies
 */

module.exports = {
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
        baseUrl: process.env.GENESYS_BASE_URL,
        endpoints: {
            newConversation: '/api/v2/conversations/messages',
            existingConversation: (conversationId) => `/api/v2/conversations/messages/${conversationId}/messages`
        }
    }
};
