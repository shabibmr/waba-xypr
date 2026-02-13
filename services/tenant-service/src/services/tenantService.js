const pool = require('../config/database');
const redisClient = require('../config/redis');
const cacheService = require('./cache.service');
const crypto = require('crypto');
const { KEYS } = require('../../../../shared/constants');

/**
 * Format a DB row into the canonical camelCase tenant response object.
 */
function formatTenant(row) {
    if (!row) return null;
    return {
        id: row.tenant_id,
        name: row.name,
        email: row.email || null,
        domain: row.domain || null,
        subdomain: row.subdomain || null,
        status: row.status,
        plan: row.plan,
        rateLimit: row.rate_limit,
        phoneNumberId: row.phone_number_id || null,
        genesysIntegrationId: row.genesys_integration_id || null,
        genesysOrgId: row.genesys_org_id || null,
        genesysOrgName: row.genesys_org_name || null,
        genesysRegion: row.genesys_region || null,
        settings: row.settings || null,
        onboardingCompleted: row.onboarding_completed,
        whatsappConfigured: row.whatsapp_configured,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function createTenant(data) {
    // Auto-generate tenant ID server-side; ignore any client-supplied tenantId
    const { name, email, domain, subdomain, plan, settings, genesysOrgId, genesysOrgName, genesysRegion, phoneNumberId, genesysIntegrationId } = data;

    // Generate a URL-safe tenant ID
    const tenantId = `t_${crypto.randomBytes(8).toString('hex')}`;

    try {
        const result = await pool.query(
            `INSERT INTO tenants
               (tenant_id, name, email, domain, subdomain, plan, settings, genesys_org_id, genesys_org_name, genesys_region, phone_number_id, genesys_integration_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [tenantId, name, email || null, domain || null, subdomain || null,
                plan || 'standard', settings ? JSON.stringify(settings) : '{}',
                genesysOrgId || null, genesysOrgName || null, genesysRegion || null,
                phoneNumberId || null, genesysIntegrationId || null]
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
        if (redisClient.isReady) {
            try {
                await redisClient.set(`apikey:${apiKey}`, tenantId);
                if (subdomain) {
                    await redisClient.set(`subdomain:${subdomain}`, tenantId);
                }
            } catch (err) {
                console.error('Redis apikey/subdomain cache error:', err.message);
            }
        }

        return { tenant: formatTenant(tenant), apiKey };
    } catch (error) {
        // Handle duplicate email or domain if constraint exists
        if (error.code === '23505') { // unique_violation
            throw new Error('Tenant with this email or domain already exists');
        }
        throw error;
    }
}

async function getAllTenants({ limit = 20, offset = 0 } = {}) {
    const [rows, count] = await Promise.all([
        pool.query(
            'SELECT * FROM tenants ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        ),
        pool.query('SELECT COUNT(*) FROM tenants')
    ]);
    return {
        tenants: rows.rows.map(formatTenant),
        total: parseInt(count.rows[0].count, 10),
        limit,
        offset
    };
}

async function getTenantById(tenantId) {
    const result = await pool.query(
        'SELECT * FROM tenants WHERE tenant_id = $1',
        [tenantId]
    );
    return formatTenant(result.rows[0]);
}

async function cacheTenantData(tenant) {
    if (!redisClient.isReady) return;
    try {
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
    } catch (err) {
        console.error('cacheTenantData error:', err.message);
    }
}

async function getTenantByGenesysOrg(genesysOrgId) {
    const result = await pool.query(
        'SELECT * FROM tenants WHERE genesys_org_id = $1',
        [genesysOrgId]
    );
    return formatTenant(result.rows[0]);
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

    // Update denormalized lookup columns on the tenant
    await pool.query(
        `UPDATE tenants
         SET genesys_region = $1, genesys_integration_id = $2
         WHERE tenant_id = $3`,
        [region, integrationId, tenantId]
    );

    // Invalidate cache
    await redisClient.del(KEYS.genesysCreds(tenantId));

    // Fetch updated tenant for formatted response
    const tenantRow = await pool.query('SELECT * FROM tenants WHERE tenant_id = $1', [tenantId]);
    const tenant = formatTenant(tenantRow.rows[0]);
    return { ...tenant, ...credentialData };
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
        name: genesysOrgName,
        subdomain,
        plan: 'standard',
        genesysOrgId,
        genesysOrgName,
        genesysRegion
    };

    const { tenant } = await createTenant(newTenantData);
    return tenant;
}

async function updateTenant(tenantId, data) {
    const { name, email, domain, subdomain, plan, status, settings,
        phoneNumberId, genesysIntegrationId } = data;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (email !== undefined) { fields.push(`email = $${paramIndex++}`); values.push(email); }
    if (domain !== undefined) { fields.push(`domain = $${paramIndex++}`); values.push(domain); }
    if (subdomain !== undefined) { fields.push(`subdomain = $${paramIndex++}`); values.push(subdomain); }
    if (plan !== undefined) { fields.push(`plan = $${paramIndex++}`); values.push(plan); }
    if (status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(status); }
    if (settings !== undefined) { fields.push(`settings = $${paramIndex++}`); values.push(JSON.stringify(settings)); }
    if (phoneNumberId !== undefined) { fields.push(`phone_number_id = $${paramIndex++}`); values.push(phoneNumberId); }
    if (genesysIntegrationId !== undefined) { fields.push(`genesys_integration_id = $${paramIndex++}`); values.push(genesysIntegrationId); }

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

    return formatTenant(tenant);
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

    return formatTenant(result.rows[0]);
}

/**
 * Complete onboarding for a tenant
 */
async function completeOnboarding(tenantId, onboardingData) {
    const { whatsappConfigured, skippedWhatsApp } = onboardingData;

    // Update tenant status to active and mark onboarding as complete
    const result = await pool.query(
        `UPDATE tenants 
         SET status = 'active',
             onboarding_completed = true,
             onboarding_completed_at = NOW(),
             whatsapp_configured = $1
         WHERE tenant_id = $2
         RETURNING *`,
        [whatsappConfigured || false, tenantId]
    );

    if (result.rows.length === 0) {
        throw new Error('Tenant not found');
    }

    const tenant = result.rows[0];

    // Clear cache to refresh tenant data
    await redisClient.del(KEYS.tenant(tenantId));
    await cacheTenantData(tenant);

    return formatTenant(tenant);
}

/**
 * Get tenant by phone_number_id with caching
 */
async function getTenantByPhoneNumberId(phoneNumberId) {
    console.log(`[DEBUG] Entering getTenantByPhoneNumberId with ID: ${phoneNumberId}`);
    // Check cache first
    const cacheKey = `phone:${phoneNumberId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
        return cached;
    }

    // Query database
    const query = `
        SELECT tenant_id as id, name, phone_number_id, genesys_integration_id, status
        FROM tenants
        WHERE phone_number_id = $1 AND status = 'active'
        LIMIT 1
    `;

    console.log(`[DEBUG] getTenantByPhoneNumberId: Searching for ${phoneNumberId}`);
    const result = await pool.query(query, [phoneNumberId]);
    console.log(`[DEBUG] getTenantByPhoneNumberId result count: ${result.rows.length}`);
    if (result.rows.length > 0) {
        console.log(`[DEBUG] Found tenant: ${result.rows[0].id}`);
    }

    if (result.rows.length === 0) {
        return null;
    }

    const tenant = result.rows[0];

    // Cache the result
    await cacheService.set(cacheKey, tenant);

    return tenant;
}

/**
 * Get tenant by genesys_integration_id with caching
 */
async function getTenantByIntegrationId(integrationId) {
    // Check cache first
    const cacheKey = `integration:${integrationId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
        return cached;
    }

    // Query database
    const query = `
        SELECT tenant_id as id, name, phone_number_id, genesys_integration_id, status
        FROM tenants
        WHERE genesys_integration_id = $1 AND status = 'active'
        LIMIT 1
    `;

    const result = await pool.query(query, [integrationId]);

    if (result.rows.length === 0) {
        return null;
    }

    const tenant = result.rows[0];

    // Cache the result
    await cacheService.set(cacheKey, tenant);

    return tenant;
}

/**
 * Get credentials by type (generic endpoint)
 */
async function getCredentials(tenantId, credentialType) {
    const query = `
        SELECT credentials
        FROM tenant_credentials
        WHERE tenant_id = $1 AND credential_type = $2 AND is_active = true
        LIMIT 1
    `;

    const result = await pool.query(query, [tenantId, credentialType]);

    if (result.rows.length === 0) {
        throw new Error(`${credentialType} credentials not found for tenant ${tenantId}`);
    }

    return result.rows[0].credentials;
}

/**
 * Set credentials by type (generic endpoint)
 */
async function setCredentials(tenantId, credentialType, credentials) {
    // Deactivate existing credentials of this type
    await pool.query(
        `UPDATE tenant_credentials 
         SET is_active = false 
         WHERE tenant_id = $1 AND credential_type = $2`,
        [tenantId, credentialType]
    );

    // Insert new credentials
    const query = `
        INSERT INTO tenant_credentials (tenant_id, credential_type, credentials, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING id
    `;

    await pool.query(query, [tenantId, credentialType, credentials]);

    // Invalidate cache
    await cacheService.invalidateTenant(tenantId);
}

module.exports = {
    formatTenant,
    createTenant,
    getAllTenants,
    getTenantById,
    getTenantByGenesysOrg,
    ensureTenantByGenesysOrg,
    cacheTenantData,
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
