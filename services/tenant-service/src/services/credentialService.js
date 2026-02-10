const pool = require('../config/database');
const redisClient = require('../config/redis');
const { KEYS } = require('../../../../shared/constants');

async function storeCredentials(tenantId, type, credentials) {
    // Deactivate old credentials of same type
    await pool.query(
        `UPDATE tenant_credentials 
     SET is_active = false 
     WHERE tenant_id = $1 AND credential_type = $2`,
        [tenantId, type]
    );

    // Insert new credentials
    const result = await pool.query(
        `INSERT INTO tenant_credentials (tenant_id, credential_type, credentials)
     VALUES ($1, $2, $3)
     RETURNING id`,
        [tenantId, type, JSON.stringify(credentials)]
    );

    // Invalidate cache
    await redisClient.del(KEYS.credentials(tenantId, type));

    return result.rows[0].id;
}

async function getCredentials(tenantId, type) {
    // Check cache
    const cached = await redisClient.get(KEYS.credentials(tenantId, type));
    if (cached) {
        return JSON.parse(cached);
    }

    // Query database
    const result = await pool.query(
        `SELECT credentials 
     FROM tenant_credentials 
     WHERE tenant_id = $1 AND credential_type = $2 AND is_active = true
     ORDER BY created_at DESC
     LIMIT 1`,
        [tenantId, type]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const credentials = result.rows[0].credentials;

    // Cache for 1 hour
    await redisClient.setEx(
        KEYS.credentials(tenantId, type),
        3600,
        JSON.stringify(credentials)
    );

    return credentials;
}

module.exports = {
    storeCredentials,
    getCredentials
};
