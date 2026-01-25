const express = require('express');
const router = express.Router();
const rabbitMQService = require('../services/rabbitmq.service');

router.get('/', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'genesys-webhook-service',
        rabbitmq: rabbitMQService.isConnected ? 'connected' : 'disconnected'
    });
});

module.exports = router;
