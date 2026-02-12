const tenantService = require('../services/tenantService');

async function createTenant(req, res) {
    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'name and email are required', code: 'VALIDATION_ERROR' });
    }

    try {
        const { tenant, apiKey } = await tenantService.createTenant(req.body);
        return res.status(201).json({ tenant, apiKey, message: 'Tenant created successfully' });
    } catch (error) {
        console.error('Tenant creation error:', error);
        if (error.message.includes('already exists')) {
            return res.status(409).json({ error: error.message, code: 'CONFLICT' });
        }
        res.status(500).json({ error: error.message, code: 'INTERNAL_ERROR' });
    }
}

async function getAllTenants(req, res) {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
        const offset = parseInt(req.query.offset, 10) || 0;
        const result = await tenantService.getAllTenants({ limit, offset });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message, code: 'INTERNAL_ERROR' });
    }
}

async function getTenantById(req, res) {
    const { tenantId } = req.params;

    try {
        const tenant = await tenantService.getTenantById(tenantId);

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found', code: 'NOT_FOUND' });
        }

        res.json(tenant);
    } catch (error) {
        res.status(500).json({ error: error.message, code: 'INTERNAL_ERROR' });
    }
}

async function getTenantByGenesysOrg(req, res) {
    const { genesysOrgId } = req.params;

    try {
        const tenant = await tenantService.getTenantByGenesysOrg(genesysOrgId);

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found for this Genesys organization', code: 'NOT_FOUND' });
        }

        res.json(tenant);
    } catch (error) {
        res.status(500).json({ error: error.message, code: 'INTERNAL_ERROR' });
    }
}

async function provisionGenesysTenant(req, res) {
    const { genesysOrgId, genesysOrgName, genesysRegion } = req.body;

    if (!genesysOrgId || !genesysOrgName || !genesysRegion) {
        return res.status(400).json({ error: { message: 'genesysOrgId, genesysOrgName, and genesysRegion are required', code: 'VALIDATION_ERROR' } });
    }

    try {
        const tenant = await tenantService.ensureTenantByGenesysOrg({
            genesysOrgId,
            genesysOrgName,
            genesysRegion
        });

        res.json({
            message: 'Tenant provisioned successfully',
            tenantId: tenant.id,
            tenantName: tenant.name
        });
    } catch (error) {
        console.error('Tenant provisioning error:', error);
        res.status(500).json({ error: { message: error.message, code: 'INTERNAL_ERROR' } });
    }
}

/**
 * Set Genesys OAuth credentials for a tenant
 */
async function setGenesysCredentials(req, res) {
    const { tenantId } = req.params;
    const { clientId, clientSecret, region, integrationId } = req.body;

    if (!clientId || !clientSecret || !region || !integrationId) {
        return res.status(400).json({ error: { message: 'clientId, clientSecret, region, and integrationId are required', code: 'VALIDATION_ERROR' } });
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
                id: tenant.id,
                name: tenant.name,
                genesysRegion: tenant.genesysRegion
            }
        });
    } catch (error) {
        console.error('Error setting Genesys credentials:', error);
        res.status(500).json({ error: { message: error.message, code: 'INTERNAL_ERROR' } });
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
            return res.status(404).json({ error: { message: 'Genesys credentials not configured for this tenant', code: 'NOT_FOUND' } });
        }

        res.json({
            configured: true,
            clientId: credentials.clientId,
            clientSecret: `***${credentials.clientSecret.slice(-4)}`,
            region: credentials.region
        });
    } catch (error) {
        console.error('Error getting Genesys credentials:', error);
        res.status(500).json({ error: { message: error.message, code: 'INTERNAL_ERROR' } });
    }
}

async function updateTenant(req, res) {
    const { tenantId } = req.params;

    try {
        const tenant = await tenantService.updateTenant(tenantId, req.body);
        res.json({ message: 'Tenant updated successfully', tenant });
    } catch (error) {
        if (error.message === 'Tenant not found') {
            return res.status(404).json({ error: { message: 'Tenant not found', code: 'NOT_FOUND' } });
        }
        console.error('Tenant update error:', error);
        res.status(500).json({ error: { message: error.message, code: 'INTERNAL_ERROR' } });
    }
}

async function deleteTenant(req, res) {
    const { tenantId } = req.params;

    try {
        await tenantService.deleteTenant(tenantId);
        res.json({ message: 'Tenant deleted successfully' });
    } catch (error) {
        if (error.message === 'Tenant not found') {
            return res.status(404).json({ error: { message: 'Tenant not found', code: 'NOT_FOUND' } });
        }
        console.error('Tenant deletion error:', error);
        res.status(500).json({ error: { message: error.message, code: 'INTERNAL_ERROR' } });
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
                id: tenant.id,
                name: tenant.name,
                status: tenant.status,
                onboardingCompleted: tenant.onboardingCompleted
            }
        });
    } catch (error) {
        if (error.message === 'Tenant not found') {
            return res.status(404).json({ error: { message: 'Tenant not found', code: 'NOT_FOUND' } });
        }
        console.error('Complete onboarding error:', error);
        res.status(500).json({ error: { message: error.message, code: 'INTERNAL_ERROR' } });
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
            return res.status(404).json({ error: { message: 'Tenant not found', code: 'NOT_FOUND' } });
        }

        res.json(tenant);
    } catch (error) {
        console.error('Error getting tenant by phone_number_id:', error);
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
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
            return res.status(404).json({ error: { message: 'Tenant not found', code: 'NOT_FOUND' } });
        }

        res.json(tenant);
    } catch (error) {
        console.error('Error getting tenant by integration_id:', error);
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
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
        res.status(404).json({ error: { message: error.message, code: 'NOT_FOUND' } });
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
    getCredentials
};
