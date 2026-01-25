const { getConversationMapping } = require('../services/state.service');
const { sendTemplateMessage } = require('../services/whatsapp.service');

/**
 * Send template message endpoint handler
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function sendTemplate(req, res, next) {
    try {
        const { conversationId, templateName, parameters, buttonParams } = req.body;

        // Get WhatsApp ID from conversation
        const { waId, phoneNumberId } = await getConversationMapping(conversationId);

        // Send template message
        const response = await sendTemplateMessage(
            phoneNumberId,
            waId,
            templateName,
            parameters,
            buttonParams
        );

        res.json({ success: true, messageId: response.messages[0].id });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    sendTemplate
};
