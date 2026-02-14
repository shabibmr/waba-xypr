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
    try {
        Logger.info('Incoming Webhook Payload', { body: JSON.stringify(req.body, null, 2) });

        // Process webhook synchronously and await completion
        await webhookProcessorService.processWebhook(req.body, req.headers, req.rawBody);

        // Only acknowledge success after processing completes
        res.sendStatus(200);
    } catch (error) {
        // Map error types to appropriate HTTP status codes
        if (error.name === 'SignatureVerificationError') {
            Logger.warn('Webhook signature verification failed', { error: error.message });
            return res.sendStatus(403);
        }

        if (error.name === 'TenantResolutionError') {
            Logger.error('Tenant resolution failed', error);
            return res.sendStatus(500);
        }

        // All other processing errors
        Logger.error('Webhook processing failed', error);
        res.sendStatus(500);
    }
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
