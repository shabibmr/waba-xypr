/**
 * Health Routes
 * Defines health check endpoints
 */

const express = require('express');
const router = express.Router();
const rabbitMQService = require('../services/rabbitmq.service');

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    const rabbitStatus = rabbitMQService.getStatus();

    res.json({
        status: 'healthy',
        service: 'whatsapp-webhook',
        rabbitmq: rabbitStatus.connected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
