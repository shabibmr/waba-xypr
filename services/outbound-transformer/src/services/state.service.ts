import axios from 'axios';
// @ts-ignore
import config from '../config';

/**
 * Get conversation mapping from state manager
 * @param {string} conversationId - Genesys conversation ID
 * @returns {Promise<Object>} Mapping data with waId, phoneNumberId, and tenantId
 */
export async function getConversationMapping(conversationId: string) {
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
export async function storeMessageTracking(messageData: any) {
    const response = await axios.post(
        `${config.services.stateManager}/state/message`,
        messageData
    );
    return response.data;
}
