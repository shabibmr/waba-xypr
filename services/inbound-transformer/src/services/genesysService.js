/**
 * Genesys Service
 * Handles communication with Genesys Cloud for sending messages
 */

const axios = require('axios');
const servicesConfig = require('../config/services');

/**
 * Get authentication token from auth service
 * @returns {Promise<string>} Auth token
 */
async function getAuthToken() {
    const url = `${servicesConfig.authService.url}${servicesConfig.authService.endpoints.token}`;

    const response = await axios.get(url);

    return response.data.token;
}

/**
 * Send message to Genesys
 * @param {Object} genesysMessage - Formatted Genesys message
 * @param {string} conversationId - Conversation ID (null for new conversations)
 * @param {boolean} isNew - Whether this is a new conversation
 * @returns {Promise<Object>} Genesys response
 */
async function sendMessage(genesysMessage, conversationId, isNew) {
    const token = await getAuthToken();

    const url = isNew
        ? `${servicesConfig.genesys.baseUrl}${servicesConfig.genesys.endpoints.newConversation}`
        : `${servicesConfig.genesys.baseUrl}${servicesConfig.genesys.endpoints.existingConversation(conversationId)}`;

    const response = await axios.post(url, genesysMessage, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

module.exports = {
    getAuthToken,
    sendMessage
};
