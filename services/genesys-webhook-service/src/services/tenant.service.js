const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

class TenantService {
    async resolveTenant(conversationId, integrationId) {
        try {
            // 1. Try to get from state manager using conversation ID
            if (conversationId) {
                try {
                    const response = await axios.get(
                        `${config.services.state.url}/state/conversation/${conversationId}/tenant`
                    );
                    if (response.data && response.data.tenantId) {
                        return response.data.tenantId;
                    }
                } catch (error) {
                    // Ignore 404s from state manager, try next method
                    if (error.response?.status !== 404) {
                        logger.warn('State manager tenant resolution failed', { error: error.message });
                    }
                }
            }

            // 2. Fallback: resolve from integration ID
            if (integrationId) {
                try {
                    const response = await axios.get(
                        `${config.services.tenant.url}/tenants/by-integration/${integrationId}`
                    );
                    return response.data.tenantId;
                } catch (error) {
                    logger.warn('Integration ID tenant resolution failed', { error: error.message });
                }
            }

            return null;
        } catch (error) {
            logger.error('Tenant resolution error:', error);
            return null;
        }
    }
    async getTenantWebhookSecret(tenantId) {
        try {
            const response = await axios.get(
                `${config.services.tenant.url}/tenants/${tenantId}/credentials/genesys`
            );
            return response.data?.webhookSecret;
        } catch (error) {
            logger.error({ tenantId, error: error.message }, 'Failed to fetch Genesys webhook secret');
            return null;
        }
    }
}

module.exports = new TenantService();
