/**
 * Genesys routes
 * Defines all Genesys API endpoints
 */

import express from 'express';
// @ts-ignore
import * as genesysController from '../controllers/genesys.controller';

const router = express.Router();

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
router.get('/conversations/:conversationId/messages', genesysController.getConversationMessages);

// Get organization details
router.get('/organization', genesysController.getOrganizationDetails);

// Get organization users
router.get('/organization/users', genesysController.getOrganizationUsers);

// Get specific Genesys user
router.get('/users/:userId', genesysController.getGenesysUser);

export default router;
