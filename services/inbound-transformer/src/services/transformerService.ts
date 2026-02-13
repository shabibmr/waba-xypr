/**
 * Transformer Service
 * Core business logic for transforming and processing inbound messages
 */

// @ts-ignore
import { transformToGenesysFormat } from '../utils/messageFormatter';
// @ts-ignore
import * as stateService from './stateService';
// @ts-ignore
// @ts-ignore
import { publishToGenesys } from './publisherService';

/**
 * Process and transform inbound message from Meta to Genesys
 * @param {Object} metaMessage - Meta WhatsApp message
 * @returns {Promise<void>}
 */
export async function processInboundMessage(metaMessage: any): Promise<void> {
    console.log('Processing inbound message:', metaMessage.messageId);

    try {
        // Extract tenantId from message payload
        const tenantId = metaMessage.tenantId;

        if (!tenantId) {
            throw new Error('Missing tenantId in message payload');
        }

        console.log('Processing message for tenant:', tenantId);

        // Get or create conversation mapping
        const { conversationId, isNew } = await stateService.getConversationMapping(
            metaMessage.from,
            metaMessage.contactName,
            tenantId
        );

        // Transform to Genesys format
        const genesysMessage = transformToGenesysFormat(metaMessage, conversationId, isNew);

        // Track message as PENDING before sending to Genesys
        console.log('Tracking pending message in state manager...');
        await stateService.trackMessage({
            metaMessageId: metaMessage.messageId,
            genesysMessageId: null, // Initial null
            conversationId,
            direction: 'inbound',
            status: 'pending',
            timestamp: metaMessage.timestamp,
            content: metaMessage.content
        }, tenantId);

        try {
            // Send to Genesys Queue
            await publishToGenesys({
                ...genesysMessage,
                conversationId,
                isNew,
                tenantId
            });

            console.log('Message enqueued for Genesys:', metaMessage.messageId);

            // Update state to enqueued (no immediate success response with async queue)
            await stateService.updateMessageStatus(
                metaMessage.messageId,
                'enqueued',
                tenantId
            );
        } catch (sendError: any) {
            console.error('Failed to send to Genesys:', sendError.message);

            // Update state with failure
            await stateService.updateMessageStatus(
                metaMessage.messageId,
                'failed',
                tenantId
            );

            throw sendError;
        }

    } catch (error: any) {
        console.error('Inbound transformation error:', error.message);
        throw error;
    }
}
