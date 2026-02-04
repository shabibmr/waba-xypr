const logger = require('../utils/logger');
const { GenesysUser } = require('../models/Agent');
const axios = require('axios');

/**
 * Get tenant's WhatsApp connection status
 * (WhatsApp is configured at organization level, not individual user level)
 */
async function getWhatsAppStatus(req, res, next) {
    try {
        const userId = req.userId;

        logger.info('Checking WhatsApp status', { userId });

        const whatsappConfig = await GenesysUser.getTenantWhatsAppConfig(userId);

        if (!whatsappConfig || !whatsappConfig.waba_id) {
            return res.json({
                connected: false,
                message: 'WhatsApp not configured for your organization. Please contact your administrator.'
            });
        }

        res.json({
            connected: true,
            waba_id: whatsappConfig.waba_id,
            phone_number_id: whatsappConfig.phone_number_id,
            phone_number: whatsappConfig.display_phone_number,
            organization_name: whatsappConfig.tenant_name,
            created_at: whatsappConfig.created_at,
            note: 'This WhatsApp account is shared by all users in your organization.'
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Complete WhatsApp setup
 */
async function completeSetup(req, res, next) {
    try {
        const userId = req.userId;
        const { code } = req.body;

        logger.info('Completing WhatsApp setup', { userId });

        if (!code) {
            return res.status(400).json({ error: 'Missing authorization code' });
        }

        // 1. Exchange code for access token
        const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token`;
        const tokenParams = {
            client_id: process.env.GENESYS_CLIENT_ID || '1207750114647396', // Fallback to provided ID if env missing
            client_secret: process.env.META_APP_SECRET || '8937a0d2b0f5cd514ade4b2c5439e685',
            code,
            redirect_uri: req.headers.origin + '/onboarding' // Redirect URI must match the one used in the popup
        };

        // Note: Using META_APP_ID from .env would be better, but assuming variable naming
        // Correcting to use META_APP_ID if available
        if (process.env.META_APP_ID) tokenParams.client_id = process.env.META_APP_ID;

        logger.info('Exchanging code for token', { clientId: tokenParams.client_id });

        const tokenResponse = await axios.get(tokenUrl, { params: tokenParams });
        const { access_token } = tokenResponse.data;

        if (!access_token) {
            throw new Error('Failed to obtain access token from Meta');
        }

        // 2. Fetch WABA ID and Phone Number
        // We get the list of WABAs shared with this user/app
        const debugTokenUrl = `https://graph.facebook.com/v18.0/debug_token`;
        const debugResponse = await axios.get(debugTokenUrl, {
            params: {
                input_token: access_token,
                access_token: `${tokenParams.client_id}|${tokenParams.client_secret}`
            }
        });

        const sharedWabaId = debugResponse.data.data.granular_scopes.find(scope => scope.scope === 'whatsapp_business_management')?.target_ids[0];

        // If we can't find it in granular scopes (sometimes happens), try fetching WABAs directly
        let wabaId = sharedWabaId;

        // 3. Get Phone Numbers for the WABA
        if (!wabaId) {
            // Alternative: Fetch client_whatsapp_business_accounts from the user node
            const userWabaResponse = await axios.get(`https://graph.facebook.com/v18.0/me/client_whatsapp_business_accounts`, {
                params: { access_token }
            });
            wabaId = userWabaResponse.data.data[0]?.id;
        }

        if (!wabaId) {
            throw new Error('No WhatsApp Business Account found');
        }

        // Get Phone Number
        const phoneNumbersResponse = await axios.get(`https://graph.facebook.com/v18.0/${wabaId}/phone_numbers`, {
            params: { access_token }
        });

        const phoneNumberData = phoneNumbersResponse.data.data[0];
        if (!phoneNumberData) {
            throw new Error('No phone number found in the WhatsApp Business Account');
        }

        const { id: phone_number_id, display_phone_number } = phoneNumberData;

        // 3. Save Configuration
        const config = await GenesysUser.saveTenantWhatsAppConfig(userId, {
            waba_id: wabaId,
            phone_number_id,
            display_phone_number,
            access_token
        });

        res.json({
            success: true,
            message: 'WhatsApp connected successfully',
            data: config
        });
    } catch (error) {
        logger.error('WhatsApp setup failed', { error: error.message, response: error.response?.data });
        res.status(500).json({
            error: 'WhatsApp setup failed',
            details: error.response?.data?.error?.message || error.message
        });
    }
}

module.exports = {
    getWhatsAppStatus,
    completeSetup,
    skipSetup
};

/**
 * Skip setup and use demo/seed credentials
 */
async function skipSetup(req, res, next) {
    try {
        const userId = req.userId;
        logger.info('Skipping WhatsApp setup, using seed data', { userId });

        // Seed Data
        const seedConfig = {
            waba_id: '667044745953003',
            phone_number_id: '888340727686839',
            display_phone_number: '+1555023902',
            access_token: 'EAAQhGGulP70BPmNwdzOALJ3CPc6ivZCr41oECVDfifZBbIotzMgQL7dKRUyaWSZBpOPZC9mkGkZBKrs0ITG1G6TuLnxLBG0oFCqSLuA8ZA62BLirO5snyjxkkjJx4oJYnzlmg9ijPRiACoox0zpU3e237BlObJ9nHFquHSM69qURKF6cDtcK6SsKgGGaVbvHnjhwZDZD'
        };

        const config = await GenesysUser.saveTenantWhatsAppConfig(userId, seedConfig);

        res.json({
            success: true,
            message: 'WhatsApp setup skipped (Demo Mode enabled)',
            data: config
        });
    } catch (error) {
        next(error);
    }
}
