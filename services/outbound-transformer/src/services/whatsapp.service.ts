import axios from 'axios';
// @ts-ignore
import config from '../config';

/**
 * Send message to WhatsApp via WhatsApp API Service
 * @param {string} tenantId - Tenant ID
 * @param {Object} message - Message in Meta WhatsApp format
 * @returns {Promise<Object>} Response from WhatsApp API Service
 */
export async function sendMessage(tenantId: string, message: any) {
    const baseUrl = config.services.whatsappService;
    let endpoint = '/whatsapp/send/text';
    let payload: any = { to: message.to };

    if (message.type === 'text') {
        endpoint = '/whatsapp/send/text';
        payload.text = message.text.body;
        payload.previewUrl = message.text.preview_url;
    } else if (message.type === 'template') {
        endpoint = '/whatsapp/send/template';
        payload.templateName = message.template.name;
        payload.language = message.template.language.code;
        payload.components = message.template.components;
    } else if (message.type === 'image') {
        endpoint = '/whatsapp/send/image';
        payload.imageUrl = message.image.link;
        payload.caption = message.image.caption;
    } else if (message.type === 'document') {
        endpoint = '/whatsapp/send/document';
        payload.documentUrl = message.document.link;
        payload.filename = message.document.filename;
        payload.caption = message.document.caption;
    } else if (message.type === 'location') {
        endpoint = '/whatsapp/send/location';
        payload.latitude = message.location.latitude;
        payload.longitude = message.location.longitude;
        payload.name = message.location.name;
        payload.address = message.location.address;
    } else if (message.type === 'interactive') {
        endpoint = '/whatsapp/send/buttons';
        payload.bodyText = message.interactive.body.text;
        payload.buttons = message.interactive.action.buttons.map((b: any) => ({
            id: b.reply.id,
            title: b.reply.title
        }));
    }

    try {
        const response = await axios.post(`${baseUrl}${endpoint}`, payload, {
            headers: {
                'X-Tenant-ID': tenantId,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error: any) {
        if (error.response) {
            throw new Error(`WhatsApp API Service Error: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
    }
}

/**
 * Send template message to WhatsApp (Maintained for backward compatibility if needed, but redirects to sendMessage)
 */
export async function sendTemplateMessage(phoneNumberId: string, waId: string, templateName: string, parameters: any, buttonParams: any, accessToken: string) {
    throw new Error('Depreciated: Use sendMessage(tenantId, message) instead');
}
