/**
 * Transform Controller
 * Handles transformation request endpoints
 */

const { processInboundMessage } = require('../services/transformerService');

/**
 * Handle manual transformation request (for testing)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function transformInbound(req, res) {
    try {
        await processInboundMessage(req.body);
        res.json({ success: true, message: 'Message transformed and sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    transformInbound
};
