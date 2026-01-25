/**
 * Health Controller
 * Handles health check endpoints
 */

const { getChannel } = require('../consumers/inboundConsumer');

/**
 * Health check endpoint handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function healthCheck(req, res) {
    const channel = getChannel();

    res.json({
        status: 'healthy',
        rabbitmq: channel ? 'connected' : 'disconnected'
    });
}

module.exports = {
    healthCheck
};
