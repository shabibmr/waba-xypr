const whatsappService = require('../services/whatsappService');
const axios = require('axios');

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
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Authorization code required' });
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

        // Get phone number details
        const phoneResponse = await axios.get(`https://graph.facebook.com/v18.0/${wabaData.target_ids[0]}`, {
            params: { access_token },
            headers: { 'Authorization': `Bearer ${access_token}` }
        });

        const phoneData = phoneResponse.data;

        res.json({
            wabaId: wabaData.target_ids[0],
            phoneNumberId: phoneData.id,
            displayPhoneNumber: phoneData.display_phone_number,
            qualityRating: phoneData.quality_rating,
            accessToken: access_token,
            businessId: phoneData.business_id || null
        });
    } catch (error) {
        console.error('WhatsApp signup error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to complete WhatsApp signup',
            details: error.response?.data?.error?.message
        });
    }
}

module.exports = {
    updateWhatsAppConfig,
    getWhatsAppConfig,
    handleSignupCallback
};
