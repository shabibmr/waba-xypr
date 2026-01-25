const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

const validateSignature = require('../middleware/validate-signature.middleware');

router.post('/outbound', validateSignature, webhookController.handleOutboundMessage);
router.post('/events', validateSignature, webhookController.handleEvents);
router.post('/agent-state', webhookController.handleAgentState);
router.post('/test', webhookController.handleTest);

module.exports = router;
