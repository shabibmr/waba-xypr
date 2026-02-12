const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { GenesysUser } = require('../models/Agent');
const rabbitMQService = require('../services/rabbitmq.service');
const mediaService = require('../services/media.service');
const socketEmitter = require('../services/socketEmitter');

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

        // Check if cached mapping exists (optional optimization, but Inbound Transformer handles it)

        // Construct payload for Inbound Transformer (simulating Meta webhook structure)
        // This ensures the message flows through the standard pipeline:
        // Inbound Transformer -> State Manager -> Genesys API


        // For direct processing by Inbound Transformer's processInboundMessage, 
        // we can simplify the payload if it accepts a flat object, 
        // but based on `processInboundMessage` signature it takes `metaMessage`.
        // `metaMessage` is expected to be the inner message object with injected tenantId.

        // Construct payload for Inbound Transformer (simulating Meta webhook structure)
        // This ensures the message flows through the standard pipeline:
        // RabbitMQ -> Inbound Transformer -> State Manager -> Genesys API
        const transformerPayload = {
            object: 'whatsapp_business_account',
            entry: [{
                changes: [{
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: {
                            display_phone_number: whatsappConfig.phone_number,
                            phone_number_id: whatsappConfig.phone_number_id
                        },
                        contacts: [{
                            profile: { name: 'Agent' }, // Placeholder
                            wa_id: to // The recipient (Customer) becomes the 'sender' in this flow context for Genesys
                        }],
                        messages: [{
                            from: to, // Mapped as 'sender' for Inbound Transformer
                            id: 'wamid.agent_' + Date.now(), // Synthetic ID
                            timestamp: Math.floor(Date.now() / 1000).toString(),
                            type: 'text',
                            text: { body: text },
                            tenantId: user.tenant_id // Custom field required by Inbound Transformer
                        }]
                    }
                }]
            }]
        };

        logger.info('Publishing agent message to RabbitMQ', {
            userId,
            to,
            queue: config.rabbitmq.queues.inboundMessages
        });

        // Publish to RabbitMQ
        await rabbitMQService.publishInboundMessage(transformerPayload);

        // Emit real-time event (Optimistic)
        socketEmitter.emitNewMessage(user.tenant_id, {
            ...transformerPayload.entry[0].changes[0].value.messages[0],
            direction: 'outbound', // Flag as outbound for UI
            status: 'queued'
        });

        res.json({
            success: true,
            message: 'Message queued for delivery',
            messageId: transformerPayload.entry[0].changes[0].value.messages[0].id
        });
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
