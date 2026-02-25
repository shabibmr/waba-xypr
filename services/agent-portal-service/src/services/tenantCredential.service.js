const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Tenant Credential Service
 * Handles storing and retrieving tenant credentials via Tenant Service API
 */
class TenantCredentialService {
    constructor() {
        this.tenantServiceUrl = config.services.tenantService || 'http://tenant-service:3007';
    }

    /**
     * Store Genesys OAuth credentials for a tenant
     * @param {string} tenantId - Tenant ID
     * @param {Object} credentials - Genesys credentials
     * @param {string} credentials.clientId - OAuth client ID
     * @param {string} credentials.clientSecret - OAuth client secret
     * @param {string} credentials.region - Genesys region
     * @returns {Promise<void>}
     */
    async storeGenesysCredentials(tenantId, credentials) {
        const url = `${this.tenantServiceUrl}/api/tenants/${tenantId}/genesys-credentials`;

        logger.info('Storing Genesys credentials', { tenantId });

        try {
            await axios.put(url, {
                clientId: credentials.clientId,
                clientSecret: credentials.clientSecret,
                region: credentials.region
            }, {
                timeout: 10000
            });

            logger.info('Genesys credentials stored', { tenantId });
        } catch (error) {
            logger.error('Failed to store Genesys credentials', {
                tenantId,
                error: error.message,
                status: error.response?.status
            });
            throw new Error('Failed to store Genesys credentials');
        }
    }

    /**
     * Store Open Messaging integration credentials for a tenant
     * @param {string} tenantId - Tenant ID
     * @param {Object} credentials - Integration credentials
     * @param {string} credentials.integrationId - Genesys integration ID
     * @param {string} credentials.webhookToken - Webhook signature token
     * @param {string} credentials.deploymentId - Widget deployment ID
     * @returns {Promise<void>}
     */
    async storeOpenMessagingCredentials(tenantId, credentials) {
        const url = `${this.tenantServiceUrl}/api/tenants/${tenantId}/credentials`;

        logger.info('Storing Open Messaging credentials', { tenantId });

        try {
            await axios.post(url, {
                type: 'open_messaging',
                credentials: {
                    integrationId: credentials.integrationId,
                    webhookToken: credentials.webhookToken,
                    deploymentId: credentials.deploymentId
                }
            }, {
                timeout: 10000
            });

            logger.info('Open Messaging credentials stored', { tenantId });
        } catch (error) {
            logger.error('Failed to store Open Messaging credentials', {
                tenantId,
                error: error.message,
                status: error.response?.status
            });
            throw new Error('Failed to store Open Messaging credentials');
        }
    }

    /**
     * Retrieve credentials for a tenant by type
     * @param {string} tenantId - Tenant ID
     * @param {string} type - Credential type (e.g., 'genesys', 'open_messaging')
     * @returns {Promise<Object>} Credentials
     */
    async getCredentials(tenantId, type) {
        const url = `${this.tenantServiceUrl}/api/tenants/${tenantId}/credentials/${type}`;

        logger.info('Retrieving credentials', { tenantId, type });

        try {
            const response = await axios.get(url, {
                timeout: 5000
            });

            logger.info('Credentials retrieved', { tenantId, type });

            return response.data;
        } catch (error) {
            logger.error('Failed to retrieve credentials', {
                tenantId,
                type,
                error: error.message,
                status: error.response?.status
            });
            throw new Error(`Failed to retrieve ${type} credentials`);
        }
    }
}

// Export singleton instance
module.exports = new TenantCredentialService();
