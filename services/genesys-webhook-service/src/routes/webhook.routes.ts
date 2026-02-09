import express from 'express';
// @ts-ignore
import webhookController from '../controllers/webhook.controller';
// @ts-ignore
import validateSignature from '../middleware/validate-signature.middleware';

const router = express.Router();

// Single consolidated endpoint - Genesys Open Messaging sends all events to one URL
router.post('/', validateSignature, webhookController.handleWebhook);

// Legacy routes (deprecated - for backward compatibility during transition)
router.post('/outbound', validateSignature, webhookController.handleWebhook);
router.post('/events', validateSignature, webhookController.handleWebhook);
router.post('/agent-state', webhookController.handleAgentState);
router.post('/test', webhookController.handleTest);

export default router;
