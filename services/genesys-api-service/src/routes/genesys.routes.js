/**
 * Genesys routes
 * Defines all Genesys API endpoints
 */

const express = require('express');
const router = express.Router();
const genesysController = require('../controllers/genesys.controller');

// Send inbound message to Genesys
router.post('/messages/inbound', genesysController.sendInboundMessage);

// Send delivery receipt to Genesys
router.post('/receipts', genesysController.sendReceipt);

// Get conversation details
router.get('/conversations/:conversationId', genesysController.getConversation);

// Update conversation attributes
router.patch('/conversations/:conversationId', genesysController.updateConversationAttributes);

// Disconnect conversation
router.post('/conversations/:conversationId/disconnect', genesysController.disconnectConversation);

// Send typing indicator
router.post('/conversations/:conversationId/typing', genesysController.sendTypingIndicator);

// Get conversation messages
// Get conversation messages
router.get('/conversations/:conversationId/messages', genesysController.getConversationMessages);

// Get organization details
router.get('/organization', genesysController.getOrganizationDetails);

// Get organization users
router.get('/organization/users', genesysController.getOrganizationUsers);

// Get specific Genesys user
router.get('/users/:userId', genesysController.getGenesysUser);

module.exports = router;
