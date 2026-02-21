// services/agent-widget/src/controllers/widget.controller.js
const widgetService = require('../services/widget.service');
const config = require('../config');
const multer = require('multer');

// Multer for widget media uploads (16 MB)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024 }
});

class WidgetController {

    // Expose multer middleware for routes
    get uploadMiddleware() {
        return upload.single('file');
    }

    // Get public widget page
    getWidgetPage(req, res) {
        // Note: This relies on express.static being set up in server.js
        // We'll handle the pathing in server.js or return the file here if needed
        // For now, let's assume valid redirect or file send is handled by route definition
        // But typically controller handles JSON logic. 
        // The static file serving is best left to express static middleware, 
        // but the route /widget can send the specific html file.
        const path = require('path');
        res.sendFile(path.join(__dirname, '../public/widget.html'));
    }

    // Get widget configuration
    getConfig(req, res) {
        res.json({
            widgetUrl: `${config.publicUrl}/widget`,
            apiBaseUrl: `${config.publicUrl}/widget/api`,
            genesysClientId: config.genesysClientId,
            genesysRegion: config.genesysRegion,
            features: config.features
        });
    }

    // Get conversation details
    async getConversation(req, res) {
        const { conversationId } = req.params;
        const tenantId = req.headers['x-tenant-id'] || 'default';

        try {
            const data = await widgetService.getConversationDetails(conversationId, tenantId);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch conversation details' });
        }
    }

    // Get customer details
    async getCustomer(req, res) {
        const { waId } = req.params;
        const tenantId = req.headers['x-tenant-id'] || 'default';

        try {
            const data = await widgetService.getCustomer(waId, tenantId);
            res.json(data);
        } catch (error) {
            if (error.message === 'Customer not found') {
                res.status(404).json({ error: 'Customer not found' });
            } else {
                res.status(500).json({ error: 'Failed to fetch customer details' });
            }
        }
    }

    // Get message history
    async getHistory(req, res) {
        const { conversationId } = req.params;
        const { limit, offset } = req.query;
        // Check for tenant_id first then x-tenant-id header
        const tenantId = req.headers['x-tenant-id'] || 'default';

        try {
            const data = await widgetService.getMessageHistory(conversationId, { limit, offset }, tenantId);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch message history' });
        }
    }

    // Send template
    async sendTemplate(req, res) {
        const { conversationId, waId, templateName, parameters } = req.body;
        const tenantId = req.headers['x-tenant-id'] || 'default';

        if (!conversationId || !waId || !templateName) {
            return res.status(400).json({
                error: 'conversationId, waId, and templateName are required'
            });
        }

        try {
            const result = await widgetService.sendTemplate({ waId, templateName, parameters }, tenantId);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                error: 'Failed to send template',
                details: error.response?.data
            });
        }
    }

    /**
     * Send a quick reply (text) via agent-portal-service
     */
    async sendQuickReply(req, res) {
        const { conversationId, waId, text } = req.body;
        const tenantId = req.headers['x-tenant-id'] || req.body.tenantId || 'default';
        const genesysToken = req.headers['x-genesys-auth-token'];

        if (!conversationId || !waId || !text) {
            return res.status(400).json({
                error: 'conversationId, waId, and text are required'
            });
        }

        try {
            const result = await widgetService.sendQuickReply({ conversationId, waId, text, genesysToken }, tenantId);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                error: 'Failed to send message',
                details: error.response?.data
            });
        }
    }

    async sendMessage(req, res) {
        const { conversationId, waId, text, mediaUrl, mediaType, caption, integrationId } = req.body;
        // Extract tenantId from header or body, fallback to default
        const tenantId = req.headers['x-tenant-id'] || req.body.tenant_id || req.body.tenantId || 'default';
        const genesysToken = req.headers['x-genesys-auth-token'];

        if (!conversationId || !waId) {
            return res.status(400).json({
                error: 'conversationId and waId are required'
            });
        }

        try {
            let result;
            if (mediaUrl) {
                // Send media message
                result = await widgetService.sendMediaMessage({
                    conversationId,
                    waId,
                    text: caption || text || '',
                    mediaUrl,
                    mediaType: mediaType || 'document',
                    integrationId,
                    genesysToken
                }, tenantId);
            } else if (text) {
                // Send text message
                result = await widgetService.sendQuickReply({
                    conversationId,
                    waId,
                    text,
                    integrationId,
                    genesysToken
                }, tenantId);
            } else {
                return res.status(400).json({
                    error: 'Either text or mediaUrl is required'
                });
            }

            res.json(result);
        } catch (error) {
            console.error('[WidgetController] sendMessage error:', error);
            res.status(500).json({
                error: 'Failed to send message',
                details: error.response?.data || error.message
            });
        }
    }

    // Upload media only (returns url + mimeType for two-step send)
    async uploadMedia(req, res) {
        const tenantId = req.headers['x-tenant-id'] || 'default';

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            const result = await widgetService.uploadMedia(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype,
                tenantId
            );
            res.json(result); // { url, mimeType, fileSize }
        } catch (error) {
            res.status(500).json({
                error: 'Failed to upload media',
                details: error.response?.data || error.message
            });
        }
    }

    // Send media message (upload file + send via Genesys)
    async sendMedia(req, res) {
        const tenantId = req.headers['x-tenant-id'] || 'default';
        const genesysToken = req.headers['x-genesys-auth-token'];
        const { conversationId, waId, caption } = req.body;

        if (!conversationId || !waId) {
            return res.status(400).json({
                error: 'conversationId and waId are required'
            });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            // 1. Upload to MinIO via portal
            const uploadResult = await widgetService.uploadMedia(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype,
                tenantId
            );

            // 2. Determine media type from MIME
            const mediaType = this._resolveMediaType(req.file.mimetype);

            // 3. Send media message via portal
            const result = await widgetService.sendMediaMessage({
                conversationId,
                waId,
                text: caption || '',
                mediaUrl: uploadResult.url,
                mediaType,
                genesysToken
            }, tenantId);

            res.json({
                success: true,
                messageId: result.messageId,
                mediaUrl: uploadResult.url,
                mediaType
            });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to send media message',
                details: error.response?.data || error.message
            });
        }
    }

    // Get templates
    async getTemplates(req, res) {
        const tenantId = req.headers['x-tenant-id'] || 'default';
        try {
            const templates = await widgetService.getTemplates(tenantId);
            res.json({ templates, tenantId });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch templates' });
        }
    }

    // Get analytics
    async getAnalytics(req, res) {
        const { conversationId } = req.params;
        const tenantId = req.headers['x-tenant-id'] || 'default';

        try {
            const data = await widgetService.getAnalytics(conversationId, tenantId);
            res.json({ analytics: data, conversationId });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch analytics' });
        }
    }

    // Resolve tenantId from conversation's integration ID
    async resolveTenant(req, res) {
        const { conversationId } = req.query;
        if (!conversationId) {
            return res.status(400).json({ error: 'conversationId query param required' });
        }
        try {
            const result = await widgetService.resolveTenantByConversation(conversationId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to resolve tenant', tenantId: 'default' });
        }
    }

    // Unified initialization endpoint
    async initWidgetData(req, res) {
        const { conversationId } = req.query;
        if (!conversationId) {
            return res.status(400).json({ error: 'conversationId query param required' });
        }

        try {
            // 1. Resolve tenant
            const tenantInfo = await widgetService.resolveTenantByConversation(conversationId);
            const tenantId = tenantInfo.tenantId;

            // 2. Fetch conversation details and history in parallel
            const [customerData, messageHistory] = await Promise.all([
                widgetService.getConversationDetails(conversationId, tenantId).catch(err => ({ error: err.message })),
                widgetService.getMessageHistory(conversationId, { limit: 30, offset: 0 }, tenantId).catch(err => ({ error: err.message }))
            ]);

            res.json({
                tenantId,
                customerData,
                messageHistory
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to initialize widget data' });
        }
    }

    // Health check
    health(req, res) {
        res.json({ status: 'healthy', service: 'agent-widget' });
    }

    // Helper: resolve MIME type to media category
    _resolveMediaType(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        return 'document';
    }
}

module.exports = new WidgetController();
