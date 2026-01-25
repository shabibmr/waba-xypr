const { processOutboundMessage } = require('../services/message-processor.service');

/**
 * Manual transform endpoint handler (for testing)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function transformOutbound(req, res, next) {
    try {
        await processOutboundMessage(req.body);
        res.json({ success: true, message: 'Message transformed and sent' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    transformOutbound
};
