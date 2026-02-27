const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const mediaService = require('../services/media.service');

/**
 * Send a text message via Genesys Cloud Open Messaging API.
 *
 * Flow:
 *   1. Resolve wa_id from state-manager using conversationId
 *   2. Store outbound message in state-manager (queued) before sending
 *   3. Fetch Genesys token from auth-service
 *   4. Fetch tenant Genesys region from tenant-service
 *   5. POST to Genesys Conversations API — triggers normal outbound pipeline
 *   6. Update message status to 'sent' in state-manager
 */
async function sendMessage(req, res, next) {
    const tenantId = req.tenant?.id || req.user?.tenant_id;
    const { conversationId, text, messageId } = req.body;

    if (!tenantId) {
        return res.status(401).json({ error: { message: 'Tenant context required', code: 'NO_TENANT' } });
    }

    const syntheticWamid = messageId || `agent_${uuidv4()}`;
    const tenantHeader = { 'X-Tenant-ID': tenantId };

    try {
        // 1. Resolve mapping (wa_id + internalId) from state-manager
        const mappingRes = await axios.get(
            `${config.services.stateManager}/conversation/${conversationId}`,
            { headers: tenantHeader }
        );
        const mapping = mappingRes.data;

        if (!mapping?.waId) {
            return res.status(404).json({ error: { message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' } });
        }

        // 2. Store outbound message (queued) before dispatching
        await axios.post(
            `${config.services.stateManager}/message`,
            {
                wamid: syntheticWamid,
                mappingId: mapping.internalId,
                direction: 'outbound',
                status: 'queued'
            },
            { headers: tenantHeader }
        );

        // 3. Fetch Genesys token from auth-service
        const tokenRes = await axios.post(
            `${config.services.authService}/api/v1/token`,
            { tenantId, type: 'genesys' },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_SECRET || ''}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        const genesysToken = tokenRes.data.accessToken;

        // 4. Fetch tenant to get Genesys region
        const tenantRes = await axios.get(
            `${config.services.tenantService}/tenants/${tenantId}`,
            { headers: tenantHeader }
        );
        const region = tenantRes.data.genesysRegion || config.genesys.region;

        // 5. Send via Genesys Conversations API — triggers normal outbound pipeline to WhatsApp
        await axios.post(
            `https://api.${region}/api/v2/conversations/${conversationId}/messages`,
            { body: text, bodyType: 'standard' },
            {
                headers: {
                    'Authorization': `Bearer ${genesysToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        // 6. Update message status to sent (non-fatal if this fails)
        await axios.patch(
            `${config.services.stateManager}/message/${syntheticWamid}/status`,
            { status: 'sent' },
            { headers: tenantHeader }
        ).catch(err => {
            logger.warn('Failed to update message status to sent', { syntheticWamid, error: err.message });
        });

        logger.info('Agent message sent via Genesys', { tenantId, conversationId, syntheticWamid });

        res.json({
            success: true,
            messageId: syntheticWamid,
            message: 'Message delivered to Genesys'
        });

    } catch (error) {
        logger.error('Send message error', {
            tenantId,
            conversationId,
            error: error.message,
            status: error.response?.status
        });

        if (error.response?.status === 404) {
            return res.status(404).json({ error: { message: 'Conversation not found', code: 'NOT_FOUND' } });
        }
        if (error.response?.status === 401 || error.response?.status === 403) {
            return res.status(502).json({ error: { message: 'Genesys authentication failed', code: 'GENESYS_AUTH_FAILED' } });
        }
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
        const { to, template_name, language, parameters } = req.body;

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
                language: language || 'en_US',
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

        // Upload to MinIO
        const result = await mediaService.uploadMedia(
            req.file.buffer,
            req.file.mimetype,
            user.tenant_id
        );

        res.json({
            media_id: 'minio_' + Date.now(), // Placeholder ID, real implementation might store this mapping
            mime_type: result.mimeType,
            file_size: result.fileSize,
            url: result.publicUrl
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
