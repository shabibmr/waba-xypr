const axios = require('axios');
const config = require('../config');

/**
 * Send message to WhatsApp via Meta API
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {Object} message - Message in Meta WhatsApp format
 * @param {string} accessToken - Tenant-specific Meta access token
 * @returns {Promise<Object>} Response from Meta API
 */
async function sendMessage(phoneNumberId, message, accessToken) {
    const metaUrl = `https://graph.facebook.com/${config.meta.apiVersion}/${phoneNumberId}/messages`;

    const response = await axios.post(metaUrl, message, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

/**
 * Send template message to WhatsApp
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} waId - WhatsApp user ID
 * @param {string} templateName - Template name
 * @param {Array} parameters - Body parameters
 * @param {string} buttonParams - Optional button parameters
 * @param {string} accessToken - Tenant-specific Meta access token
 * @returns {Promise<Object>} Response from Meta API
 */
async function sendTemplateMessage(phoneNumberId, waId, templateName, parameters, buttonParams, accessToken) {
    const message = {
        messaging_product: 'whatsapp',
        to: waId,
        type: 'template',
        template: {
            name: templateName,
            language: { code: 'en' },
            components: [
                {
                    type: 'body',
                    parameters: parameters.map(p => ({ type: 'text', text: p }))
                }
            ]
        }
    };

    if (buttonParams) {
        message.template.components.push({
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: [{ type: 'text', text: buttonParams }]
        });
    }

    return sendMessage(phoneNumberId, message, accessToken);
}

module.exports = {
    sendMessage,
    sendTemplateMessage
};
