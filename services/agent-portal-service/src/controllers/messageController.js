const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { GenesysUser } = require('../models/Agent');

/**
 * Send a text message
 * Uses tenant's WhatsApp credentials (shared WABA)
 */
async function sendMessage(req, res, next) {
    try {
        const userId = req.userId;
        const user = req.user;
        const { to, text } = req.body;

        if (!to || !text) {
            logger.warn('Send message missing required fields', { userId });
            return res.status(400).json({ error: 'Recipient and message text are required' });
        }

        logger.info('Sending text message', { userId, to, textLength: text.length });

        // Get tenant's WhatsApp configuration
        const whatsappConfig = await GenesysUser.getTenantWhatsAppConfig(userId);

        if (!whatsappConfig || !whatsappConfig.waba_id) {
            return res.status(400).json({
                error: 'WhatsApp not configured for your organization. Please contact your administrator.'
            });
        }

        // Send via WhatsApp API service with tenant ID header
        const response = await axios.post(
            `${config.services.whatsappApi}/whatsapp/send/text`,
            {
                to,
                text
            },
            {
                headers: {
                    'X-Tenant-ID': user.tenant_id,
                    'X-User-ID': userId // For tracking purposes
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        logger.error('Send message error', { error: error.message, userId: req.userId });
        next(error);
    }
}

/**
 * Send a template message
 */
async function sendTemplate(req, res, next) {
    try {
        const userId = req.userId;
        const user = req.user;
        const { to, template_name, parameters } = req.body;

        if (!to || !template_name) {
            logger.warn('Send template missing required fields', { userId });
            return res.status(400).json({ error: 'Recipient and template name are required' });
        }

        logger.info('Sending template message', { userId, to, templateName: template_name });

        // Get tenant's WhatsApp configuration
        const whatsappConfig = await GenesysUser.getTenantWhatsAppConfig(userId);

        if (!whatsappConfig || !whatsappConfig.waba_id) {
            return res.status(400).json({
                error: 'WhatsApp not configured for your organization. Please contact your administrator.'
            });
        }

        // Send via WhatsApp API service with tenant ID header
        const response = await axios.post(
            `${config.services.whatsappApi}/whatsapp/send/template`,
            {
                to,
                templateName: template_name,
                parameters: parameters || []
            },
            {
                headers: {
                    'X-Tenant-ID': user.tenant_id,
                    'X-User-ID': userId
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        logger.error('Send template error', { error: error.message, userId: req.userId });
        next(error);
    }
}

/**
 * Upload media file
 */
async function uploadMedia(req, res, next) {
    try {
        const userId = req.userId;
        const user = req.user;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Get tenant's WhatsApp configuration
        const whatsappConfig = await GenesysUser.getTenantWhatsAppConfig(userId);

        if (!whatsappConfig || !whatsappConfig.waba_id) {
            return res.status(400).json({
                error: 'WhatsApp not configured for your organization. Please contact your administrator.'
            });
        }

        logger.info('Media uploaded', {
            userId,
            mimeType: req.file.mimetype,
            size: req.file.size
        });

        // In a real implementation, we would upload to WhatsApp Media API
        // Using tenant's credentials
        res.json({
            media_id: 'mock_media_id_' + Date.now(),
            mime_type: req.file.mimetype,
            file_size: req.file.size
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    sendMessage,
    sendTemplate,
    uploadMedia
};
