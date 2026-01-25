const { getChannel } = require('../services/rabbitmq.service');

/**
 * Health check endpoint handler
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
function healthCheck(req, res) {
    const rabbitChannel = getChannel();

    res.json({
        status: 'healthy',
        rabbitmq: rabbitChannel ? 'connected' : 'disconnected'
    });
}

module.exports = {
    healthCheck
};
