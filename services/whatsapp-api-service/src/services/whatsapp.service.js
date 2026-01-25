/**
 * WhatsApp Service
 * Wrapper around Meta Graph API
 */
const axios = require('axios');
const config = require('../config/config');
const Logger = require('../utils/logger');
const tenantService = require('./tenant.service');

class WhatsAppService {
    /**
     * Helper to make authenticated requests to Graph API
     */
    async _makeRequest(tenantId, method, endpoint, data = null, additionalHeaders = {}) {
        const credentials = await tenantService.getWhatsAppCredentials(tenantId);

        // Construct URL - handle both /PHONE_ID/endpoint and direct /endpoint cases
        const baseUrl = config.whatsapp.graphApiBaseUrl;
        let url;

        if (endpoint.startsWith('/')) {
            // Direct endpoint (e.g. media retrieval)
            url = `${baseUrl}${endpoint}`;
        } else {
            // Relative to phone number (e.g. messages)
            url = `${baseUrl}/${credentials.phoneNumberId}/${endpoint}`;
        }

        try {
            const response = await axios({
                method,
                url,
                data,
                headers: {
                    'Authorization': `Bearer ${credentials.accessToken}`,
                    'Content-Type': 'application/json',
                    ...additionalHeaders
                }
            });
            return response.data;
        } catch (error) {
            Logger.forTenant(tenantId).error('WhatsApp API request failed', error, {
                method,
                endpoint
            });
            throw error;
        }
    }

    async sendText(tenantId, to, text, previewUrl = true) {
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: {
                preview_url: previewUrl,
                body: text
            }
        };
        return this._makeRequest(tenantId, 'POST', 'messages', payload);
    }

    async sendTemplate(tenantId, to, templateName, language, components = []) {
        const payload = {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
                name: templateName,
                language: { code: language },
                components
            }
        };
        return this._makeRequest(tenantId, 'POST', 'messages', payload);
    }

    async sendImage(tenantId, to, imageUrl, caption) {
        const payload = {
            messaging_product: 'whatsapp',
            to,
            type: 'image',
            image: {
                link: imageUrl,
                caption: caption || ''
            }
        };
        return this._makeRequest(tenantId, 'POST', 'messages', payload);
    }

    async sendDocument(tenantId, to, documentUrl, filename, caption) {
        const payload = {
            messaging_product: 'whatsapp',
            to,
            type: 'document',
            document: {
                link: documentUrl,
                filename: filename || 'document',
                caption: caption || ''
            }
        };
        return this._makeRequest(tenantId, 'POST', 'messages', payload);
    }

    async sendLocation(tenantId, to, latitude, longitude, name, address) {
        const payload = {
            messaging_product: 'whatsapp',
            to,
            type: 'location',
            location: {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                name: name || '',
                address: address || ''
            }
        };
        return this._makeRequest(tenantId, 'POST', 'messages', payload);
    }

    async sendButtons(tenantId, to, bodyText, buttons) {
        const payload = {
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text: bodyText },
                action: {
                    buttons: buttons.slice(0, 3).map((btn, idx) => ({
                        type: 'reply',
                        reply: {
                            id: btn.id || `btn_${idx}`,
                            title: btn.title.substring(0, 20)
                        }
                    }))
                }
            }
        };
        return this._makeRequest(tenantId, 'POST', 'messages', payload);
    }

    async markAsRead(tenantId, messageId) {
        const payload = {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId
        };
        return this._makeRequest(tenantId, 'POST', 'messages', payload);
    }

    async getMediaUrl(tenantId, mediaId) {
        // Direct endpoint: /MEDIA_ID
        return this._makeRequest(tenantId, 'GET', `/${mediaId}`);
    }

    async downloadMedia(tenantId, mediaUrl, accessToken) {
        // This is a special case as it returns a stream and might need direct axios call
        // or we can reuse `_makeRequest` if we handle responseType
        // But for stream it's better to be explicit or modify _makeRequest helper.
        // For simplicity, I'll implement it directly here to handle streams properly.

        try {
            // NOTE: If mediaUrl is full URL, we use it directly.
            const response = await axios.get(mediaUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                responseType: 'stream'
            });
            return response;
        } catch (error) {
            Logger.forTenant(tenantId).error('Media download failed', error);
            throw error;
        }
    }
}

module.exports = new WhatsAppService();
