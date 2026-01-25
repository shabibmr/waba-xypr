/**
 * Webhook Routes
 * Defines routes for WhatsApp webhook endpoints
 */

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

// Webhook verification endpoint (GET)
router.get('/whatsapp', webhookController.verifyWebhook);

// Webhook event receiver (POST)
router.post('/whatsapp', webhookController.handleWebhook);

// Test endpoint for development (POST)
router.post('/whatsapp/test', webhookController.testWebhook);

module.exports = router;
