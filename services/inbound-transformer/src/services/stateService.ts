/**
 * State Manager Service
 * Handles communication with the state-manager service for conversation mapping and message tracking
 */

import axios from 'axios';
// @ts-ignore
import servicesConfig from '../config/services';

/**
 * Get or create conversation mapping for WhatsApp ID
 * @param {string} waId - WhatsApp ID
 * @param {string} contactName - Contact name
 * @param {string} tenantId - Tenant ID for context
 * @returns {Promise<Object>} Conversation mapping
 */
export async function getConversationMapping(
    waId: string,
    contactName: string,
    tenantId: string
): Promise<any> {
    const url = `${servicesConfig.stateManager.url}${servicesConfig.stateManager.endpoints.mapping}`;

    const response = await axios.post(url, {
        waId,
        contactName
    }, {
        headers: {
            'X-Tenant-ID': tenantId
        }
    });

    return response.data;
}

/**
 * Track message in state manager
 * @param {Object} messageData - Message tracking data
 * @param {string} tenantId - Tenant ID for context
 * @returns {Promise<Object>} Tracking response
 */
export async function trackMessage(messageData: any, tenantId: string): Promise<any> {
    const url = `${servicesConfig.stateManager.url}${servicesConfig.stateManager.endpoints.message}`;

    const response = await axios.post(url, messageData, {
        headers: {
            'X-Tenant-ID': tenantId
        }
    });

    return response.data;
}

/**
 * Update message status in state manager
 * @param {string} messageId - Message ID (Meta or Genesys)
 * @param {string} status - New status
 * @param {string} tenantId - Tenant ID
 * @param {string} genesysMessageId - Optional Genesys message ID
 * @returns {Promise<Object>} Update response
 */
export async function updateMessageStatus(
    messageId: string,
    status: string,
    tenantId: string,
    genesysMessageId?: string
): Promise<any> {
    const url = `${servicesConfig.stateManager.url}${servicesConfig.stateManager.endpoints.message}/${messageId}`;

    const response = await axios.patch(url, {
        status,
        genesysMessageId
    }, {
        headers: {
            'X-Tenant-ID': tenantId
        }
    });

    return response.data;
}
