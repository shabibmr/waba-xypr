/**
 * Tenant Service
 * Handles tenant resolution and credential retrieval
 */

const axios = require('axios');
const config = require('../config/config');
const Logger = require('../utils/logger');

class TenantService {
    /**
     * Get tenant ID from phone number ID
     * @param {string} phoneNumberId - WhatsApp phone number ID
     * @returns {Promise<string|null>} Tenant ID or null if not found
     */
    async getTenantFromPhoneNumberId(phoneNumberId) {
        try {
            const response = await axios.get(
                `${config.services.tenantService.url}/tenants/by-phone/${phoneNumberId}`
            );
            return response.data.tenantId;
        } catch (error) {
            Logger.error('Failed to resolve tenant', error, { phoneNumberId });
            return null;
        }
    }

    /**
     * Get tenant Meta credentials (app secret)
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<Object>} Credentials object with appSecret
     */
    async getTenantMetaCredentials(tenantId) {
        try {
            const response = await axios.get(
                `${config.services.tenantService.url}/tenants/${tenantId}/credentials/meta`
            );
            return response.data;
        } catch (error) {
            Logger.error(`Failed to retrieve credentials for tenant ${tenantId}`, error);
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new TenantService();
