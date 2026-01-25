const axios = require('axios');
const config = require('../config');

/**
 * Get conversation mapping from state manager
 * @param {string} conversationId - Genesys conversation ID
 * @returns {Promise<Object>} Mapping data with waId, phoneNumberId, and tenantId
 */
async function getConversationMapping(conversationId) {
    const response = await axios.get(
        `${config.services.stateManager}/state/conversation/${conversationId}`
    );
    return response.data;
}

/**
 * Store message tracking information
 * @param {Object} messageData - Message tracking data
 * @returns {Promise<Object>} Response from state manager
 */
async function storeMessageTracking(messageData) {
    const response = await axios.post(
        `${config.services.stateManager}/state/message`,
        messageData
    );
    return response.data;
}

module.exports = {
    getConversationMapping,
    storeMessageTracking
};
