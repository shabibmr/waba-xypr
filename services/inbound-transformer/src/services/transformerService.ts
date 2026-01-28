/**
 * Transformer Service
 * Core business logic for transforming and processing inbound messages
 */

// @ts-ignore
import { transformToGenesysFormat } from '../utils/messageFormatter';
// @ts-ignore
import * as stateService from './stateService';
// @ts-ignore
import * as genesysService from './genesysService';

/**
 * Process and transform inbound message from Meta to Genesys
 * @param {Object} metaMessage - Meta WhatsApp message
 * @returns {Promise<void>}
 */
export async function processInboundMessage(metaMessage: any): Promise<void> {
    console.log('Processing inbound message:', metaMessage.messageId);

    try {
        // Get or create conversation mapping
        const { conversationId, isNew } = await stateService.getConversationMapping(
            metaMessage.from,
            metaMessage.contactName
        );

        // Transform to Genesys format
        const genesysMessage = transformToGenesysFormat(metaMessage, conversationId, isNew);

        // Send to Genesys
        const response = await genesysService.sendMessage(genesysMessage, conversationId, isNew);

        console.log('Message sent to Genesys:', response.id);

        // Update state with message tracking
        await stateService.trackMessage({
            metaMessageId: metaMessage.messageId,
            genesysMessageId: response.id,
            conversationId,
            direction: 'inbound',
            timestamp: metaMessage.timestamp,
            content: metaMessage.content // Pass content (with mediaUrl) to state manager
        });

    } catch (error: any) {
        console.error('Inbound transformation error:', error.message);
        throw error;
    }
}
