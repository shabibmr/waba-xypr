/**
 * Agent Widget Message Consumer
 * Consumes from outbound.agent.widget.msg and sends to Genesys Conversations API
 */

import axios from 'axios';
import { Channel, ConsumeMessage } from 'amqplib';
// @ts-ignore
import * as logger from '../utils/logger';
import { sendConversationMessage } from '../services/genesys-api.service';
import { getChannel, publishToQueue } from '../services/rabbitmq.service';
import { getTenantGenesysCredentials } from '../services/tenant.service';
import { getAuthToken } from '../services/auth.service';

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

            // Fallback 2: fetch communicationId from Genesys generic Conversations API
            //   GET /api/v2/conversations/{id} returns participants array
            //   The agent participant's id is the communicationId
            if (!communicationId) {
                logger.warn(tenantId, 'Widget Consumer: communicationId not in state-manager, fetching from Genesys Conversations API', { conversationId });
                try {
                    const credentials = await getTenantGenesysCredentials(tenantId);
                    const token = await getAuthToken(tenantId);
                    const url = `https://api.${credentials.region}/api/v2/conversations/${conversationId}`;

                    const resp = await axios.get(url, {
                        headers: { 'Authorization': `Bearer ${token}` },
                        timeout: 5000
                    });

                    const participants = resp.data?.participants || [];

                    logger.info(tenantId, '[DEBUG] Genesys conversation participants (raw):', JSON.stringify(participants, null, 2));

                    // Find the agent participant's communication ID
                    // The communicationId is simply the participant.id for agent participants
                    // Note: Generic conversations endpoint doesn't populate state field, so we just check purpose
                    for (const participant of participants) {
                        if (participant.purpose === 'agent') {
                            if (participant.id) {
                                communicationId = participant.id;
                                logger.info(tenantId, 'Widget Consumer: communicationId resolved from Genesys Conversations API', { conversationId, communicationId });
                                break;
                            }
                        }
                    }
                    if (!communicationId) {
                        logger.warn(tenantId, 'Widget Consumer: no agent participant found in Genesys response');
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
