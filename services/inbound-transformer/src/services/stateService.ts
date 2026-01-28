/**
 * State Manager Service
 * Handles communication with the state-manager service for conversation mapping and message tracking
 */

import axios from 'axios';
// @ts-ignore
import servicesConfig from '../config/services';

/**
 * Get or create conversation mapping for a WhatsApp user
 * @param {string} waId - WhatsApp ID
 * @param {string} contactName - Contact name
 * @returns {Promise<{conversationId: string, isNew: boolean}>}
 */
export async function getConversationMapping(waId: string, contactName: string): Promise<{ conversationId: string, isNew: boolean }> {
    const url = `${servicesConfig.stateManager.url}${servicesConfig.stateManager.endpoints.mapping}`;

    const response = await axios.post(url, {
        waId,
        contactName
    });

    return response.data;
}

/**
 * Track message in state manager
 * @param {Object} messageData - Message tracking data
 * @returns {Promise<Object>}
 */
export async function trackMessage(messageData: any): Promise<any> {
    const url = `${servicesConfig.stateManager.url}${servicesConfig.stateManager.endpoints.message}`;

    const response = await axios.post(url, messageData);

    return response.data;
}
