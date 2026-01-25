const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { authenticate, requireRole } = require('../middleware/authenticate');

// All conversation routes require authentication
router.get('/', authenticate, conversationController.getConversations);
router.get('/:conversationId', authenticate, conversationController.getConversation);
router.get('/:conversationId/messages', authenticate, conversationController.getMessages);
router.post('/:conversationId/assign', authenticate, conversationController.assignToMe);

// Transfer requires supervisor or admin role
router.post('/:conversationId/transfer',
    authenticate,
    requireRole(['admin', 'supervisor']),
    conversationController.transferConversation
);

module.exports = router;
