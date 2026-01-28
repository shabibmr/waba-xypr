const pool = require('../config/database');
const redisClient = require('../config/redis');
const { maskWhatsAppConfig } = require('../utils/masking');
const { KEYS } = require('../../../shared/constants');

async function updateWhatsAppConfig(tenantId, data) {
    const { wabaId, phoneNumberId, accessToken, businessId, displayPhoneNumber, qualityRating } = data;

    // Check if config already exists
    const existing = await pool.query(
        'SELECT id FROM tenant_whatsapp_config WHERE tenant_id = $1',
        [tenantId]
    );

    let result;
    if (existing.rows.length > 0) {
        // Update existing
        result = await pool.query(
            `UPDATE tenant_whatsapp_config 
       SET waba_id = $1, phone_number_id = $2, access_token = $3, 
           business_id = $4, display_phone_number = $5, quality_rating = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $7
       RETURNING *`,
            [wabaId, phoneNumberId, accessToken, businessId, displayPhoneNumber, qualityRating, tenantId]
        );
    } else {
        // Insert new
        result = await pool.query(
            `INSERT INTO tenant_whatsapp_config 
       (tenant_id, waba_id, phone_number_id, access_token, business_id, display_phone_number, quality_rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [tenantId, wabaId, phoneNumberId, accessToken, businessId, displayPhoneNumber, qualityRating]
        );
    }

    // Invalidate cache
    await redisClient.del(KEYS.whatsappConfig(tenantId));

    return maskWhatsAppConfig(result.rows[0]);
}

async function getWhatsAppConfig(tenantId) {
    // Check cache
    const cached = await redisClient.get(KEYS.whatsappConfig(tenantId));
    if (cached) {
        return JSON.parse(cached);
    }

    const result = await pool.query(
        `SELECT * FROM tenant_whatsapp_config 
     WHERE tenant_id = $1 AND is_active = true`,
        [tenantId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const maskedConfig = maskWhatsAppConfig(result.rows[0]);

    // Cache for 1 hour
    await redisClient.setEx(
        KEYS.whatsappConfig(tenantId),
        3600,
        JSON.stringify(maskedConfig)
    );

    return maskedConfig;
}

module.exports = {
    updateWhatsAppConfig,
    getWhatsAppConfig
};
