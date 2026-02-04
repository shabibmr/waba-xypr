const pool = require('../config/database');
const redisClient = require('../config/redis');
const crypto = require('crypto');
const { KEYS } = require('../../../../shared/constants');

async function createTenant(data) {
    const { tenantId, name, subdomain, plan, genesysOrgId, genesysOrgName, genesysRegion } = data;

    const result = await pool.query(
        `INSERT INTO tenants (tenant_id, name, subdomain, plan, genesys_org_id, genesys_org_name, genesys_region)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
        [tenantId, name, subdomain, plan || 'standard', genesysOrgId, genesysOrgName, genesysRegion]
    );

    const tenant = result.rows[0];

    // Generate API key
    const apiKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
    await pool.query(
        `INSERT INTO tenant_api_keys (api_key, tenant_id, name)
     VALUES ($1, $2, $3)`,
        [apiKey, tenantId, 'Default API Key']
    );

    await cacheTenantData(tenant);
    await redisClient.set(`apikey:${apiKey}`, tenantId);
    if (subdomain) {
        await redisClient.set(`subdomain:${subdomain}`, tenantId);
    }

    return { tenant, apiKey };
}

async function getAllTenants() {
    const result = await pool.query(
        'SELECT * FROM tenants ORDER BY created_at DESC'
    );
    return result.rows;
}

async function getTenantById(tenantId) {
    const result = await pool.query(
        'SELECT * FROM tenants WHERE tenant_id = $1',
        [tenantId]
    );
    return result.rows[0];
}

async function cacheTenantData(tenant) {
    const cacheData = {
        id: tenant.tenant_id,
        name: tenant.name,
        status: tenant.status,
        plan: tenant.plan,
        rateLimit: tenant.rate_limit
    };

    await redisClient.setEx(
        KEYS.tenant(tenant.tenant_id),
        3600,
        JSON.stringify(cacheData)
    );
}

async function getTenantByGenesysOrg(genesysOrgId) {
    const result = await pool.query(
        'SELECT * FROM tenants WHERE genesys_org_id = $1',
        [genesysOrgId]
    );
    return result.rows[0];
}

/**
 * Store or update Genesys OAuth credentials for a tenant
 */
async function setGenesysCredentials(tenantId, credentials) {
    const { clientId, clientSecret, region, integrationId } = credentials;

    // Check if tenant exists
    const tenantExists = await pool.query(
        'SELECT tenant_id FROM tenants WHERE tenant_id = $1',
        [tenantId]
    );

    if (tenantExists.rows.length === 0) {
        throw new Error('Tenant not found');
    }

    // Deactivate old Genesys credentials
    await pool.query(
        `UPDATE tenant_credentials 
         SET is_active = false 
         WHERE tenant_id = $1 AND credential_type = 'genesys'`,
        [tenantId]
    );

    // Insert new credentials
    const credentialData = { clientId, clientSecret, region, integrationId };
    const result = await pool.query(
        `INSERT INTO tenant_credentials (tenant_id, credential_type, credentials)
         VALUES ($1, 'genesys', $2)
         RETURNING *`,
        [tenantId, JSON.stringify(credentialData)]
    );

    // Update tenant region if needed (denormalized)
    await pool.query(
        'UPDATE tenants SET genesys_region = $1 WHERE tenant_id = $2',
        [region, tenantId]
    );

    // Invalidate cache
    await redisClient.del(KEYS.genesysCreds(tenantId));

    // Return combined object to match controller expectation
    return {
        tenant_id: tenantId,
        genesys_region: region,
        ...credentialData
    };
}

/**
 * Get Genesys OAuth credentials for a tenant
 */
async function getGenesysCredentials(tenantId) {
    // Check cache first
    const cached = await redisClient.get(KEYS.genesysCreds(tenantId));
    if (cached) {
        return JSON.parse(cached);
    }

    // Query database - look in tenant_credentials table
    const result = await pool.query(
        `SELECT credentials 
         FROM tenant_credentials 
         WHERE tenant_id = $1 AND credential_type = 'genesys' AND is_active = true
         ORDER BY created_at DESC
         LIMIT 1`,
        [tenantId]
    );

    if (result.rows.length === 0) {
        return null; // Not configured
    }

    const { clientId, clientSecret, region, integrationId } = result.rows[0].credentials;

    const credentials = {
        clientId,
        clientSecret,
        region,
        integrationId
    };

    // Cache for 1 hour
    await redisClient.setEx(
        KEYS.genesysCreds(tenantId),
        3600,
        JSON.stringify(credentials)
    );

    return credentials;
}


/**
 * Ensure a tenant exists for a Genesys Organization (Get or Create)
 */
async function ensureTenantByGenesysOrg(genesysData) {
    const { genesysOrgId, genesysOrgName, genesysRegion } = genesysData;

    // 1. Check if tenant exists
    const existingTenant = await getTenantByGenesysOrg(genesysOrgId);
    if (existingTenant) {
        return existingTenant;
    }

    // 2. Create new tenant
    // Generate tenant ID from name (slugify)
    const slug = genesysOrgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    // Add random suffix to ensure uniqueness
    const randomSuffix = crypto.randomBytes(2).toString('hex');
    const tenantId = `${slug}-${randomSuffix}`;
    const subdomain = `${slug}-${randomSuffix}`; // Use same uniqueness for subdomain

    console.log(`Auto-provisioning new tenant: ${tenantId} for Genesys Org: ${genesysOrgName}`);

    const newTenantData = {
        tenantId,
        name: genesysOrgName,
        subdomain,
        plan: 'standard', // Default plan
        genesysOrgId,
        genesysOrgName,
        genesysRegion
    };

    const { tenant } = await createTenant(newTenantData);
    return tenant;
}

async function updateTenant(tenantId, data) {
    const { name, subdomain, plan, status } = data;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (subdomain !== undefined) { fields.push(`subdomain = $${paramIndex++}`); values.push(subdomain); }
    if (plan !== undefined) { fields.push(`plan = $${paramIndex++}`); values.push(plan); }
    if (status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(status); }

    if (fields.length === 0) {
        throw new Error('No fields to update');
    }

    values.push(tenantId);
    const result = await pool.query(
        `UPDATE tenants SET ${fields.join(', ')} WHERE tenant_id = $${paramIndex} RETURNING *`,
        values
    );

    if (result.rows.length === 0) {
        throw new Error('Tenant not found');
    }

    const tenant = result.rows[0];
    await redisClient.del(KEYS.tenant(tenantId));
    await cacheTenantData(tenant);

    return tenant;
}

async function deleteTenant(tenantId) {
    // Delete related data first
    await pool.query('DELETE FROM tenant_whatsapp_config WHERE tenant_id = $1', [tenantId]);
    await pool.query('DELETE FROM tenant_credentials WHERE tenant_id = $1', [tenantId]);
    await pool.query('DELETE FROM tenant_api_keys WHERE tenant_id = $1', [tenantId]);

    const result = await pool.query(
        'DELETE FROM tenants WHERE tenant_id = $1 RETURNING *',
        [tenantId]
    );

    if (result.rows.length === 0) {
        throw new Error('Tenant not found');
    }

    // Clean up Redis cache
    await redisClient.del(KEYS.tenant(tenantId));
    await redisClient.del(KEYS.genesysCreds(tenantId));
    await redisClient.del(KEYS.whatsappConfig(tenantId));

    return result.rows[0];
}

module.exports = {
    createTenant,
    getAllTenants,
    getTenantById,
    getTenantByGenesysOrg,
    ensureTenantByGenesysOrg,
    cacheTenantData,
    setGenesysCredentials,
    getGenesysCredentials,
    updateTenant,
    deleteTenant
};
