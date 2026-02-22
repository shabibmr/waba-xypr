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
 * adds X-Correlation-ID header, and applies timeout.
 *
 * Called by the RabbitMQ consumer (inbound.consumer.ts).
 */
export async function sendInboundToGenesys(
    inboundMessage: InboundMessage,
    credentials: TenantGenesysCredentials,
    token: string
): Promise<{ conversationId: string }> {
    const { metadata, genesysPayload } = inboundMessage;

    // Correct URL per FRD Section 5.3 and Genesys Open Messaging API spec
    // Region format: usw2.pure.cloud → https://api.usw2.pure.cloud/api/v2/...
    const url = `https://api.${credentials.region}/api/v2/conversations/messages/${credentials.integrationId}/inbound/open/message`;

    // Pass genesysPayload directly and inject channel.to.id = integrationId
    const payload = {
        ...genesysPayload,
        channel: {
            ...genesysPayload.channel,
            to: { id: credentials.integrationId }
        }
    };

    const timeoutMs = credentials.timeout?.readMs || 10000;

    logger.info(metadata.tenantId, '[DEBUG] Sending to Genesys URL:', url);
    logger.info(metadata.tenantId, '[DEBUG] Genesys request payload:', JSON.stringify(payload, null, 2));

    // Pass prefetchConversationId=true so Genesys populates conversationId in the response.
    // Without this, the optional conversationId field is omitted.
    // See: Genesys SDK OpenMessageNormalizedMessage model.
    const response = await axios.post(url, payload, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Correlation-ID': metadata.correlationId
        },
        params: {
            prefetchConversationId: true
        },
        timeout: timeoutMs
    });

    logger.info(metadata.tenantId, '[DEBUG] Raw Genesys API response:', JSON.stringify(response.data, null, 2));

    // FRD Section 5.4 — Genesys Open Messaging response schema:
    //   id              - Genesys conversation ID (UUID)
    //   startTime       - Conversation start timestamp
    //   participants    - Participant information (optional)
    const conversationId: string = response.data.conversationId || response.data.id;

    logger.info(metadata.tenantId, 'Message delivered to Genesys:', conversationId);

    return { conversationId };
}

/**
 * Send delivery receipt to Genesys Open Messaging Inbound Receipt API
 * @param {string} tenantId - Tenant ID
 * @param {Object} receiptData - Receipt data { messageId, status, timestamp }
 * @returns {Promise<Object>} Success response
 */
export async function sendReceipt(tenantId: string, receiptData: any): Promise<any> {
    const { messageId, status, timestamp } = receiptData;

    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;

    // Open Messaging Inbound Receipt endpoint
    const url = `${baseUrl}/api/v2/conversations/messages/${credentials.integrationId}/inbound/open/receipt`;

    const payload = {
        id: `receipt-${messageId}-${Date.now()}`,
        channel: {
            platform: 'Open',
            type: 'Private',
            messageId: messageId,
            to: { id: credentials.integrationId }
        },
        status: status,
        timestamp: timestamp || new Date().toISOString()
    };

    await axios.post(url, payload, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    logger.info(tenantId, 'Receipt sent to Genesys Open Messaging:', messageId, status);

    return { success: true, tenantId };
}

/**
 * Send inbound event (e.g., Typing) to Genesys Open Messaging Inbound Event API
 * @param {string} tenantId - Tenant ID
 * @param {Object} eventData - Event data { eventType, from, timestamp }
 * @returns {Promise<Object>} Success response
 */
export async function sendInboundEvent(tenantId: string, eventData: any): Promise<any> {
    const { eventType, from, timestamp } = eventData;

    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;

    // Open Messaging Inbound Event endpoint
    const url = `${baseUrl}/api/v2/conversations/messages/${credentials.integrationId}/inbound/open/event`;

    const payload = {
        channel: {
            from: {
                nickname: from.nickname || from.firstName || 'Customer',
                id: from.id,
                idType: from.idType || 'Phone',
                ...(from.firstName && { firstName: from.firstName }),
                ...(from.lastName && { lastName: from.lastName })
            },
            time: timestamp || new Date().toISOString()
        },
        events: [
            {
                eventType: eventType
            }
        ]
    };

    await axios.post(url, payload, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    logger.info(tenantId, 'Event sent to Genesys Open Messaging:', eventType, from.id);

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
    const url = `${baseUrl}/api/v2/conversations/messages/${conversationId}`;

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
 * @deprecated Use sendInboundEvent instead for Open Messaging compliance
 * @param {string} tenantId - Tenant ID
 * @param {Object} from - User object { id, idType, nickname, firstName, lastName }
 * @param {boolean} isTyping - Typing status (true = "Typing", false = no event sent)
 * @returns {Promise<Object>} Success response
 */
export async function sendTypingIndicator(tenantId: string, from: any, isTyping: boolean = true): Promise<any> {
    if (!isTyping) {
        // Genesys handles typing timeout automatically; no "Off" event needed
        return { success: true, tenantId, skipped: true };
    }

    return sendInboundEvent(tenantId, {
        eventType: 'Typing',
        from: from,
        timestamp: new Date().toISOString()
    });
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


/**
 * Send message to an existing conversation (e.g. from Agent Widget)
 * Uses the Genesys conversations/{id}/communications/{id}/messages endpoint.
 * @param {string} tenantId - Tenant ID
 * @param {string} conversationId - Conversation ID
 * @param {Object} messageData - Message data { text, mediaUrl, mediaType, integrationId, communicationId }
 * @returns {Promise<Object>} Success response
 */
export async function sendConversationMessage(tenantId: string, conversationId: string, messageData: any): Promise<any> {
    const { text, mediaUrl, mediaType, integrationId, communicationId, genesysUserToken } = messageData;

    if (!communicationId) {
        throw new Error(`Missing communicationId for conversation ${conversationId}`);
    }

    const credentials = await getTenantGenesysCredentials(tenantId);
    // Prefer user-level token (OAuth Implicit Grant) over client credentials
    const token = genesysUserToken || await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const url = `${baseUrl}/api/v2/conversations/messages/${conversationId}/communications/${communicationId}/messages`;

    // Agent widget is using standard message payload logic
    const payload: any = { bodyType: 'standard' };

    // Inject fromAddress (integration ID) to prevent routing failure for multi-tenant mapping
    payload.fromAddress = integrationId || credentials.integrationId;

    if (mediaUrl && mediaType) {
        payload.body = text || '';
        payload.content = [{
            contentType: 'Attachment',
            attachment: {
                mediaType: mediaType,
                url: mediaUrl
            }
        }];
    } else {
        payload.body = text;
    }

    logger.info(tenantId, '[DEBUG] sendConversationMessage URL:', url);
    logger.info(tenantId, '[DEBUG] sendConversationMessage payload:', JSON.stringify(payload));

    const response = await axios.post(url, payload, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        timeout: 10000
    });

    logger.info(tenantId, 'Agent message sent to Genesys:', response.data.id);

    return {
        success: true,
        messageId: response.data.id,
        tenantId
    };
}
