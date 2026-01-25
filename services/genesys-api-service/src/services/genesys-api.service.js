/**
 * Genesys API service
 * Core Genesys Cloud API integration logic
 */

const axios = require('axios');
const logger = require('../utils/logger');
const { getTenantGenesysCredentials } = require('./tenant.service');
const { getAuthToken } = require('./auth.service');

/**
 * Send inbound message to Genesys
 * @param {string} tenantId - Tenant ID
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} Response with conversationId and messageId
 */
async function sendInboundMessage(tenantId, messageData) {
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
 * Send delivery receipt to Genesys
 * @param {string} tenantId - Tenant ID
 * @param {Object} receiptData - Receipt data
 * @returns {Promise<Object>} Success response
 */
async function sendReceipt(tenantId, receiptData) {
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
async function getConversation(tenantId, conversationId) {
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
async function updateConversationAttributes(tenantId, conversationId, attributes) {
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
async function disconnectConversation(tenantId, conversationId) {
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
async function sendTypingIndicator(tenantId, conversationId, isTyping = true) {
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
async function getConversationMessages(tenantId, conversationId) {
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
async function getOrganizationUsers(tenantId, options = {}) {
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
async function getGenesysUser(tenantId, userId) {
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
async function getOrganizationDetails(tenantId) {
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

module.exports = {
    sendInboundMessage,
    sendReceipt,
    getConversation,
    updateConversationAttributes,
    disconnectConversation,
    sendTypingIndicator,
    getConversationMessages,
    getOrganizationUsers,
    getGenesysUser,
    getOrganizationDetails
};
