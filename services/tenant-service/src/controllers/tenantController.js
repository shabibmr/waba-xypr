const tenantService = require('../services/tenantService');

async function createTenant(req, res) {
    const { tenantId, name } = req.body;

    if (!tenantId || !name) {
        return res.status(400).json({ error: 'tenantId and name required' });
    }

    try {
        const { tenant, apiKey } = await tenantService.createTenant(req.body);
        res.json({
            tenant,
            apiKey,
            message: 'Tenant created successfully'
        });
    } catch (error) {
        console.error('Tenant creation error:', error);
        res.status(500).json({ error: error.message });
    }
}

async function getAllTenants(req, res) {
    try {
        const tenants = await tenantService.getAllTenants();
        res.json(tenants);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getTenantById(req, res) {
    const { tenantId } = req.params;

    try {
        const tenant = await tenantService.getTenantById(tenantId);

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        res.json(tenant);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getTenantByGenesysOrg(req, res) {
    const { genesysOrgId } = req.params;

    try {
        const tenant = await tenantService.getTenantByGenesysOrg(genesysOrgId);

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found for this Genesys organization' });
        }


        res.json(tenant);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function provisionGenesysTenant(req, res) {
    const { genesysOrgId, genesysOrgName, genesysRegion } = req.body;

    if (!genesysOrgId || !genesysOrgName || !genesysRegion) {
        return res.status(400).json({
            error: 'genesysOrgId, genesysOrgName, and genesysRegion are required'
        });
    }

    try {
        const tenant = await tenantService.ensureTenantByGenesysOrg({
            genesysOrgId,
            genesysOrgName,
            genesysRegion
        });

        res.json({
            message: 'Tenant provisioned successfully',
            tenant_id: tenant.tenant_id,
            tenant_name: tenant.name
        });
    } catch (error) {
        console.error('Tenant provisioning error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Set Genesys OAuth credentials for a tenant
 */
async function setGenesysCredentials(req, res) {
    const { tenantId } = req.params;
    const { clientId, clientSecret, region, integrationId } = req.body;

    if (!clientId || !clientSecret || !region || !integrationId) {
        return res.status(400).json({
            error: 'clientId, clientSecret, region, and integrationId are required'
        });
    }

    try {
        const tenant = await tenantService.setGenesysCredentials(tenantId, {
            clientId,
            clientSecret,
            region,
            integrationId
        });

        res.json({
            message: 'Genesys credentials updated successfully',
            tenant: {
                tenant_id: tenant.tenant_id,
                name: tenant.name,
                genesys_region: tenant.genesys_region
            }
        });
    } catch (error) {
        console.error('Error setting Genesys credentials:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get Genesys OAuth credentials for a tenant (masked for security)
 */
async function getGenesysCredentials(req, res) {
    const { tenantId } = req.params;

    try {
        const credentials = await tenantService.getGenesysCredentials(tenantId);

        if (!credentials) {
            return res.status(404).json({
                error: 'Genesys credentials not configured for this tenant'
            });
        }

        // Return full credentials for internal service-to-service calls
        res.json({
            configured: true,
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            region: credentials.region,
            integrationId: credentials.integrationId
        });
    } catch (error) {
        console.error('Error getting Genesys credentials:', error);
        res.status(500).json({ error: error.message });
    }
}

async function updateTenant(req, res) {
    const { tenantId } = req.params;

    try {
        const tenant = await tenantService.updateTenant(tenantId, req.body);
        res.json({ message: 'Tenant updated successfully', tenant });
    } catch (error) {
        if (error.message === 'Tenant not found') {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        console.error('Tenant update error:', error);
        res.status(500).json({ error: error.message });
    }
}

async function deleteTenant(req, res) {
    const { tenantId } = req.params;

    try {
        await tenantService.deleteTenant(tenantId);
        res.json({ message: 'Tenant deleted successfully' });
    } catch (error) {
        if (error.message === 'Tenant not found') {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        console.error('Tenant deletion error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Complete onboarding for a tenant
 */
async function completeOnboarding(req, res) {
    const { tenantId } = req.params;
    const { whatsappConfigured, skippedWhatsApp } = req.body;

    try {
        const tenant = await tenantService.completeOnboarding(tenantId, {
            whatsappConfigured,
            skippedWhatsApp
        });

        res.json({
            message: 'Onboarding completed successfully',
            tenant: {
                tenant_id: tenant.tenant_id,
                name: tenant.name,
                status: tenant.status,
                onboarding_completed: tenant.onboarding_completed
            }
        });
    } catch (error) {
        if (error.message === 'Tenant not found') {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        console.error('Complete onboarding error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get tenant by phone_number_id
 * GET /api/tenants/by-phone/:phoneNumberId
 */
async function getTenantByPhoneNumberId(req, res) {
    try {
        const { phoneNumberId } = req.params;

        const tenant = await tenantService.getTenantByPhoneNumberId(phoneNumberId);

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        res.json(tenant);
    } catch (error) {
        console.error('Error getting tenant by phone_number_id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Get tenant by genesys_integration_id
 * GET /api/tenants/by-integration/:integrationId
 */
async function getTenantByIntegrationId(req, res) {
    try {
        const { integrationId } = req.params;

        const tenant = await tenantService.getTenantByIntegrationId(integrationId);

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        res.json(tenant);
    } catch (error) {
        console.error('Error getting tenant by integration_id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Get credentials by type (generic)
 * GET /api/tenants/:tenantId/credentials?type=whatsapp|genesys
 */
async function getCredentials(req, res) {
    try {
        const { tenantId } = req.params;
        const { type } = req.query;

        if (!type || !['whatsapp', 'genesys'].includes(type)) {
            return res.status(400).json({ error: 'Invalid credential type. Use whatsapp or genesys' });
        }

        const credentials = await tenantService.getCredentials(tenantId, type);

        // Mask sensitive fields for response
        const masked = { ...credentials };
        if (masked.clientSecret) {
            masked.clientSecret = '***' + masked.clientSecret.slice(-4);
        }
        if (masked.access_token) {
            masked.access_token = '***' + masked.access_token.slice(-4);
        }

        res.json(masked);
    } catch (error) {
        console.error('Error getting credentials:', error);
        res.status(404).json({ error: error.message });
    }
}

/**
 * Set credentials by type (generic)
 * PUT /api/tenants/:tenantId/credentials
 * Body: { type: 'whatsapp|genesys', credentials: {...} }
 */
async function setCredentials(req, res) {
    try {
        const { tenantId } = req.params;
        const { type, credentials } = req.body;

        if (!type || !['whatsapp', 'genesys'].includes(type)) {
            return res.status(400).json({ error: 'Invalid credential type' });
        }

        if (!credentials || typeof credentials !== 'object') {
            return res.status(400).json({ error: 'Credentials object required' });
        }

        await tenantService.setCredentials(tenantId, type, credentials);

        res.json({ message: 'Credentials updated successfully' });
    } catch (error) {
        console.error('Error setting credentials:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    createTenant,
    getAllTenants,
    getTenantById,
    getTenantByGenesysOrg,
    provisionGenesysTenant,
    setGenesysCredentials,
    getGenesysCredentials,
    updateTenant,
    deleteTenant,
    completeOnboarding,
    getTenantByPhoneNumberId,
    getTenantByIntegrationId,
    getCredentials,
    setCredentials
};
