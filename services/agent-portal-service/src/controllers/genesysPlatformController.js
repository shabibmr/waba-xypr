const crypto = require('crypto');
const logger = require('../utils/logger');
const { getRequestContext } = require('../utils/requestHelpers');

// Import services
const genesysPlatformService = require('../services/genesysPlatform.service');
const tenantCredentialService = require('../services/tenantCredential.service');

/**
 * Get organization information
 */
const getOrganizationMe = async (req, res, next) => {
    try {
        const { token, region } = getRequestContext(req);

        const organization = await genesysPlatformService.getOrganization(token, region);

        res.json(organization);
    } catch (error) {
        next(error);
    }
};

/**
 * List OAuth clients
 */
const listOAuthClients = async (req, res, next) => {
    try {
        const { token, region } = getRequestContext(req);

        const clients = await genesysPlatformService.listOAuthClients(token, region);

        res.json({ entities: clients });
    } catch (error) {
        next(error);
    }
};

/**
 * Get OAuth client by ID
 */
const getOAuthClient = async (req, res, next) => {
    try {
        const { token, region } = getRequestContext(req);
        const clientId = req.params.clientId;

        const client = await genesysPlatformService.getOAuthClient(token, region, clientId);

        res.json(client);
    } catch (error) {
        next(error);
    }
};

/**
 * Create OAuth client and store credentials
 */
const createOAuthClient = async (req, res, next) => {
    try {
        const { token, region, tenantId } = getRequestContext(req, true);

        const payload = {
            name: req.body.name,
            description: req.body.description || 'Middleware OAuth Client',
            authorizedGrantType: 'CLIENT_CREDENTIALS',
            accessTokenValiditySeconds: 86400,
            roleIds: req.body.roleIds || undefined
        };

        logger.info('Creating OAuth client', { name: payload.name, tenantId });

        // 1. Create OAuth client in Genesys
        const clientData = await genesysPlatformService.createOAuthClient(token, region, payload);

        // 2. Store credentials securely in Tenant Service
        await tenantCredentialService.storeGenesysCredentials(tenantId, {
            clientId: clientData.id,
            clientSecret: clientData.secret,
            region: region
        });

        logger.info('OAuth client created and credentials stored', {
            clientId: clientData.id,
            tenantId
        });

        // 3. Return client ID only (secret stored securely)
        res.status(201).json({
            id: clientData.id,
            name: clientData.name,
            status: 'Stored securely'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * List integrations (filtered for open-messaging)
 */
const listIntegrations = async (req, res, next) => {
    try {
        const { token, region } = getRequestContext(req);

        // Filter for open-messaging integrations
        const integrations = await genesysPlatformService.listIntegrations(
            token,
            region,
            'open-messaging'
        );

        res.json({ entities: integrations });
    } catch (error) {
        next(error);
    }
};

/**
 * Provision Open Messaging integration
 * Creates integration, configures webhook, enables, and creates widget deployment
 */
const provisionMessaging = async (req, res, next) => {
    try {
        const { token, region, tenantId } = getRequestContext(req, true);
        const { name, webhookUrl } = req.body;

        logger.info('Starting Open Messaging provisioning', {
            name,
            tenantId,
            region
        });

        // Generate webhook token
        const webhookToken = crypto.randomBytes(32).toString('hex');

        // Provision complete Open Messaging setup via service
        const result = await genesysPlatformService.provisionOpenMessaging(token, region, {
            name,
            webhookUrl,
            webhookToken,
            allowAllDomains: true // TODO: Should restrict domains in production
        });

        // Store credentials in Tenant Service
        await tenantCredentialService.storeOpenMessagingCredentials(tenantId, {
            integrationId: result.integrationId,
            webhookToken: result.webhookToken,
            deploymentId: result.deploymentId
        });

        logger.info('Open Messaging provisioning complete', {
            integrationId: result.integrationId,
            deploymentId: result.deploymentId,
            tenantId
        });

        res.status(201).json({
            integrationId: result.integrationId,
            deploymentId: result.deploymentId,
            status: 'Provisioning complete'
        });
    } catch (error) {
        next(error);
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
