/**
 * Authentication service
 * Handles authentication operations
 */

const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Get OAuth token for tenant
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<string>} OAuth token
 */
async function getAuthToken(tenantId) {
    try {
        const response = await axios.get(
            `${config.services.authService.url}/auth/token`,
            {
                headers: {
                    'X-Tenant-ID': tenantId
                }
            }
        );
        return response.data.token;
    } catch (error) {
        logger.error(tenantId, 'Failed to fetch auth token:', error.message);
        throw error;
    }
}

module.exports = {
    getAuthToken
};
