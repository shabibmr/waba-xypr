/**
 * Tenant service
 * Handles tenant-related operations
 */

const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Get tenant-specific Genesys credentials
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Genesys credentials with region
 */
async function getTenantGenesysCredentials(tenantId) {
    try {
        const response = await axios.get(
            `${config.services.tenantService.url}/tenants/${tenantId}/genesys/credentials`
        );

        // Return credentials in expected format
        return {
            clientId: response.data.clientId,
            clientSecret: response.data.clientSecret,
            region: response.data.region
        };
    } catch (error) {
        logger.error(tenantId, 'Failed to fetch Genesys credentials:', error.message);
        throw new Error(`Unable to fetch Genesys credentials for tenant ${tenantId}`);
    }
}

module.exports = {
    getTenantGenesysCredentials
};
