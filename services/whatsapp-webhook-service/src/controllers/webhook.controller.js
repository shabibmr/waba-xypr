/**
 * Webhook Controller
 * Handles webhook verification and event reception
 */

const config = require('../config/config');
const webhookProcessorService = require('../services/webhook-processor.service');
const Logger = require('../utils/logger');

/**
 * Handle webhook verification (GET request)
 * This is called by Meta to verify the webhook URL
 */
async function verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    Logger.info('WhatsApp webhook verification request received');

    if (mode === 'subscribe' && token === config.meta.verifyToken) {
        Logger.info('Webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        Logger.error('Webhook verification failed');
        res.sendStatus(403);
    }
}

/**
 * Handle webhook events (POST request)
 * This receives actual webhook events from Meta
 */
async function handleWebhook(req, res) {
    // Immediately respond to Meta (required within 20 seconds)
    res.sendStatus(200);

    // Process webhook asynchronously
    await webhookProcessorService.processWebhook(req.body, req.headers, req.rawBody);
}

/**
 * Test webhook endpoint for development
 */
async function testWebhook(req, res) {
    Logger.debug('Test webhook received', { body: req.body });
    res.json({
        success: true,
        received: req.body
    });
}

module.exports = {
    verifyWebhook,
    handleWebhook,
    testWebhook
};
