// services/agent-widget/src/routes/widget.routes.js
const express = require('express');
const router = express.Router();
const widgetController = require('../controllers/widget.controller');

// Static widget page
router.get('/', widgetController.getWidgetPage);
router.get('/config', widgetController.getConfig);

// API Routes
router.get('/api/conversation/:conversationId', widgetController.getConversation);
router.get('/api/customer/:waId', widgetController.getCustomer);
router.get('/api/conversation/:conversationId/history', widgetController.getHistory);
router.post('/api/send-template', widgetController.sendTemplate);
router.post('/api/send-message', widgetController.sendMessage.bind(widgetController));
router.post('/api/send-quick-reply', widgetController.sendQuickReply);
router.post('/api/upload-media', widgetController.uploadMiddleware, widgetController.uploadMedia.bind(widgetController));
router.post('/api/send-media', widgetController.uploadMiddleware, widgetController.sendMedia.bind(widgetController));
router.get('/api/templates', widgetController.getTemplates);
router.get('/api/resolve-tenant', widgetController.resolveTenant);
router.get('/api/conversation/:conversationId/analytics', widgetController.getAnalytics);

module.exports = router;
