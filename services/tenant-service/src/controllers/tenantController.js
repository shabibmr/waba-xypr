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
    const { clientId, clientSecret, region } = req.body;

    if (!clientId || !clientSecret || !region) {
        return res.status(400).json({
            error: 'clientId, clientSecret, and region are required'
        });
    }

    try {
        const tenant = await tenantService.setGenesysCredentials(tenantId, {
            clientId,
            clientSecret,
            region
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

        // Return masked credentials for security
        res.json({
            configured: true,
            clientId: credentials.clientId,
            clientSecret: '***' + credentials.clientSecret.slice(-4), // Mask secret
            region: credentials.region
        });
    } catch (error) {
        console.error('Error getting Genesys credentials:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    createTenant,
    getAllTenants,
    getTenantById,
    getTenantByGenesysOrg,
    provisionGenesysTenant,
    setGenesysCredentials,
    getGenesysCredentials
};
