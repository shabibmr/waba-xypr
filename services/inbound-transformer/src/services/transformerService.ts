/**
 * Transformer Service
 * Core business logic for transforming and processing all Open Messaging types.
 *
 * Routes by message type:
 *   1. Inbound Message  (type: "message") — WhatsApp → Genesys
 *   2. Status Event      (type: "event")   — WhatsApp status → Genesys Receipt
 *   3. Agent Message     (via Widget)      — Widget → Agent Ready
 */

import { randomUUID } from 'crypto';
// @ts-ignore
import {
    transformToGenesysFormat,
    transformStatusToReceipt,
    transformAgentMessage
} from '../utils/messageFormatter';
// @ts-ignore
import {
    publishToGenesys,
    publishStatusReceipt,
    publishToAgentReady
} from './publisherService';
// @ts-ignore
import rabbitConfig from '../config/rabbitmq';

// ─── 1. Inbound Message (WhatsApp → Genesys) ───────────────────────

/**
 * Process a WhatsApp inbound message (Text/Media).
 * Transforms to Genesys Open Messaging format and publishes to genesys.outbound.ready.msg.
 */
export async function processInboundMessage(metaMessage: any): Promise<void> {
    const tenantId = metaMessage.tenantId;
    if (!tenantId) {
        throw new Error('Missing tenantId in inbound message');
    }

    // console.log('Processing inbound message:', metaMessage.id);

    const conversationId = metaMessage.conversation_id || null;
    const isNew = !!metaMessage.is_new_conversation;

    // Transform
    const genesysFields = transformToGenesysFormat(metaMessage, conversationId, isNew);

    const queueMessage = {
        metaMessage, // Pass original for context if needed
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

    // Publish
    await publishToGenesys(queueMessage);
    // console.log('Message transformed and enqueued for Genesys:', genesysPayload.id);
}

// ─── 2. Status Event (WhatsApp Status → Genesys Receipt) ───────────

/**
 * Process a WhatsApp status event (sent, delivered, read, etc.).
 * Transforms to Genesys Receipt and publishes to genesys.outbound.ready.msg.
 */
export async function processStatusEvent(event: any): Promise<void> {
    // Check if we should ignore 'sent' status updates
    if (rabbitConfig.ignoreSentStatus && event.status === 'sent') {
        // console.log('Ignoring "sent" status update per configuration');
        return;
    }

    const tenantId = event.tenantId;
    if (!tenantId) {
        throw new Error('Missing tenantId in status event');
    }

    // console.log('Processing status event:', event.id, event.status);

    const receipt = transformStatusToReceipt(event);
    if (!receipt) {
        console.warn(`Skipping unknown status: ${event.status}`);
        return;
    }

    // Wrap in envelope for Genesys API Service
    const queueMessage = {
        metadata: {
            tenantId,
            whatsapp_message_id: event.wamid,
            correlationId: randomUUID(),
            timestamp: new Date(parseInt(event.timestamp) * 1000).toISOString()
        },
        genesysPayload: receipt
    };

    await publishStatusReceipt(queueMessage);
    console.log('Status receipt enqueued for Genesys:', event.wamid, event.status);
}

// ─── 3. Agent Widget Message (Widget → Agent Ready) ────────────────

/**
 * Process an Agent Widget message.
 * Transforms to Agent Ready format and publishes to outbound.agent.ready.msg.
 */
export async function processAgentMessage(payload: any): Promise<void> {
    const tenantId = payload.tenantId;
    if (!tenantId) {
        throw new Error('Missing tenantId in agent message');
    }

    // console.log('Processing agent message:', payload.conversationId);

    // Transform
    const transformed = transformAgentMessage(payload);

    // Publish
    await publishToAgentReady(transformed);
    console.log('Agent message transformed and enqueued:', transformed.conversationId);
}
