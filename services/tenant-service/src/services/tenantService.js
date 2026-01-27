const pool = require('../config/database');
const redisClient = require('../config/redis');
const crypto = require('crypto');

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
        `tenant:${tenant.tenant_id}`,
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
    const { clientId, clientSecret, region } = credentials;

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
    const credentialData = { clientId, clientSecret, region };
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
    await redisClient.del(`tenant:${tenantId}:genesys_creds`);

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
    const cached = await redisClient.get(`tenant:${tenantId}:genesys_creds`);
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

    const { clientId, clientSecret, region } = result.rows[0].credentials;

    const credentials = {
        clientId,
        clientSecret,
        region
    };

    // Cache for 1 hour
    await redisClient.setEx(
        `tenant:${tenantId}:genesys_creds`,
        3600,
        JSON.stringify(credentials)
    );

    return credentials;
}

module.exports = {
    createTenant,
    getAllTenants,
    getTenantById,
    getTenantByGenesysOrg,
    cacheTenantData,
    setGenesysCredentials,
    getGenesysCredentials
};
