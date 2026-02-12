const whatsappService = require('../services/whatsappService');
const axios = require('axios');
const pool = require('../config/database');

async function updateWhatsAppConfig(req, res) {
    const { tenantId } = req.params;
    const { wabaId, phoneNumberId, accessToken } = req.body;

    if (!wabaId || !phoneNumberId || !accessToken) {
        return res.status(400).json({
            error: 'wabaId, phoneNumberId, and accessToken are required'
        });
    }

    try {
        const config = await whatsappService.updateWhatsAppConfig(tenantId, req.body);
        res.json({
            success: true,
            config
        });
    } catch (error) {
        console.error('WhatsApp config error:', error);
        res.status(500).json({ error: error.message });
    }
}

async function getWhatsAppConfig(req, res) {
    const { tenantId } = req.params;

    try {
        const config = await whatsappService.getWhatsAppConfig(tenantId);

        if (!config) {
            return res.status(404).json({ error: 'WhatsApp config not found' });
        }

        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function handleSignupCallback(req, res) {
    const { code, state } = req.body;

    if (!code) {
        return res.status(400).json({ error: { message: 'Authorization code required', code: 'VALIDATION_ERROR' } });
    }
    if (!state) {
        return res.status(400).json({ error: { message: 'state (tenantId) required', code: 'VALIDATION_ERROR' } });
    }

    // Decode state — expected to be a JSON string or plain tenantId
    let tenantId;
    try {
        const parsed = JSON.parse(state);
        tenantId = parsed.tenantId || parsed;
    } catch {
        tenantId = state;
    }

    // Verify tenant exists before doing any API calls
    const tenantCheck = await pool.query(
        'SELECT tenant_id FROM tenants WHERE tenant_id = $1',
        [tenantId]
    );
    if (tenantCheck.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Tenant not found', code: 'NOT_FOUND' } });
    }

    try {
        // Exchange code for access token
        const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
            params: {
                client_id: process.env.META_APP_ID,
                client_secret: process.env.META_APP_SECRET,
                code: code
            }
        });

        const { access_token } = tokenResponse.data;

        // Get WABA info from the access token
        const wabaResponse = await axios.get('https://graph.facebook.com/v18.0/debug_token', {
            params: {
                input_token: access_token,
                access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
            }
        });

        const wabaData = wabaResponse.data.data.granular_scopes.find(s =>
            s.scope === 'whatsapp_business_management'
        );

        if (!wabaData || !wabaData.target_ids || wabaData.target_ids.length === 0) {
            return res.status(400).json({ error: { message: 'No WhatsApp Business Account found in token', code: 'WABA_NOT_FOUND' } });
        }

        const wabaId = wabaData.target_ids[0];

        // Get phone number details
        const phoneResponse = await axios.get(`https://graph.facebook.com/v18.0/${wabaId}`, {
            params: { access_token, fields: 'id,display_phone_number,quality_rating,business_id' }
        });

        const phoneData = phoneResponse.data;

        const signupData = {
            wabaId,
            phoneNumberId: phoneData.id,
            displayPhoneNumber: phoneData.display_phone_number,
            qualityRating: phoneData.quality_rating,
            accessToken: access_token,
            businessId: phoneData.business_id || null,
            businessAccountId: wabaId
        };

        // Persist config and mark tenant as whatsapp_configured
        const config = await whatsappService.completeWhatsAppSignup(tenantId, signupData);

        res.json({
            message: 'WhatsApp signup completed successfully',
            tenantId,
            config: {
                wabaId: signupData.wabaId,
                phoneNumberId: signupData.phoneNumberId,
                displayPhoneNumber: signupData.displayPhoneNumber,
                qualityRating: signupData.qualityRating,
                businessId: signupData.businessId,
                configured: true
            }
        });
    } catch (error) {
        console.error('WhatsApp signup error:', error.response?.data || error.message);
        res.status(500).json({
            error: { message: 'Failed to complete WhatsApp signup', code: 'SIGNUP_ERROR' },
            details: error.response?.data?.error?.message
        });
    }
}

async function getTenantByPhone(req, res) {
    const { phoneNumberId } = req.params;

    try {
        const row = await whatsappService.getTenantByPhoneNumberId(phoneNumberId);

        if (!row) {
            return res.status(404).json({ error: 'Tenant not found for this phone number' });
        }

        res.json({ tenantId: row.tenant_id });
    } catch (error) {
        console.error('Tenant lookup by phone error:', error);
        res.status(500).json({ error: error.message });
    }
}

async function getMetaCredentials(req, res) {
    const { tenantId } = req.params;

    try {
        const credentials = await whatsappService.getMetaCredentials(tenantId);

        if (!credentials) {
            return res.status(404).json({ error: 'Credentials not found' });
        }

        res.json(credentials);
    } catch (error) {
        console.error('Meta credentials error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    updateWhatsAppConfig,
    getWhatsAppConfig,
    handleSignupCallback,
    getTenantByPhone,
    getMetaCredentials
};
