const { extractTemplateComponents, containsUrl } = require('../utils/template.util');

/**
 * Transform Genesys format to Meta WhatsApp format
 * @param {Object} genesysMessage - Message in Genesys format
 * @param {string} recipientWaId - WhatsApp ID of recipient
 * @returns {Object} Message in Meta WhatsApp format
 */
function transformToMetaFormat(genesysMessage, recipientWaId) {
    const message = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientWaId
    };

    // Handle different message types
    if (genesysMessage.text) {
        // Check if it's a template message (starts with special marker)
        if (genesysMessage.text.startsWith('{{TEMPLATE:')) {
            const templateMatch = genesysMessage.text.match(/{{TEMPLATE:(\w+)}}/);
            if (templateMatch) {
                return {
                    ...message,
                    type: 'template',
                    template: {
                        name: templateMatch[1],
                        language: { code: 'en' },
                        components: extractTemplateComponents(genesysMessage.text)
                    }
                };
            }
        }

        // Regular text message
        message.type = 'text';
        message.text = {
            preview_url: containsUrl(genesysMessage.text),
            body: genesysMessage.text
        };
    }

    return message;
}

module.exports = {
    transformToMetaFormat
};
