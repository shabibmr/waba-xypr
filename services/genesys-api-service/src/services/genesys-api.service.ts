/**
 * Genesys API service
 * Core Genesys Cloud API integration logic
 */

/**
 * Genesys API service
 * Core Genesys Cloud API integration logic
 */

import axios from 'axios';
// @ts-ignore
import * as logger from '../utils/logger';
// @ts-ignore
import { getTenantGenesysCredentials } from './tenant.service';
// @ts-ignore
import { getAuthToken } from './auth.service';
import { InboundMessage } from '../types/inbound-message';
import { TenantGenesysCredentials } from './tenant.service';

/**
 * Send inbound message from queue to Genesys Open Messaging Inbound API (T05).
 * Uses the correct URL, passes genesysPayload directly, injects channel.to.id,
 * adds X-Correlation-ID header, applies timeout, and extracts communicationId.
 *
 * Called by the RabbitMQ consumer (inbound.consumer.ts).
 */
export async function sendInboundToGenesys(
    inboundMessage: InboundMessage,
    credentials: TenantGenesysCredentials,
    token: string
): Promise<{ conversationId: string; communicationId: string }> {
    const { metadata, genesysPayload } = inboundMessage;

    // Correct URL per FRD Section 5.3
    // Region format: usw2.pure.cloud → https://api.usw2.pure.cloud/api/v2/...
    const url = `https://api.${credentials.region}/api/v2/conversations/messages/inbound/open`;

    // Pass genesysPayload directly and inject channel.to.id = integrationId
    const payload = {
        ...genesysPayload,
        channel: {
            ...genesysPayload.channel,
            to: { id: credentials.integrationId }
        }
    };

    const timeoutMs = credentials.timeout?.readMs || 10000;

    const response = await axios.post(url, payload, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Correlation-ID': metadata.correlationId
        },
        timeout: timeoutMs
    });

    // FRD Section 5.4: extract from response root (not response.data.conversation)
    const conversationId: string = response.data.id;
    const communicationId: string = response.data.communicationId;

    logger.info(metadata.tenantId, 'Message delivered to Genesys:', conversationId);

    return { conversationId, communicationId };
}

/**
 * Send inbound message to Genesys (HTTP controller path — legacy interface)
 * @param {string} tenantId - Tenant ID
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} Response with conversationId and messageId
 */
export async function sendInboundMessage(tenantId: string, messageData: any): Promise<any> {
    const { conversationId, from, text, metadata, isNew = false } = messageData;

    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;

    // Validate integrationId availability
    if (!credentials.integrationId) {
        throw new Error(`Missing Genesys Open Messaging Integration ID for tenant ${tenantId}`);
    }

    // New unified endpoint for Open Messaging
    const url = `${baseUrl}/api/v2/conversations/messages/${credentials.integrationId}/inbound/open/message`;

    const payload = {
        channel: {
            platform: 'Open',
            type: 'Private',
            messageId: metadata.whatsappMessageId,
            time: new Date().toISOString(),
            from: {
                nickname: from.nickname,
                id: from.id,
                idType: 'Phone',
                firstname: from.nickname // Optional but good practice
            }
        },
        direction: 'Inbound',
        type: 'Text',
        text,
        metadata: {
            ...metadata,
            tenantId,
            // Pass conversationId if we have it, helps middleware associations
            conversationId: conversationId || undefined
        }
    };

    const response = await axios.post(url, payload, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    logger.info(tenantId, 'Message sent to Genesys:', response.data.id);

    return {
        success: true,
        conversationId: response.data.conversation?.id || conversationId,
        messageId: response.data.id,
        tenantId
    };
}

/**
 * Send outbound message from Genesys (Agentless)
 * @param {string} tenantId - Tenant ID
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} Response with messageId
 */
export async function sendOutboundMessage(tenantId: string, messageData: any): Promise<any> {
    const { to, text, metadata } = messageData;

    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;

    // Validate integrationId availability
    if (!credentials.integrationId) {
        throw new Error(`Missing Genesys Open Messaging Integration ID for tenant ${tenantId}`);
    }

    // Agentless API endpoint
    const url = `${baseUrl}/api/v2/conversations/messages/agentless`;

    const payload = {
        fromAddress: credentials.integrationId,
        toAddress: to, // Customer phone number or ID
        toAddressMessengerType: 'open', // For Open Messaging
        textBody: text,
        messagingTemplate: undefined, // Add support if needed
        useExistingConversation: true,
        metadata: {
            ...metadata,
            tenantId
        }
    };

    const response = await axios.post(url, payload, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    logger.info(tenantId, 'Outbound message sent from Genesys:', response.data.id);

    return {
        success: true,
        messageId: response.data.id,
        conversationId: response.data.conversationId,
        tenantId
    };
}

/**
 * Send delivery receipt to Genesys
 * @param {string} tenantId - Tenant ID
 * @param {Object} receiptData - Receipt data
 * @returns {Promise<Object>} Success response
 */
export async function sendReceipt(tenantId: string, receiptData: any): Promise<any> {
    const { conversationId, messageId, status, timestamp } = receiptData;

    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const url = `${baseUrl}/api/v2/conversations/messages/${conversationId}/receipts`;

    const payload = {
        messageId,
        status,
        timestamp: timestamp || new Date().toISOString()
    };

    await axios.post(url, payload, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    logger.info(tenantId, 'Receipt sent to Genesys:', messageId, status);

    return { success: true, tenantId };
}

/**
 * Get conversation details
 * @param {string} tenantId - Tenant ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} Conversation details
 */
export async function getConversation(tenantId: string, conversationId: string): Promise<any> {
    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const url = `${baseUrl}/api/v2/conversations/${conversationId}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    return {
        conversation: response.data,
        tenantId
    };
}

/**
 * Update conversation attributes
 * @param {string} tenantId - Tenant ID
 * @param {string} conversationId - Conversation ID
 * @param {Object} attributes - Attributes to update
 * @returns {Promise<Object>} Success response
 */
export async function updateConversationAttributes(tenantId: string, conversationId: string, attributes: any): Promise<any> {
    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const url = `${baseUrl}/api/v2/conversations/${conversationId}/attributes`;

    await axios.patch(url, { attributes }, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    logger.info(tenantId, 'Conversation attributes updated:', conversationId);

    return { success: true, tenantId };
}

/**
 * Disconnect conversation
 * @param {string} tenantId - Tenant ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} Success response
 */
export async function disconnectConversation(tenantId: string, conversationId: string): Promise<any> {
    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const url = `${baseUrl}/api/v2/conversations/${conversationId}/disconnect`;

    await axios.post(url, {}, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    logger.info(tenantId, 'Conversation disconnected:', conversationId);

    return { success: true, tenantId };
}

/**
 * Send typing indicator
 * @param {string} tenantId - Tenant ID
 * @param {string} conversationId - Conversation ID
 * @param {boolean} isTyping - Typing status
 * @returns {Promise<Object>} Success response
 */
export async function sendTypingIndicator(tenantId: string, conversationId: string, isTyping: boolean = true): Promise<any> {
    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const url = `${baseUrl}/api/v2/conversations/messages/${conversationId}/typing`;

    await axios.post(url, { typing: isTyping }, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return { success: true, tenantId };
}

/**
 * Get conversation messages
 * @param {string} tenantId - Tenant ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} Messages list
 */
export async function getConversationMessages(tenantId: string, conversationId: string): Promise<any> {
    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const url = `${baseUrl}/api/v2/conversations/messages/${conversationId}/messages`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    return {
        messages: response.data.entities,
        total: response.data.total,
        tenantId
    };
}

/**
 * Get organization users from Genesys
 * @param {string} tenantId - Tenant ID
 * @param {Object} options - Query options (pageSize, pageNumber)
 * @returns {Promise<Object>} Users list with pagination
 */
export async function getOrganizationUsers(tenantId: string, options: any = {}): Promise<any> {
    const { pageSize = 100, pageNumber = 1 } = options;
    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const url = `${baseUrl}/api/v2/users`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        },
        params: {
            pageSize,
            pageNumber,
            expand: 'authorization' // Get roles
        }
    });

    return {
        users: response.data.entities,
        pageCount: response.data.pageCount,
        total: response.data.total,
        tenantId
    };
}

/**
 * Get specific user details from Genesys
 * @param {string} tenantId - Tenant ID
 * @param {string} userId - Genesys user ID
 * @returns {Promise<Object>} User details
 */
export async function getGenesysUser(tenantId: string, userId: string): Promise<any> {
    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const url = `${baseUrl}/api/v2/users/${userId}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        },
        params: {
            expand: 'authorization'
        }
    });

    return {
        user: response.data,
        tenantId
    };
}

/**
 * Get organization details from Genesys
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Organization details
 */
export async function getOrganizationDetails(tenantId: string): Promise<any> {
    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const url = `${baseUrl}/api/v2/organizations/me`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    return {
        organization: response.data,
        tenantId
    };
}
