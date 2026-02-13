import express from 'express';
// @ts-ignore
import webhookController from '../controllers/webhook.controller';
// @ts-ignore
import validateSignature from '../middleware/validate-signature.middleware';

const router = express.Router();

// Primary endpoint — all Genesys Open Messaging events come here
router.post('/', validateSignature, webhookController.handleWebhook);

// Test endpoint (no signature required)
router.post('/test', webhookController.handleTest);

export default router;
