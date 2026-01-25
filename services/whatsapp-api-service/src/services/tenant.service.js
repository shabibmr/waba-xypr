/**
 * Tenant Service
 * Handles interactions with the Tenant management service
 */
const axios = require('axios');
const config = require('../config/config');
const Logger = require('../utils/logger');

class TenantService {
    /**
     * Get WhatsApp credentials for a specific tenant
     * @param {string} tenantId 
     * @returns {Promise<Object>} Credentials object { accessToken, phoneNumberId, wabaId }
     */
    async getWhatsAppCredentials(tenantId) {
        try {
            const url = `${config.services.tenant.url}/tenants/${tenantId}/credentials/meta`;
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            Logger.error(`Failed to fetch credentials for tenant`, error, { tenantId });
            throw new Error(`Failed to retrieve tenant credentials: ${error.message}`);
        }
    }
}

module.exports = new TenantService();
