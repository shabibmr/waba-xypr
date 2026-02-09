// services/agent-widget/src/controllers/widget.controller.js
const widgetService = require('../services/widget.service');
const config = require('../config');

class WidgetController {

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

    // Send quick reply
    async sendQuickReply(req, res) {
        const { conversationId, waId, text } = req.body;
        const tenantId = req.headers['x-tenant-id'] || 'default';

        if (!conversationId || !waId || !text) {
            return res.status(400).json({
                error: 'conversationId, waId, and text are required'
            });
        }

        try {
            const result = await widgetService.sendQuickReply({ waId, text }, tenantId);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                error: 'Failed to send message',
                details: error.response?.data
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

    // Health check
    health(req, res) {
        res.json({ status: 'healthy', service: 'agent-widget' });
    }
}

module.exports = new WidgetController();
