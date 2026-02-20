/**
 * WhatsApp Service
 * Sends a pre-built wabaPayload to the Meta Graph API.
 * The payload is already formatted by outbound-transformer — no transformation happens here.
 */
const axios = require('axios');
const config = require('../config/config');
const Logger = require('../utils/logger');
const tenantService = require('./tenant.service');

class WhatsAppService {
    async sendMessage(tenantId, phoneNumberId, wabaPayload) {
        const credentials = await tenantService.getWhatsAppCredentials(tenantId);
        const url = `${config.whatsapp.graphApiBaseUrl}/${phoneNumberId}/messages`;

        Logger.forTenant(tenantId).info('Sending message to WhatsApp', {
            phoneNumberId,
            to: wabaPayload.to,
            type: wabaPayload.type
        });

        const response = await axios.post(url, wabaPayload, {
            headers: {
                'Authorization': `Bearer ${credentials.accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        Logger.forTenant(tenantId).info('Message sent to WhatsApp', {
            to: wabaPayload.to,
            type: wabaPayload.type,
            messageId: response.data?.messages?.[0]?.id
        });

        return {
            ...response.data,
            wamid: response.data?.messages?.[0]?.id
        };
    }
}

module.exports = new WhatsAppService();
