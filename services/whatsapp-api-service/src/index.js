/**
 * WhatsApp API Service
 * Consumes from outbound-ready queue and delivers messages to Meta Graph API.
 */
const express = require('express');
const config = require('./config/config');
const Logger = require('./utils/logger');
const { startConsumer, isConnected } = require('./services/rabbitmq.service');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'whatsapp-api',
        rabbitmq: isConnected() ? 'connected' : 'disconnected'
    });
});

app.listen(config.port, async () => {
    Logger.info(`WhatsApp API Service running on port ${config.port}`);
    await startConsumer();
});
