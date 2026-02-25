const axios = require('axios');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const ERROR_CODES = require('../utils/errorCodes');

/**
 * Genesys Platform Service
 * Handles all Genesys Cloud Platform API interactions
 * OAuth clients, integrations, deployments, etc.
 */
class GenesysPlatformService {
    /**
     * Build Genesys API URL for a region
     * @param {string} region - Genesys region (e.g., mypurecloud.com)
     * @returns {string} API base URL
     */
    getApiUrl(region) {
        return `https://api.${region}`;
    }

    /**
     * Handle Genesys API errors with appropriate error codes
     * @param {Error} error - Axios error
     * @param {string} context - Operation context
     * @throws {AppError}
     */
    handleError(error, context) {
        logger.error(`Genesys API Error in ${context}:`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });

        if (error.response) {
            if (error.response.status === 403) {
                throw new AppError(
                    'Insufficient Permissions. Your Genesys account must have the appropriate roles (e.g. oauth:client:edit or integrations:integration:edit) to perform this action.',
                    403,
                    ERROR_CODES.OAUTH_003
                );
            }
            if (error.response.status === 401) {
                throw new AppError('Genesys session expired. Please log in again.', 401, ERROR_CODES.AUTH_001);
            }
            throw new AppError(
                error.response.data.message || 'Genesys API Error',
                error.response.status,
                ERROR_CODES.GENESYS_API_ERROR
            );
        }
        throw new AppError('Internal Server Error communicating with Genesys', 500, ERROR_CODES.INTERNAL_001);
    }

    /**
     * Get organization information
     * @param {string} token - Authorization token
     * @param {string} region - Genesys region
     * @returns {Promise<Object>} Organization data
     */
    async getOrganization(token, region) {
        const url = `${this.getApiUrl(region)}/api/v2/organizations/me`;

        logger.info('Fetching Genesys organization', { region });

        try {
            const response = await axios.get(url, {
                headers: { Authorization: token },
                timeout: 10000
            });

            logger.info('Organization retrieved', {
                orgId: response.data.id,
                name: response.data.name
            });

            return {
                id: response.data.id,
                name: response.data.name,
                thirdPartyOrgName: response.data.thirdPartyOrgName,
                domain: response.data.domain,
                state: response.data.state
            };
        } catch (error) {
            throw this.handleError(error, 'getOrganization');
        }
    }

    /**
     * List OAuth clients
     * @param {string} token - Authorization token
     * @param {string} region - Genesys region
     * @returns {Promise<Array>} List of OAuth clients
     */
    async listOAuthClients(token, region) {
        const url = `${this.getApiUrl(region)}/api/v2/oauth/clients`;

        logger.info('Fetching OAuth clients', { region });

        try {
            const response = await axios.get(url, {
                headers: { Authorization: token },
                timeout: 10000
            });

            const filteredClients = response.data.entities.map(client => ({
                id: client.id,
                name: client.name,
                description: client.description,
                authorizedGrantType: client.authorizedGrantType,
                dateCreated: client.dateCreated,
                state: client.state
            }));

            logger.info('OAuth clients retrieved', { count: filteredClients.length });

            return filteredClients;
        } catch (error) {
            throw this.handleError(error, 'listOAuthClients');
        }
    }

    /**
     * Get OAuth client by ID
     * @param {string} token - Authorization token
     * @param {string} region - Genesys region
     * @param {string} clientId - OAuth client ID
     * @returns {Promise<Object>} OAuth client data
     */
    async getOAuthClient(token, region, clientId) {
        const url = `${this.getApiUrl(region)}/api/v2/oauth/clients/${clientId}`;

        logger.info('Fetching OAuth client', { clientId, region });

        try {
            const response = await axios.get(url, {
                headers: { Authorization: token },
                timeout: 10000
            });

            logger.info('OAuth client retrieved', { clientId });

            return {
                id: response.data.id,
                name: response.data.name,
                description: response.data.description,
                authorizedGrantType: response.data.authorizedGrantType,
                roleIds: response.data.roleIds,
                dateCreated: response.data.dateCreated
            };
        } catch (error) {
            throw this.handleError(error, 'getOAuthClient');
        }
    }

    /**
     * Create OAuth client
     * @param {string} token - Authorization token
     * @param {string} region - Genesys region
     * @param {Object} payload - Client configuration
     * @returns {Promise<Object>} Created client data (includes secret!)
     */
    async createOAuthClient(token, region, payload) {
        const url = `${this.getApiUrl(region)}/api/v2/oauth/clients`;

        logger.info('Creating OAuth client', { name: payload.name, region });

        try {
            const response = await axios.post(url, payload, {
                headers: { Authorization: token },
                timeout: 10000
            });

            logger.info('OAuth client created', {
                clientId: response.data.id,
                name: response.data.name
            });

            return {
                id: response.data.id,
                name: response.data.name,
                secret: response.data.secret // IMPORTANT: Only returned on creation
            };
        } catch (error) {
            throw this.handleError(error, 'createOAuthClient');
        }
    }

    /**
     * List integrations
     * @param {string} token - Authorization token
     * @param {string} region - Genesys region
     * @param {string} filterType - Filter by integration type (optional)
     * @returns {Promise<Array>} List of integrations
     */
    async listIntegrations(token, region, filterType = null) {
        const url = `${this.getApiUrl(region)}/api/v2/integrations`;

        logger.info('Fetching integrations', { region, filterType });

        try {
            const response = await axios.get(url, {
                headers: { Authorization: token },
                timeout: 10000
            });

            let integrations = response.data.entities;

            // Filter by type if specified
            if (filterType) {
                integrations = integrations.filter(i => i.integrationType?.id === filterType);
            }

            logger.info('Integrations retrieved', { count: integrations.length });

            return integrations;
        } catch (error) {
            throw this.handleError(error, 'listIntegrations');
        }
    }

    /**
     * Create Open Messaging integration
     * @param {string} token - Authorization token
     * @param {string} region - Genesys region
     * @param {string} name - Integration name
     * @returns {Promise<string>} Integration ID
     */
    async createIntegration(token, region, name) {
        const url = `${this.getApiUrl(region)}/api/v2/integrations`;

        const payload = {
            body: {
                name: name,
                integrationType: { id: "open-messaging" }
            }
        };

        logger.info('Creating Open Messaging integration', { name, region });

        try {
            const response = await axios.post(url, payload, {
                headers: { Authorization: token },
                timeout: 10000
            });

            const integrationId = response.data.id;

            logger.info('Integration created', { integrationId, name });

            return integrationId;
        } catch (error) {
            throw this.handleError(error, 'createIntegration');
        }
    }

    /**
     * Configure webhook for integration
     * @param {string} token - Authorization token
     * @param {string} region - Genesys region
     * @param {string} integrationId - Integration ID
     * @param {Object} config - Webhook configuration
     * @returns {Promise<void>}
     */
    async configureWebhook(token, region, integrationId, config) {
        const url = `${this.getApiUrl(region)}/api/v2/integrations/${integrationId}/config/current`;

        const payload = {
            properties: {
                outboundNotificationWebhookUrl: config.webhookUrl,
                outboundNotificationWebhookSignatureSecretToken: config.webhookToken
            }
        };

        logger.info('Configuring webhook', { integrationId });

        try {
            await axios.put(url, payload, {
                headers: { Authorization: token },
                timeout: 10000
            });

            logger.info('Webhook configured', { integrationId });
        } catch (error) {
            throw this.handleError(error, 'configureWebhook');
        }
    }

    /**
     * Enable integration
     * @param {string} token - Authorization token
     * @param {string} region - Genesys region
     * @param {string} integrationId - Integration ID
     * @returns {Promise<void>}
     */
    async enableIntegration(token, region, integrationId) {
        const url = `${this.getApiUrl(region)}/api/v2/integrations/${integrationId}`;

        const payload = { intendedState: "ENABLED" };

        logger.info('Enabling integration', { integrationId });

        try {
            await axios.patch(url, payload, {
                headers: { Authorization: token },
                timeout: 10000
            });

            logger.info('Integration enabled', { integrationId });
        } catch (error) {
            throw this.handleError(error, 'enableIntegration');
        }
    }

    /**
     * Create Web Messaging Deployment (for agent widget)
     * @param {string} token - Authorization token
     * @param {string} region - Genesys region
     * @param {Object} config - Deployment configuration
     * @returns {Promise<string>} Deployment ID
     */
    async createWidgetDeployment(token, region, config) {
        const url = `${this.getApiUrl(region)}/api/v2/widgets/deployments`;

        const payload = {
            name: config.name,
            description: config.description || "Auto-generated for Agent Widget",
            allowAllDomains: config.allowAllDomains !== false, // Default true
            status: "Active"
        };

        logger.info('Creating widget deployment', { name: config.name, region });

        try {
            const response = await axios.post(url, payload, {
                headers: { Authorization: token },
                timeout: 10000
            });

            const deploymentId = response.data.id;

            logger.info('Widget deployment created', { deploymentId });

            return deploymentId;
        } catch (error) {
            throw this.handleError(error, 'createWidgetDeployment');
        }
    }

    /**
     * Provision complete Open Messaging setup
     * Orchestrates: integration creation, webhook config, enablement, widget deployment
     * @param {string} token - Authorization token
     * @param {string} region - Genesys region
     * @param {Object} config - Complete provisioning config
     * @returns {Promise<Object>} Integration and deployment IDs with webhook token
     */
    async provisionOpenMessaging(token, region, config) {
        logger.info('Starting Open Messaging provisioning', {
            name: config.name,
            region
        });

        try {
            // 1. Create integration
            const integrationId = await this.createIntegration(token, region, config.name);

            // 2. Configure webhook
            await this.configureWebhook(token, region, integrationId, {
                webhookUrl: config.webhookUrl,
                webhookToken: config.webhookToken
            });

            // 3. Enable integration
            await this.enableIntegration(token, region, integrationId);

            // 4. Create widget deployment
            const deploymentId = await this.createWidgetDeployment(token, region, {
                name: `${config.name} Widget Deployment`,
                allowAllDomains: config.allowAllDomains
            });

            logger.info('Open Messaging provisioning complete', {
                integrationId,
                deploymentId
            });

            return {
                integrationId,
                deploymentId,
                webhookToken: config.webhookToken
            };
        } catch (error) {
            logger.error('Open Messaging provisioning failed', {
                error: error.message,
                name: config.name
            });
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new GenesysPlatformService();
