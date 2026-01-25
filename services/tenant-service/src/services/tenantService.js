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

    const result = await pool.query(
        `UPDATE tenants 
         SET genesys_client_id = $1,
             genesys_client_secret = $2,
             genesys_region = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $4
         RETURNING *`,
        [clientId, clientSecret, region, tenantId]
    );

    if (result.rows.length === 0) {
        throw new Error('Tenant not found');
    }

    // Invalidate cache
    await redisClient.del(`tenant:${tenantId}:genesys_creds`);
    await cacheTenantData(result.rows[0]);

    return result.rows[0];
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

    // Query database
    const result = await pool.query(
        `SELECT genesys_client_id, genesys_client_secret, genesys_region 
         FROM tenants 
         WHERE tenant_id = $1 AND is_active = true`,
        [tenantId]
    );

    if (result.rows.length === 0) {
        throw new Error('Tenant not found or inactive');
    }

    const row = result.rows[0];

    if (!row.genesys_client_id || !row.genesys_client_secret || !row.genesys_region) {
        return null; // Credentials not configured yet
    }

    const credentials = {
        clientId: row.genesys_client_id,
        clientSecret: row.genesys_client_secret,
        region: row.genesys_region
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
