/**
 * Genesys API service
 * Core Genesys Cloud API integration logic
 */

import axios from 'axios';
import * as logger from '../utils/logger';
import { getTenantGenesysCredentials, TenantGenesysCredentials } from './tenant.service';
import { getAuthToken } from './auth.service';
import { InboundMessage } from '../types/inbound-message';

const DEFAULT_TIMEOUT_MS = 10000;

interface ApiCallOptions {
    credentials?: TenantGenesysCredentials;
    token?: string;
    correlationId?: string;
}

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
export async function sendReceipt(tenantId: string, receiptData: any, options: ApiCallOptions = {}): Promise<any> {
    const { messageId, status, timestamp } = receiptData;

    const credentials = options.credentials || await getTenantGenesysCredentials(tenantId);
    const token = options.token || await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const timeoutMs = credentials.timeout?.readMs || DEFAULT_TIMEOUT_MS;

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
            'Content-Type': 'application/json',
            ...(options.correlationId && { 'X-Correlation-ID': options.correlationId })
        },
        timeout: timeoutMs
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
export async function sendInboundEvent(tenantId: string, eventData: any, options: ApiCallOptions = {}): Promise<any> {
    const { eventType, from, timestamp } = eventData;

    const credentials = options.credentials || await getTenantGenesysCredentials(tenantId);
    const token = options.token || await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const timeoutMs = credentials.timeout?.readMs || DEFAULT_TIMEOUT_MS;

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
            'Content-Type': 'application/json',
            ...(options.correlationId && { 'X-Correlation-ID': options.correlationId })
        },
        timeout: timeoutMs
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
export async function getConversation(tenantId: string, conversationId: string, options: ApiCallOptions = {}): Promise<any> {
    const credentials = options.credentials || await getTenantGenesysCredentials(tenantId);
    const token = options.token || await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const timeoutMs = credentials.timeout?.readMs || DEFAULT_TIMEOUT_MS;
    const url = `${baseUrl}/api/v2/conversations/${conversationId}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            ...(options.correlationId && { 'X-Correlation-ID': options.correlationId })
        },
        timeout: timeoutMs
    });
    logger.info(tenantId, 'Conversation details fetched FROM API :', JSON.stringify(response.data, null, 2));

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
export async function updateConversationAttributes(tenantId: string, conversationId: string, attributes: any, options: ApiCallOptions = {}): Promise<any> {
    const credentials = options.credentials || await getTenantGenesysCredentials(tenantId);
    const token = options.token || await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const timeoutMs = credentials.timeout?.readMs || DEFAULT_TIMEOUT_MS;
    const url = `${baseUrl}/api/v2/conversations/${conversationId}/attributes`;

    await axios.patch(url, { attributes }, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.correlationId && { 'X-Correlation-ID': options.correlationId })
        },
        timeout: timeoutMs
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
export async function disconnectConversation(tenantId: string, conversationId: string, options: ApiCallOptions = {}): Promise<any> {
    const credentials = options.credentials || await getTenantGenesysCredentials(tenantId);
    const token = options.token || await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const timeoutMs = credentials.timeout?.readMs || DEFAULT_TIMEOUT_MS;
    const url = `${baseUrl}/api/v2/conversations/${conversationId}/disconnect`;

    await axios.post(url, {}, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.correlationId && { 'X-Correlation-ID': options.correlationId })
        },
        timeout: timeoutMs
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
export async function sendTypingIndicator(tenantId: string, from: any, isTyping: boolean = true, options: ApiCallOptions = {}): Promise<any> {
    if (!isTyping) {
        // Genesys handles typing timeout automatically; no "Off" event needed
        return { success: true, tenantId, skipped: true };
    }

    return sendInboundEvent(tenantId, {
        eventType: 'Typing',
        from: from,
        timestamp: new Date().toISOString()
    }, options);
}

/**
 * Get conversation messages
 * @param {string} tenantId - Tenant ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} Messages list
 */
export async function getConversationMessages(tenantId: string, conversationId: string, options: ApiCallOptions = {}): Promise<any> {
    const credentials = options.credentials || await getTenantGenesysCredentials(tenantId);
    const token = options.token || await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const timeoutMs = credentials.timeout?.readMs || DEFAULT_TIMEOUT_MS;
    const url = `${baseUrl}/api/v2/conversations/messages/${conversationId}/messages`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            ...(options.correlationId && { 'X-Correlation-ID': options.correlationId })
        },
        timeout: timeoutMs
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
export async function getOrganizationUsers(tenantId: string, queryOptions: any = {}, options: ApiCallOptions = {}): Promise<any> {
    const { pageSize = 100, pageNumber = 1 } = queryOptions;
    const credentials = options.credentials || await getTenantGenesysCredentials(tenantId);
    const token = options.token || await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const timeoutMs = credentials.timeout?.readMs || DEFAULT_TIMEOUT_MS;
    const url = `${baseUrl}/api/v2/users`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            ...(options.correlationId && { 'X-Correlation-ID': options.correlationId })
        },
        params: {
            pageSize,
            pageNumber,
            expand: 'authorization' // Get roles
        },
        timeout: timeoutMs
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
export async function getGenesysUser(tenantId: string, userId: string, options: ApiCallOptions = {}): Promise<any> {
    const credentials = options.credentials || await getTenantGenesysCredentials(tenantId);
    const token = options.token || await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const timeoutMs = credentials.timeout?.readMs || DEFAULT_TIMEOUT_MS;
    const url = `${baseUrl}/api/v2/users/${userId}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            ...(options.correlationId && { 'X-Correlation-ID': options.correlationId })
        },
        params: {
            expand: 'authorization'
        },
        timeout: timeoutMs
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
export async function getOrganizationDetails(tenantId: string, options: ApiCallOptions = {}): Promise<any> {
    const credentials = options.credentials || await getTenantGenesysCredentials(tenantId);
    const token = options.token || await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const timeoutMs = credentials.timeout?.readMs || DEFAULT_TIMEOUT_MS;
    const url = `${baseUrl}/api/v2/organizations/me`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            ...(options.correlationId && { 'X-Correlation-ID': options.correlationId })
        },
        timeout: timeoutMs
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

    // Log token type and preview for debugging
    const tokenType = genesysUserToken ? 'USER-LEVEL (OAuth Implicit)' : 'CLIENT-CREDENTIALS';
    const tokenPreview = token.substring(0, 20) + '...';
    logger.info(tenantId, `[TOKEN DEBUG] Using ${tokenType} token: ${tokenPreview}`);
    logger.info(tenantId, `[TOKEN DEBUG] Full token length: ${token.length} characters`);
    logger.info(tenantId, `[TOKEN DEBUG] genesysUserToken provided: ${!!genesysUserToken}`);

    const baseUrl = `https://api.${credentials.region}`;
    const messageUrl = `${baseUrl}/api/v2/conversations/messages/${conversationId}/communications/${communicationId}/messages`;

    let uploadedMediaId: string | null = null;
    let reservedUploadUrl: string | null = null;

    try {
        // Step 1 & 2: Handle Media Upload Workflow if mediaUrl is present
        if (mediaUrl) {
            logger.info(tenantId, `[MEDIA UPLOAD] Starting media transfer for ${mediaUrl}`);

            // Download the file from mediaUrl into memory
            const fileResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer', timeout: 15000 });
            const fileBuffer = fileResponse.data;
            const contentLengthBytes = fileBuffer.byteLength;

            // Derive a sensible file name
            let fileName = 'attachment';
            const urlPath = new URL(mediaUrl).pathname;
            const pathParts = urlPath.split('/');
            const lastPart = pathParts[pathParts.length - 1];
            if (lastPart && lastPart.includes('.')) {
                fileName = lastPart;
            }

            // Step 1: Reserve the upload slot
            const reserveUrl = `${messageUrl}/media/uploads`;
            logger.info(tenantId, `[MEDIA UPLOAD] Reserving slot: ${reserveUrl}`);
            const reserveResponse = await axios.post(reserveUrl, {
                fileName: fileName,
                contentLengthBytes: contentLengthBytes
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            uploadedMediaId = reserveResponse.data.id;
            const uploadUrl = reserveResponse.data.uploadUrl;
            reservedUploadUrl = uploadUrl;
            const uploadHeaders = reserveResponse.data.uploadHeaders;

            logger.info(tenantId, `[MEDIA UPLOAD] Reserved mediaId: ${uploadedMediaId}. Uploading to S3...`);

            // Step 2: Upload the actual file buffer to the pre-signed S3 URL
            try {
                await axios.put(uploadUrl, fileBuffer, {
                    headers: uploadHeaders,
                    timeout: 30000,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });
                logger.info(tenantId, `[MEDIA UPLOAD] Successfully uploaded media to S3`);
            } catch (uploadError: any) {
                // S3 upload failed — attempt to clean up the reserved slot
                logger.error(tenantId, `[MEDIA UPLOAD] S3 upload failed for mediaId ${uploadedMediaId}: ${uploadError.message}`);
                try {
                    await axios.delete(`${messageUrl}/media/uploads/${uploadedMediaId}`, {
                        headers: { 'Authorization': `Bearer ${token}` },
                        timeout: 5000
                    });
                    logger.info(tenantId, `[MEDIA UPLOAD] Cleaned up orphaned reservation: ${uploadedMediaId}`);
                } catch (cleanupErr: any) {
                    logger.warn(tenantId, `[MEDIA UPLOAD] Failed to clean up reservation ${uploadedMediaId}: ${cleanupErr.message}`);
                }
                // Re-throw so the outer catch handles the failure
                throw uploadError;
            }
        }

        // Step 3: Send the final message payload
        const payload: any = {};

        if (text) {
            payload.textBody = text;
        }

        if (uploadedMediaId) {
            payload.mediaIds = [uploadedMediaId];
        }

        logger.info(tenantId, 'sendConversationMessage URL:', messageUrl);

        const response = await axios.post(messageUrl, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            validateStatus: () => true // Allow all status codes to be returned so we can handle them
        });

        // If the response is successful (2xx status), return it
        if (response.status >= 200 && response.status < 300) {
            logger.info(tenantId, 'Agent message sent to Genesys:', response.data.id);

            return {
                success: true,
                messageId: response.data.id,
                tenantId
            };
        } else {
            // Log issue and deliberately fall back
            logger.warn(tenantId, `sendConversationMessage returned status ${response.status}. Attempting fallback to sendOutBoundMessage...`);
            return await sendOutBoundMessage(tenantId, messageData);
        }
    } catch (error: any) {
        logger.error(tenantId, `sendConversationMessage failed: ${error?.message}. Attempting fallback to sendOutBoundMessage...`);
        return await sendOutBoundMessage(tenantId, messageData);
    }
}

/**
 * Send an outbound message
 * Uses the Genesys /api/v2/conversations/messages endpoint.
 * @param {string} tenantId - Tenant ID
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} Success response
 */
export async function sendOutBoundMessage(tenantId: string, messageData: any): Promise<any> {
    const credentials = await getTenantGenesysCredentials(tenantId);
    const token = await getAuthToken(tenantId);
    const baseUrl = `https://api.${credentials.region}`;
    const url = `${baseUrl}/api/v2/conversations/messages`;

    const payload = {
        ...messageData,
        useExistingConversation: true
    };

    logger.info(tenantId, '[DEBUG] sendOutBoundMessage URL:', url);
    logger.info(tenantId, '[DEBUG] sendOutBoundMessage payload:', JSON.stringify(payload));

    const response = await axios.post(url, payload, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        timeout: 10000
    });

    logger.info(tenantId, 'Outbound message sent to Genesys:', response.data?.id);

    return {
        success: true,
        messageId: response.data?.id,
        data: response.data,
        tenantId
    };
}
