import express from 'express';
// @ts-ignore
import webhookController from '../controllers/webhook.controller';
// @ts-ignore
import validateSignature from '../middleware/validate-signature.middleware';

const router = express.Router();

router.post('/outbound', validateSignature, webhookController.handleOutboundMessage);
router.post('/events', validateSignature, webhookController.handleEvents);
router.post('/agent-state', webhookController.handleAgentState);
router.post('/test', webhookController.handleTest);

export default router;
