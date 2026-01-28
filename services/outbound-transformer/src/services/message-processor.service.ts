// @ts-ignore
import { transformToMetaFormat } from './transformer.service';
// @ts-ignore
import { getConversationMapping, storeMessageTracking } from './state.service';
// @ts-ignore
import { sendMessage } from './whatsapp.service';
// @ts-ignore
import { getTenantWhatsAppCredentials } from './tenant.service';

/**
 * Process and transform outbound message
 * @param {Object} genesysMessage - Message from Genesys
 * @returns {Promise<void>}
 */
export async function processOutboundMessage(genesysMessage: any) {
    console.log('Processing outbound message:', genesysMessage.messageId);

    try {
        // Get WhatsApp ID and tenant from conversation mapping
        const mapping = await getConversationMapping(genesysMessage.conversationId);
        const { waId, phoneNumberId, tenantId } = mapping;

        if (!waId) {
            throw new Error('No WhatsApp ID mapping found');
        }

        if (!tenantId) {
            throw new Error('No tenant ID found in conversation mapping');
        }

        // Get tenant-specific WhatsApp credentials
        // const credentials = await getTenantWhatsAppCredentials(tenantId);

        console.log(`Using WhatsApp credentials for tenant: ${tenantId}`);

        // Transform to Meta WhatsApp format
        const metaMessage = transformToMetaFormat(genesysMessage, waId);

        // Send to Meta WhatsApp API via WhatsApp API Service
        // We pass tenantId so the service can resolve credentials internally
        const response = await sendMessage(
            tenantId,
            metaMessage
        );

        console.log('Message sent to WhatsApp:', response.messages[0].id);

        // Update state with message tracking
        await storeMessageTracking({
            genesysMessageId: genesysMessage.messageId,
            metaMessageId: response.messages[0].id,
            conversationId: genesysMessage.conversationId,
            direction: 'outbound',
            timestamp: Date.now(),
            content: {
                text: genesysMessage.text,
                mediaUrl: genesysMessage.mediaUrl,
                mediaType: genesysMessage.mediaType
            }
        });

    } catch (error: any) {
        console.error('Outbound transformation error:', error.message);
        if (error.response) {
            console.error('Meta API error:', error.response.data);
        }
        throw error;
    }
}
