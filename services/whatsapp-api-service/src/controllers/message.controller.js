/**
 * Message Controller
 * Handles requests for sending WhatsApp messages
 */
const whatsappService = require('../services/whatsapp.service');
const Logger = require('../utils/logger');

class MessageController {
    async sendText(req, res, next) {
        try {
            const { to, text, previewUrl = true } = req.body;
            const tenantId = req.tenant.id;

            if (!to || !text) {
                return res.status(400).json({ error: 'to and text are required' });
            }

            const response = await whatsappService.sendText(tenantId, to, text, previewUrl);

            Logger.forTenant(tenantId).info(`Text message sent to ${to}`, { messageId: response.messages[0].id });

            res.json({
                success: true,
                messageId: response.messages[0].id,
                to,
                tenantId
            });
        } catch (error) {
            next(error);
        }
    }

    async sendTemplate(req, res, next) {
        try {
            const { to, templateName, language = 'en', components = [] } = req.body;
            const tenantId = req.tenant.id;

            if (!to || !templateName) {
                return res.status(400).json({ error: 'to and templateName are required' });
            }

            const response = await whatsappService.sendTemplate(tenantId, to, templateName, language, components);

            Logger.forTenant(tenantId).info(`Template message sent to ${to}`, { templateName });

            res.json({
                success: true,
                messageId: response.messages[0].id,
                to,
                template: templateName,
                tenantId
            });
        } catch (error) {
            next(error);
        }
    }

    async sendImage(req, res, next) {
        try {
            const { to, imageUrl, caption } = req.body;
            const tenantId = req.tenant.id;

            if (!to || !imageUrl) {
                return res.status(400).json({ error: 'to and imageUrl are required' });
            }

            const response = await whatsappService.sendImage(tenantId, to, imageUrl, caption);

            Logger.forTenant(tenantId).info(`Image sent to ${to}`);

            res.json({
                success: true,
                messageId: response.messages[0].id,
                to,
                tenantId
            });
        } catch (error) {
            next(error);
        }
    }

    async sendDocument(req, res, next) {
        try {
            const { to, documentUrl, filename, caption } = req.body;
            const tenantId = req.tenant.id;

            if (!to || !documentUrl) {
                return res.status(400).json({ error: 'to and documentUrl are required' });
            }

            const response = await whatsappService.sendDocument(tenantId, to, documentUrl, filename, caption);

            Logger.forTenant(tenantId).info(`Document sent to ${to}`);

            res.json({
                success: true,
                messageId: response.messages[0].id,
                to,
                tenantId
            });
        } catch (error) {
            next(error);
        }
    }

    async sendLocation(req, res, next) {
        try {
            const { to, latitude, longitude, name, address } = req.body;
            const tenantId = req.tenant.id;

            if (!to || !latitude || !longitude) {
                return res.status(400).json({ error: 'to, latitude, and longitude are required' });
            }

            const response = await whatsappService.sendLocation(tenantId, to, latitude, longitude, name, address);

            Logger.forTenant(tenantId).info(`Location sent to ${to}`);

            res.json({
                success: true,
                messageId: response.messages[0].id,
                to,
                tenantId
            });
        } catch (error) {
            next(error);
        }
    }

    async sendButtons(req, res, next) {
        try {
            const { to, bodyText, buttons } = req.body;
            const tenantId = req.tenant.id;

            if (!to || !bodyText || !buttons || buttons.length === 0) {
                return res.status(400).json({ error: 'to, bodyText, and buttons are required' });
            }

            const response = await whatsappService.sendButtons(tenantId, to, bodyText, buttons);

            Logger.forTenant(tenantId).info(`Interactive buttons sent to ${to}`);

            res.json({
                success: true,
                messageId: response.messages[0].id,
                to,
                tenantId
            });
        } catch (error) {
            next(error);
        }
    }

    async markAsRead(req, res, next) {
        try {
            const { messageId } = req.body;
            const tenantId = req.tenant.id;

            if (!messageId) {
                return res.status(400).json({ error: 'messageId is required' });
            }

            await whatsappService.markAsRead(tenantId, messageId);

            Logger.forTenant(tenantId).info(`Message marked as read`, { messageId });

            res.json({ success: true, messageId, tenantId });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new MessageController();
