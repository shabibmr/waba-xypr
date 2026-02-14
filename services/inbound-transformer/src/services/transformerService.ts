/**
 * Transformer Service
 * Core business logic for transforming and processing inbound messages
 */

import { randomUUID } from 'crypto';
// @ts-ignore
import { transformToGenesysFormat } from '../utils/messageFormatter';
// @ts-ignore
import { publishToGenesys } from './publisherService';

/**
 * Process and transform inbound message from Meta to Genesys.
 * Receives an EnrichedInboundMessage from state-manager (via inbound.enriched queue).
 * Mapping and message tracking are already handled by state-manager — no HTTP calls needed here.
 */
export async function processInboundMessage(metaMessage: any): Promise<void> {
    console.log('Processing inbound message:', metaMessage.wamid);

    const tenantId = metaMessage.tenantId;

    if (!tenantId) {
        throw new Error('Missing tenantId in message payload');
    }

    // conversation_id and is_new_conversation are resolved by state-manager before this stage
    const conversationId = metaMessage.conversation_id;
    const isNew = metaMessage.is_new_conversation;

    // Transform enriched payload to Genesys Open Messaging format
    const genesysFields = transformToGenesysFormat(metaMessage, conversationId, isNew);

    // Wrap in the schema expected by genesys-api-service consumer
    const queueMessage = {
        metadata: {
            tenantId,
            whatsapp_message_id: metaMessage.wamid,
            correlationId: randomUUID(),
            timestamp: new Date(parseInt(metaMessage.timestamp) * 1000).toISOString()
        },
        genesysPayload: {
            id: randomUUID(),
            ...genesysFields
        }
    };

    await publishToGenesys(queueMessage);

    console.log('Message enqueued for Genesys:', metaMessage.wamid);
}
