/**
 * Genesys Service
 * Handles communication with Genesys Cloud for sending messages
 */

import axios from 'axios';
// @ts-ignore
import servicesConfig from '../config/services';

/**
 * Send message to Genesys (via Genesys API Service)
 * @param {Object} genesysMessage - Formatted Genesys message
 * @param {string} conversationId - Conversation ID
 * @param {boolean} isNew - Whether this is a new conversation
 * @param {string} tenantId - Tenant ID for context
 * @returns {Promise<Object>} Genesys response
 */
export async function sendMessage(
    genesysMessage: any,
    conversationId: string,
    isNew: boolean,
    tenantId: string
): Promise<any> {
    const url = `${servicesConfig.genesys.baseUrl}${servicesConfig.genesys.endpoints.sendMessage}`;

    // Add isNew flag and conversationId to payload as expected by genesys-api-service
    const payload = {
        ...genesysMessage,
        conversationId,
        isNew
    };

    const response = await axios.post(url, payload, {
        headers: {
            'X-Tenant-ID': tenantId
        }
    });

    if (!response.data || !response.data.messageId) {
        throw new Error(`Invalid Genesys API response: missing 'messageId' field`);
    }

    return response.data;
}
