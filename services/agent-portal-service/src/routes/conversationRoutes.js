const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { authenticate, requireRole } = require('../middleware/authenticate');
const validate = require('../middleware/validation');
const conversationSchemas = require('../middleware/validation/conversation.schema');

// All conversation routes require authentication
router.get('/', authenticate, validate(conversationSchemas.listConversations, 'query'), conversationController.getConversations);
router.get('/:conversationId', authenticate, conversationController.getConversation);
router.get('/:conversationId/messages', authenticate, validate(conversationSchemas.getMessages, 'query'), conversationController.getMessages);
router.post('/:conversationId/assign', authenticate, conversationController.assignToMe);

// Transfer requires supervisor or admin role
router.post('/:conversationId/transfer',
    authenticate,
    requireRole(['admin', 'supervisor']),
    validate(conversationSchemas.transfer),
    conversationController.transferConversation
);

module.exports = router;
