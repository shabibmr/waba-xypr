// services/agent-widget/src/routes/widget.routes.js
const express = require('express');
const router = express.Router();
const widgetController = require('../controllers/widget.controller');

// Static widget page handled by express.static + explicit route in server.js
router.get('/config', widgetController.getConfig.bind(widgetController));

// API Routes
router.get('/api/conversation/:conversationId', widgetController.getConversation.bind(widgetController));
router.get('/api/customer/:waId', widgetController.getCustomer.bind(widgetController));
router.get('/api/conversation/:conversationId/history', widgetController.getHistory.bind(widgetController));
router.post('/api/send-template', widgetController.sendTemplate.bind(widgetController));
router.post('/api/send-message', widgetController.sendMessage.bind(widgetController));
router.post('/api/send-quick-reply', widgetController.sendQuickReply.bind(widgetController));
router.post('/api/upload-media', widgetController.uploadMiddleware, widgetController.uploadMedia.bind(widgetController));
router.post('/api/send-media', widgetController.uploadMiddleware, widgetController.sendMedia.bind(widgetController));
router.get('/api/templates', widgetController.getTemplates.bind(widgetController));
router.get('/api/socket-token', widgetController.getSocketToken.bind(widgetController));
router.get('/api/resolve-tenant', widgetController.resolveTenant.bind(widgetController));
router.get('/api/init', widgetController.initWidgetData.bind(widgetController));
router.get('/api/conversation/:conversationId/analytics', widgetController.getAnalytics.bind(widgetController));

module.exports = router;
