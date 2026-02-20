/**
 * Agent Widget Message Consumer
 * Consumes from outbound.agent.widget.msg and sends to Genesys Conversations API
 */

import { Channel, ConsumeMessage } from 'amqplib';
// @ts-ignore
import * as logger from '../utils/logger';
import { sendConversationMessage } from '../services/genesys-api.service';
import { getChannel, publishToQueue } from '../services/rabbitmq.service';

// @ts-ignore
const QUEUES = require('../../../../shared/constants/queues');

export async function startWidgetConsumer(): Promise<void> {
    const channel: Channel = getChannel();
    if (!channel) {
        logger.error(null, 'Cannot start widget consumer: RabbitMQ channel not available');
        return;
    }

    logger.info(null, `Starting consumer on queue: ${QUEUES.OUTBOUND_AGENT_READY}`);

    // Ensure queue exists
    await channel.assertQueue(QUEUES.OUTBOUND_AGENT_READY, { durable: true });

    await channel.consume(QUEUES.OUTBOUND_AGENT_READY, async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        let tenantId = '';

        try {
            // Step 1: Parse JSON
            let payload: any;
            try {
                payload = JSON.parse(msg.content.toString());
            } catch {
                logger.error(null, 'Widget Consumer: Invalid JSON — routing to DLQ');
                await routeToDLQ(msg.content.toString(), 'Invalid JSON');
                channel.ack(msg);
                return;
            }

            tenantId = payload.tenantId;
            // Payload from inbound-transformer: { tenantId, conversationId, message, media, timestamp, ... }
            const { conversationId, message, media, integrationId } = payload;

            if (!tenantId || !conversationId) {
                logger.error(tenantId, 'Widget Consumer: Missing required fields — routing to DLQ');
                await routeToDLQ(msg.content.toString(), 'Missing required fields');
                channel.ack(msg);
                return;
            }

            // Map to sendConversationMessage expectations
            const messageData = {
                text: message,
                mediaUrl: media?.url,
                mediaType: media?.type,
                integrationId // Pass integrationId in the message data
            };

            // Step 2: Send to Genesys
            await sendConversationMessage(tenantId, conversationId, messageData);

            // Step 3: ACK
            logger.info(tenantId, 'Widget message processed successfully', { conversationId });
            channel.ack(msg);

        } catch (err: any) {
            const status = err.response?.status;

            if (status && status >= 400 && status < 500) {
                // Permanent failure → DLQ
                logger.error(tenantId, `Widget Consumer: Genesys ${status} error — routing to DLQ:`, err.message);
                await routeToDLQ(msg.content.toString(), `Genesys ${status}: ${err.message}`);
                channel.ack(msg);
            } else {
                // Retriable error → NACK
                logger.warn(tenantId, `Widget Consumer: Retriable error — NACKing: ${err.message}`);
                channel.nack(msg, false, true);
            }
        }
    });

    logger.info(null, 'Widget Consumer started');
}

async function routeToDLQ(
    originalContent: string,
    reason: string
): Promise<void> {
    try {
        await publishToQueue(QUEUES.GENESYS_API_DLQ, {
            originalMessage: originalContent,
            failureReason: reason,
            source: 'widget-consumer',
            timestamp: new Date().toISOString()
        });
    } catch (err: any) {
        logger.error(null, 'Widget Consumer: Failed to route to DLQ:', err.message);
    }
}
