/**
 * Agent Widget Message Consumer
 * Consumes from outbound.agent.widget.msg and sends to Genesys Conversations API
 */

import axios from 'axios';
import { Channel, ConsumeMessage } from 'amqplib';
// @ts-ignore
import * as logger from '../utils/logger';
import { getConversation, sendConversationMessage } from '../services/genesys-api.service';
import { getChannel, publishToQueue } from '../services/rabbitmq.service';

const STATE_SERVICE_URL = process.env.STATE_SERVICE_URL || 'http://state-manager:3005';

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
            const { conversationId, text, message, mediaUrl, mediaType, media, integrationId, genesysUserToken } = payload;
            let { communicationId } = payload;

            if (!tenantId || !conversationId) {
                logger.error(tenantId, 'Widget Consumer: Missing required fields — routing to DLQ');
                await routeToDLQ(msg.content.toString(), 'Missing required fields');
                channel.ack(msg);
                return;
            }

            // Fallback: fetch communicationId from state-manager if not in payload
            if (!communicationId) {
                logger.warn(tenantId, 'Widget Consumer: communicationId missing from payload, fetching from state-manager', { conversationId });
                try {
                    const resp = await axios.get(
                        `${STATE_SERVICE_URL}/state/conversation/${conversationId}`,
                        { headers: { 'X-Tenant-ID': tenantId }, timeout: 5000 }
                    );
                    communicationId = resp.data?.communicationId;
                } catch (err: any) {
                    logger.error(tenantId, 'Widget Consumer: Failed to fetch communicationId from state-manager:', err.message);
                }
            }

            // Fallback 2: fetch communicationId from Genesys Conversations API
            //   GET /api/v2/conversations/{id} → find participant with messages → extract peerId
            if (!communicationId) {
                logger.warn(tenantId, 'Widget Consumer: communicationId not in state-manager, fetching from Genesys Conversations API', { conversationId });
                try {

                    const resp = await getConversation(tenantId, conversationId);
                    logger.info(tenantId, 'Widget Consumer: conversation details fetched from Genesys Conversations API', { conversationId, response: resp.data });

                    const participant = resp?.conversation?.participants?.find((p: any) => p.purpose === 'customer' && p.direction === 'inbound' && p.state === 'connected');
                    if (!participant || !participant.peer) {
                        logger.warn(tenantId, 'Widget Consumer: communicationId not found in Genesys conversation participants');
                    } else {
                        communicationId = participant.peer;
                        logger.info(tenantId, 'Widget Consumer: communicationId resolved from peer', { conversationId, communicationId });

                        // Update state-manager with fresh communicationId to prevent future stale lookups
                        try {
                            await axios.patch(
                                `${STATE_SERVICE_URL}/state/conversation/${conversationId}`,
                                { communicationId },
                                { headers: { 'X-Tenant-ID': tenantId }, timeout: 3000 }
                            );
                            logger.info(tenantId, 'Updated state-manager with fresh communicationId', { conversationId, communicationId });
                        } catch (updateErr: any) {
                            logger.warn(tenantId, 'Failed to update state-manager with fresh communicationId (non-fatal):', updateErr.message);
                        }
                    }
                } catch (err: any) {
                    logger.error(tenantId, 'Widget Consumer: Failed to fetch communicationId from Genesys Conversations API:', err.message);
                }
            }

            if (!communicationId) {
                logger.error(tenantId, 'Widget Consumer: communicationId unavailable from all sources — routing to DLQ', { conversationId });
                await routeToDLQ(msg.content.toString(), 'Missing communicationId (not in payload, not in state-manager, not in Genesys API)');
                channel.ack(msg);
                return;
            }

            // Send via agent communication endpoint
            const messageData = {
                text: text || message || '',
                mediaUrl: mediaUrl || media?.url,
                mediaType: mediaType || media?.type,
                integrationId,
                communicationId,
                genesysUserToken
            };
            await sendConversationMessage(tenantId, conversationId, messageData);

            // Step 3: ACK
            logger.info(tenantId, 'Widget message processed successfully', { conversationId });
            channel.ack(msg);

        } catch (err: any) {
            const status = err.response?.status;

            if (status && status >= 400 && status < 500) {
                // Permanent failure → DLQ
                const responseBody = err.response?.data ? JSON.stringify(err.response.data, null, 2) : 'no body';
                logger.error(tenantId, `Widget Consumer: Genesys ${status} error — routing to DLQ:`, err.message, '\nResponse:', responseBody);
                await routeToDLQ(msg.content.toString(), `Genesys ${status}: ${err.message} | Response: ${responseBody}`);
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
