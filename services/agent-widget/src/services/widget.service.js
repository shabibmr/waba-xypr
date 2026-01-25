// services/agent-widget/src/services/widget.service.js
const axios = require('axios');
const config = require('../config');

class WidgetService {
    /**
     * Get conversation details including mapping and stats
     */
    async getConversationDetails(conversationId, tenantId) {
        try {
            // Get conversation mapping
            const mappingResponse = await axios.get(
                `${config.services.stateManagerUrl}/state/conversation/${conversationId}`,
                {
                    headers: { 'X-Tenant-ID': tenantId }
                }
            );
            const mapping = mappingResponse.data;

            // Get stats (message count)
            const statsResponse = await axios.get(
                `${config.services.stateManagerUrl}/state/conversation/${conversationId}/messages`,
                {
                    params: { limit: 1 },
                    headers: { 'X-Tenant-ID': tenantId }
                }
            );

            return {
                conversationId,
                waId: mapping.waId,
                contactName: mapping.contactName,
                phoneNumberId: mapping.phoneNumberId,
                displayPhoneNumber: mapping.displayPhoneNumber,
                messageCount: statsResponse.data.total || 0,
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
            const response = await axios.get(
                `${config.services.stateManagerUrl}/state/mapping/${waId}`,
                {
                    headers: { 'X-Tenant-ID': tenantId }
                }
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
            const response = await axios.get(
                `${config.services.stateManagerUrl}/state/conversation/${conversationId}/messages`,
                {
                    params: { limit, offset },
                    headers: { 'X-Tenant-ID': tenantId }
                }
            );

            const messages = response.data.messages.map(msg => ({
                id: msg.id,
                direction: msg.direction,
                text: this.extractMessageText(msg),
                timestamp: msg.created_at,
                status: msg.status
            }));

            return {
                messages,
                total: response.data.total,
                conversationId
            };
        } catch (error) {
            this.handleError('getMessageHistory', error);
        }
    }

    /**
     * Send a template message
     */
    async sendTemplate(data, tenantId) {
        const { waId, templateName, parameters = [] } = data;

        try {
            const components = [];
            if (parameters.length > 0) {
                components.push({
                    type: 'body',
                    parameters: parameters.map(p => ({ type: 'text', text: p }))
                });
            }

            const response = await axios.post(
                `${config.services.whatsappApiUrl}/whatsapp/send/template`,
                {
                    to: waId,
                    templateName,
                    language: 'en',
                    components
                },
                {
                    headers: { 'X-Tenant-ID': tenantId }
                }
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
     * Send a quick reply (text message)
     */
    async sendQuickReply(data, tenantId) {
        const { waId, text } = data;

        try {
            const response = await axios.post(
                `${config.services.whatsappApiUrl}/whatsapp/send/text`,
                {
                    to: waId,
                    text
                },
                {
                    headers: { 'X-Tenant-ID': tenantId }
                }
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
     * Get available templates
     */
    async getTemplates(tenantId) {
        // In production, this would fetch from Meta API or database
        // For now, returning existing static templates
        return [
            {
                name: 'welcome_message',
                category: 'UTILITY',
                language: 'en',
                components: [{ type: 'BODY', text: 'Welcome! How can we help you today?' }]
            },
            {
                name: 'thank_you',
                category: 'UTILITY',
                language: 'en',
                components: [{ type: 'BODY', text: 'Thank you for contacting us! We appreciate your business.' }]
            },
            {
                name: 'order_confirmation',
                category: 'UTILITY',
                language: 'en',
                components: [{ type: 'BODY', text: 'Your order {{1}} has been confirmed and will be delivered by {{2}}.' }]
            }
        ];
    }

    /**
     * Get conversation analytics
     */
    async getAnalytics(conversationId, tenantId) {
        try {
            const response = await axios.get(
                `${config.services.stateManagerUrl}/state/conversation/${conversationId}/messages`,
                {
                    headers: { 'X-Tenant-ID': tenantId }
                }
            );

            const messages = response.data.messages;

            return {
                totalMessages: messages.length,
                inboundCount: messages.filter(m => m.direction === 'inbound').length,
                outboundCount: messages.filter(m => m.direction === 'outbound').length,
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
        return message.text || '[Media message]';
    }

    calculateAvgResponseTime(messages) {
        if (messages.length < 2) return 0;

        const responseTimes = [];
        for (let i = 0; i < messages.length - 1; i++) {
            if (messages[i].direction === 'outbound' && messages[i + 1].direction === 'inbound') {
                const time1 = new Date(messages[i].created_at).getTime();
                const time2 = new Date(messages[i + 1].created_at).getTime();
                responseTimes.push(Math.abs(time2 - time1));
            }
        }

        if (responseTimes.length === 0) return 0;

        const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        return Math.round(avg / 1000); // Return in seconds
    }

    handleError(method, error) {
        console.error(`[WidgetService] Error in ${method}:`, error.response?.data || error.message);
        throw error;
    }
}

module.exports = new WidgetService();
