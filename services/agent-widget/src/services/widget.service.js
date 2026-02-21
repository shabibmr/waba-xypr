// services/agent-widget/src/services/widget.service.js
const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');

const portalApi = axios.create({
    baseURL: config.services.agentPortalUrl,
    timeout: 10000
});

class WidgetService {
    /**
     * Resolve tenantId from a conversation's integration ID.
     * Calls agent-portal-service → tenant-service lookup.
     */
    async resolveTenantByConversation(conversationId) {
        try {
            // Get conversation mapping from agent-portal-service
            const response = await portalApi.get(
                `/api/widget/conversations/${conversationId}`
            );
            const integrationId = response.data?.integrationId
                || response.data?.genesysIntegrationId
                || response.data?.communicationId;

            if (!integrationId) {
                console.warn('[WidgetService] No integrationId in conversation, using default');
                return { tenantId: 'default', integrationId: null };
            }

            // Lookup tenant by integration ID via agent-portal-service
            const tenantResponse = await portalApi.get(
                `/api/widget/resolve-tenant/${integrationId}`
            );

            const tenantId = tenantResponse.data?.id || tenantResponse.data?.tenant_id;
            return { tenantId: tenantId || 'default', integrationId };
        } catch (error) {
            console.error('[WidgetService] resolveTenant error:', error.response?.data || error.message);
            return { tenantId: 'default', integrationId: null };
        }
    }

    /**
     * Get conversation details via agent-portal-service
     */
    async getConversationDetails(conversationId, tenantId) {
        try {
            const response = await portalApi.get(
                `/api/widget/conversations/${conversationId}`,
                { headers: { 'X-Tenant-ID': tenantId } }
            );
            const data = response.data;

            return {
                conversationId,
                waId: data.waId || data.wa_id,
                contactName: data.contactName || data.contact_name,
                phoneNumberId: data.phoneNumberId || data.phone_number_id,
                displayPhoneNumber: data.displayPhoneNumber || data.display_phone_number,
                communicationId: data.communicationId || data.communication_id || null,
                integrationId: data.integrationId || data.integration_id || null,
                messageCount: data.messageCount || 0,
                tenantId
            };
        } catch (error) {
            this.handleError('getConversationDetails', error);
        }
    }

    /**
     * Get customer context by WhatsApp ID
     */
    async getCustomer(waId, tenantId) {
        try {
            const response = await portalApi.get(
                `/api/conversations/customer/${waId}`,
                { headers: { 'X-Tenant-ID': tenantId } }
            );
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error('Customer not found');
            }
            this.handleError('getCustomer', error);
        }
    }

    /**
     * Get message history for a conversation
     */
    async getMessageHistory(conversationId, options = {}, tenantId) {
        const { limit = 20, offset = 0 } = options;

        try {
            const response = await portalApi.get(
                `/api/widget/conversations/${conversationId}/messages`,
                {
                    params: { limit, offset },
                    headers: { 'X-Tenant-ID': tenantId }
                }
            );

            const messages = (response.data.messages || []).map(msg => ({
                id: msg.id,
                direction: msg.direction ? msg.direction.toLowerCase() : 'unknown',
                text: this.extractMessageText(msg),
                media: this.extractMediaInfo(msg),
                timestamp: msg.timestamp || msg.created_at,
                status: msg.status
            }));

            return {
                messages,
                total: response.data.total,
                conversationId,
                tenant_id: response.data.tenant_id || tenantId,
                integrationId: response.data.integrationId || null
            };
        } catch (error) {
            this.handleError('getMessageHistory', error);
        }
    }

    /**
     * Send a template message via agent-portal-service
     */
    async sendTemplate(data, tenantId) {
        const { waId, templateName, parameters = [] } = data;

        try {
            const response = await portalApi.post(
                `/api/messages/send-template`,
                { waId, templateName, language: 'en', parameters },
                { headers: { 'X-Tenant-ID': tenantId } }
            );

            return {
                success: true,
                messageId: response.data.messageId,
                template: templateName
            };
        } catch (error) {
            this.handleError('sendTemplate', error);
        }
    }

    /**
     * Send a quick reply (text) via agent-portal-service
     */
    async sendQuickReply(data, tenantId) {
        const { conversationId, waId, text, integrationId } = data;

        try {
            const response = await portalApi.post(
                `/api/widget/send-message`,
                { conversationId, waId, text, integrationId },
                { headers: { 'X-Tenant-ID': tenantId } }
            );

            return {
                success: true,
                messageId: response.data.messageId
            };
        } catch (error) {
            this.handleError('sendQuickReply', error);
        }
    }

    /**
     * Upload media file to portal (MinIO) via widget route
     */
    async uploadMedia(fileBuffer, originalname, mimetype, tenantId) {
        try {
            const form = new FormData();
            form.append('file', fileBuffer, { filename: originalname, contentType: mimetype });

            const response = await portalApi.post(
                `/api/widget/upload-media`,
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                        'X-Tenant-ID': tenantId
                    },
                    maxContentLength: 16 * 1024 * 1024, // 16 MB
                    maxBodyLength: 16 * 1024 * 1024
                }
            );

            return response.data; // { url, mimeType, fileSize }
        } catch (error) {
            this.handleError('uploadMedia', error);
        }
    }

    /**
     * Send a media message (with optional caption) via widget route
     */
    async sendMediaMessage(data, tenantId) {
        const { conversationId, waId, text, mediaUrl, mediaType, integrationId } = data;

        try {
            const response = await portalApi.post(
                `/api/widget/send-message`,
                { conversationId, waId, text, mediaUrl, mediaType, integrationId },
                { headers: { 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' } }
            );

            return {
                success: true,
                messageId: response.data.messageId
            };
        } catch (error) {
            this.handleError('sendMediaMessage', error);
        }
    }

    /**
     * Get available templates
     */
    async getTemplates(tenantId) {
        try {
            const response = await portalApi.get(
                `/api/whatsapp/templates`,
                { headers: { 'X-Tenant-ID': tenantId } }
            );
            return response.data.templates || response.data;
        } catch (error) {
            // Fallback to static templates if endpoint not available
            console.warn('[WidgetService] Templates endpoint unavailable, using static fallback');
            return [
                {
                    name: 'welcome_message', category: 'UTILITY', language: 'en',
                    components: [{ type: 'BODY', text: 'Welcome! How can we help you today?' }]
                },
                {
                    name: 'thank_you', category: 'UTILITY', language: 'en',
                    components: [{ type: 'BODY', text: 'Thank you for contacting us!' }]
                }
            ];
        }
    }

    /**
     * Get conversation analytics
     */
    async getAnalytics(conversationId, tenantId) {
        try {
            const response = await portalApi.get(
                `/api/widget/conversations/${conversationId}/messages`,
                { headers: { 'X-Tenant-ID': tenantId } }
            );

            const messages = response.data.messages || [];

            return {
                totalMessages: messages.length,
                inboundCount: messages.filter(m => m.direction && m.direction.toLowerCase() === 'inbound').length,
                outboundCount: messages.filter(m => m.direction && m.direction.toLowerCase() === 'outbound').length,
                firstMessageTime: messages[messages.length - 1]?.created_at,
                lastMessageTime: messages[0]?.created_at,
                avgResponseTime: this.calculateAvgResponseTime(messages),
                conversationId
            };
        } catch (error) {
            this.handleError('getAnalytics', error);
        }
    }

    // Helpers
    extractMessageText(message) {
        if (message.metadata) {
            const meta = typeof message.metadata === 'string'
                ? JSON.parse(message.metadata)
                : message.metadata;
            if (meta.text) return meta.text;
        }
        return message.text || '';
    }

    /**
     * Safely parse metadata from a message (handles string or object).
     */
    parseMeta(message) {
        if (!message.metadata) return null;
        try {
            return typeof message.metadata === 'string'
                ? JSON.parse(message.metadata)
                : message.metadata;
        } catch {
            return null;
        }
    }

    /**
     * Extract rich media/content info from message metadata.
     * Returns typed objects for: media files, location, contacts, sticker, interactive.
     */
    extractMediaInfo(message) {
        const meta = this.parseMeta(message);
        if (!meta) {
            // Fallback: check top-level mediaUrl (legacy)
            if (message.mediaUrl) {
                return { url: message.mediaUrl, type: 'document', mimeType: null };
            }
            return null;
        }

        const messageType = meta.messageType || null;

        // Location
        if (meta.type === 'location' || messageType === 'location') {
            return {
                type: 'location',
                latitude: meta.latitude,
                longitude: meta.longitude,
                name: meta.name || null,
                address: meta.address || null,
                mapsUrl: meta.mapsUrl || `https://maps.google.com/?q=${meta.latitude},${meta.longitude}`
            };
        }

        // Contacts
        if (meta.type === 'contacts' || messageType === 'contacts') {
            return {
                type: 'contacts',
                contacts: meta.contacts || []
            };
        }

        // Interactive (button/list reply)
        if (meta.type === 'interactive' || messageType === 'interactive' || messageType === 'button') {
            return {
                type: 'interactive',
                interactiveType: meta.interactiveType || null,
                buttonReply: meta.buttonReply || null,
                listReply: meta.listReply || null
            };
        }

        // Sticker
        if (messageType === 'sticker' && (meta.mediaUrl || message.mediaUrl)) {
            return {
                type: 'sticker',
                url: meta.mediaUrl || message.mediaUrl,
                mimeType: meta.mediaMimeType || null
            };
        }

        // Standard media (image/video/audio/document)
        if (meta.mediaUrl || message.mediaUrl) {
            const url = meta.mediaUrl || message.mediaUrl;
            const mimeType = meta.mediaMimeType || meta.mimeType || null;
            let type = meta.mediaType || 'document';
            // Derive type from MIME if available
            if (mimeType) {
                if (mimeType.startsWith('image/')) type = 'image';
                else if (mimeType.startsWith('video/')) type = 'video';
                else if (mimeType.startsWith('audio/')) type = 'audio';
                else type = 'document';
            }
            return { url, type, mimeType, filename: meta.mediaFilename || null };
        }

        return null;
    }

    calculateAvgResponseTime(messages) {
        if (messages.length < 2) return 0;
        const responseTimes = [];
        for (let i = 0; i < messages.length - 1; i++) {
            if (messages[i].direction && messages[i].direction.toLowerCase() === 'outbound' && messages[i + 1].direction && messages[i + 1].direction.toLowerCase() === 'inbound') {
                const time1 = new Date(messages[i].created_at).getTime();
                const time2 = new Date(messages[i + 1].created_at).getTime();
                responseTimes.push(Math.abs(time2 - time1));
            }
        }
        if (responseTimes.length === 0) return 0;
        return Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 1000);
    }

    handleError(method, error) {
        console.error(`[WidgetService] Error in ${method}:`, error.response?.data || error.message);
        throw error;
    }
}

module.exports = new WidgetService();
