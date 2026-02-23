const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const ERROR_CODES = require('../utils/errorCodes');

function getGenesysApiUrl(region) {
    return `https://api.${region}`;
}

function handleGenesysError(error, context) {
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
        throw new AppError(error.response.data.message || 'Genesys API Error', error.response.status, ERROR_CODES.GENESYS_API_ERROR);
    }
    throw new AppError('Internal Server Error communicating with Genesys', 500, ERROR_CODES.INTERNAL_001);
}

const getOrganizationMe = async (req, res, next) => {
    try {
        const token = req.headers.authorization;
        const region = req.user?.genesysRegion || 'mypurecloud.com'; // Default region if not found

        const response = await axios.get(`${getGenesysApiUrl(region)}/api/v2/organizations/me`, {
            headers: { Authorization: token }
        });

        res.json({
            id: response.data.id,
            name: response.data.name,
            thirdPartyOrgName: response.data.thirdPartyOrgName,
            domain: response.data.domain,
            state: response.data.state,
        });
    } catch (error) {
        next(handleGenesysError(error, 'getOrganizationMe'));
    }
};

const listOAuthClients = async (req, res, next) => {
    try {
        const token = req.headers.authorization;
        const region = req.user?.genesysRegion || 'mypurecloud.com';

        const response = await axios.get(`${getGenesysApiUrl(region)}/api/v2/oauth/clients`, {
            headers: { Authorization: token }
        });

        const filteredClients = response.data.entities.map(client => ({
            id: client.id,
            name: client.name,
            description: client.description,
            authorizedGrantType: client.authorizedGrantType,
            dateCreated: client.dateCreated,
            state: client.state
        }));

        res.json({ entities: filteredClients });
    } catch (error) {
        next(handleGenesysError(error, 'listOAuthClients'));
    }
};

const getOAuthClient = async (req, res, next) => {
    try {
        const token = req.headers.authorization;
        const region = req.user?.genesysRegion || 'mypurecloud.com';
        const clientId = req.params.clientId;

        const response = await axios.get(`${getGenesysApiUrl(region)}/api/v2/oauth/clients/${clientId}`, {
            headers: { Authorization: token }
        });

        res.json({
            id: response.data.id,
            name: response.data.name,
            description: response.data.description,
            authorizedGrantType: response.data.authorizedGrantType,
            roleIds: response.data.roleIds,
            dateCreated: response.data.dateCreated,
        });
    } catch (error) {
        next(handleGenesysError(error, 'getOAuthClient'));
    }
};

const createOAuthClient = async (req, res, next) => {
    try {
        const token = req.headers.authorization;
        const region = req.user?.genesysRegion || 'mypurecloud.com';
        const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

        if (!tenantId) {
            throw new AppError('Tenant ID is required', 400, ERROR_CODES.VALIDATION_001);
        }

        const payload = {
            name: req.body.name,
            description: req.body.description || 'Middleware OAuth Client',
            authorizedGrantType: 'CLIENT_CREDENTIALS',
            accessTokenValiditySeconds: 86400,
            roleIds: req.body.roleIds || undefined // Optional: genesys may error if role doesn't exist.
        };

        const response = await axios.post(`${getGenesysApiUrl(region)}/api/v2/oauth/clients`, payload, {
            headers: { Authorization: token }
        });

        const clientData = response.data;

        // Securely store credentials in Tenant Service
        const tenantServiceUrl = config.services.tenantService || 'http://tenant-service:3007';
        await axios.put(
            `${tenantServiceUrl}/api/tenants/${tenantId}/genesys-credentials`,
            {
                clientId: clientData.id,
                clientSecret: clientData.secret,
                region: region
            }
        );

        // Return client ID only to frontend
        res.status(201).json({
            id: clientData.id,
            name: clientData.name,
            status: 'Stored securely'
        });
    } catch (error) {
        next(handleGenesysError(error, 'createOAuthClient'));
    }
};

const listIntegrations = async (req, res, next) => {
    try {
        const token = req.headers.authorization;
        const region = req.user?.genesysRegion || 'mypurecloud.com';

        let url = `${getGenesysApiUrl(region)}/api/v2/integrations`;

        const response = await axios.get(url, {
            headers: { Authorization: token }
        });

        // Filter for open-messaging integrations conceptually
        const openMessaging = response.data.entities.filter(i => i.integrationType?.id === 'open-messaging');

        res.json({ entities: openMessaging });
    } catch (error) {
        next(handleGenesysError(error, 'listIntegrations'));
    }
};

const provisionMessaging = async (req, res, next) => {
    try {
        const token = req.headers.authorization;
        const region = req.user?.genesysRegion || 'mypurecloud.com';
        const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
        const { name, webhookUrl } = req.body;

        if (!tenantId) {
            throw new AppError('Tenant ID is required', 400, ERROR_CODES.VALIDATION_001);
        }

        // 1. Create Open Messaging Integration
        const integrationPayload = {
            body: {
                name: name,
                integrationType: { id: "open-messaging" }
            }
        };

        const intResponse = await axios.post(`${getGenesysApiUrl(region)}/api/v2/integrations`, integrationPayload, {
            headers: { Authorization: token }
        });
        const integrationId = intResponse.data.id;

        // 2. Configure the webhook
        const crypto = require('crypto');
        const webhookToken = crypto.randomBytes(32).toString('hex');

        const configPayload = {
            properties: {
                outboundNotificationWebhookUrl: webhookUrl,
                outboundNotificationWebhookSignatureSecretToken: webhookToken
            }
        };

        await axios.put(`${getGenesysApiUrl(region)}/api/v2/integrations/${integrationId}/config/current`, configPayload, {
            headers: { Authorization: token }
        });

        // 3. Enable the integration
        await axios.patch(`${getGenesysApiUrl(region)}/api/v2/integrations/${integrationId}`, { intendedState: "ENABLED" }, {
            headers: { Authorization: token }
        });

        // 4. Create Web Messaging Deployment for the Widget
        const deploymentPayload = {
            name: `${name} Widget Deployment`,
            description: "Auto-generated for Agent Widget",
            allowAllDomains: true, // Typically should restrict domains in prod!
            status: "Active"
        };

        const deployResponse = await axios.post(`${getGenesysApiUrl(region)}/api/v2/widgets/deployments`, deploymentPayload, {
            headers: { Authorization: token }
        });

        const deploymentId = deployResponse.data.id;

        // 5. Save all IDs to tenant service
        const tenantServiceUrl = config.services.tenantService || 'http://tenant-service:3007';
        await axios.post(
            `${tenantServiceUrl}/api/tenants/${tenantId}/credentials`,
            {
                type: 'open_messaging',
                credentials: {
                    integrationId: integrationId,
                    webhookToken: webhookToken,
                    deploymentId: deploymentId
                }
            }
        );

        res.status(201).json({
            integrationId,
            deploymentId,
            status: 'Provisioning complete'
        });
    } catch (error) {
        next(handleGenesysError(error, 'provisionMessaging'));
    }
};

module.exports = {
    getOrganizationMe,
    listOAuthClients,
    getOAuthClient,
    createOAuthClient,
    listIntegrations,
    provisionMessaging
};
