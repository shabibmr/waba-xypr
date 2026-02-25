/**
 * Inbound message consumer (T01)
 * Consumes from inbound-processed queue and drives the full processing pipeline:
 *   validate → deduplicate → load tenant → get token → send to Genesys → publish correlation event
 */

// @ts-ignore
import * as logger from '../utils/logger';
import { validateInboundPayload } from '../utils/validate-payload';
import { getTenantGenesysCredentials } from '../services/tenant.service';
import { getAuthToken, invalidateToken } from '../services/auth.service';
import { sendInboundToGenesys, getConversation } from '../services/genesys-api.service';
import {
    publishCorrelationEvent,
    publishToQueue,
    getChannel
} from '../services/rabbitmq.service';
import { redisGet, redisSet } from '../services/redis.service';

// @ts-ignore
const QUEUES = require('../../../../shared/constants/queues');

const DEDUPE_TTL_SECONDS = 86400; // 24 hours

export async function startConsumer(): Promise<void> {
    const channel = getChannel();
    if (!channel) {
        logger.error(null, 'Cannot start consumer: RabbitMQ channel not available');
        return;
    }

    logger.info(null, `Starting consumer on queue: ${QUEUES.GENESYS_INBOUND_READY_MSG}`);

    await channel.consume(QUEUES.GENESYS_INBOUND_READY_MSG, async (msg: any) => {
        if (!msg) return;

        let tenantId = '';

        try {
            // Step 1: Parse JSON
            let payload: unknown;
            try {
                payload = JSON.parse(msg.content.toString());
            } catch {
                logger.error(null, 'Invalid JSON in message — routing to DLQ');
                await routeToDLQ(channel, msg.content.toString(), 'Invalid JSON');
                channel.ack(msg);
                return;
            }

            // Step 2: Validate schema
            const validation = validateInboundPayload(payload);
            if (!validation.valid) {
                logger.error(null, `Validation failed: ${validation.reason} — routing to DLQ`);
                await routeToDLQ(channel, msg.content.toString(), validation.reason);
                channel.ack(msg);
                return;
            }

            const message = validation.data;
            tenantId = message.metadata.tenantId;

            // Step 3: Deduplication check (read-only — key is set after successful delivery)
            const dedupeKey = `genesys:dedupe:${tenantId}:${message.metadata.whatsapp_message_id}`;
            const alreadyDelivered = await redisGet(dedupeKey);
            if (alreadyDelivered) {
                logger.info(tenantId, `Duplicate message skipped: ${message.metadata.whatsapp_message_id}`);
                channel.ack(msg);
                return;
            }

            // Step 4: Load tenant credentials
            let credentials: any;
            try {
                credentials = await getTenantGenesysCredentials(tenantId);
            } catch (err: any) {
                logger.error(tenantId, 'Failed to load tenant config — routing to DLQ:', err.message);
                await routeToDLQ(channel, msg.content.toString(), `Tenant config error: ${err.message}`);
                channel.ack(msg);
                return;
            }

            if (!credentials.integrationId) {
                logger.error(tenantId, 'Missing integrationId in tenant config — routing to DLQ');
                await routeToDLQ(channel, msg.content.toString(), 'Missing integrationId in tenant config');
                channel.ack(msg);
                return;
            }

            // Step 5: Get auth token (cached in Redis)
            const token = await getAuthToken(tenantId);

            // Step 6: Send to Genesys
            const genesysResult = await sendInboundToGenesys(message, credentials, token);

            // Mark as successfully delivered (dedup — prevents reprocessing on retry)
            await redisSet(dedupeKey, '1', DEDUPE_TTL_SECONDS);

            // Step 6b: Fetch communicationId from Genesys Conversations API
            // The inbound POST response doesn't include communicationId, so we fetch it separately
            let communicationId = '';
            if (genesysResult.conversationId) {
                logger.info(tenantId, 'Fetching communicationId from Genesys Conversations API', { conversationId: genesysResult.conversationId });

                const MAX_RETRIES = 3;
                const RETRY_DELAY_MS = 500;

                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    try {
                        if (attempt > 1) {
                            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                        }

                        const convData = await getConversation(tenantId, genesysResult.conversationId);

                        // Find participant that has messages and extract peerId as communicationId
                        // const participant = convData?.conversation?.participants?.find((p: any) => p.messages && p.messages.length > 0 && p.purpose === 'customer' && p.direction === 'inbound' && p.state === 'connected');
                        const participant = convData?.conversation?.participants?.find((p: any) => p.purpose === 'customer' && p.direction === 'inbound' && p.state === 'connected');
                        logger.info(tenantId, 'Participant found:', participant);

                        if (!participant || !participant.peer) {
                            logger.warn(tenantId, `communicationId not found (attempt ${attempt}/${MAX_RETRIES}) — participant messages may not be ready yet`);
                            continue;
                        }

                        communicationId = participant.peer;
                        logger.info(tenantId, `communicationId found: ${communicationId} (peer, attempt ${attempt})`);
                        break;
                    } catch (err: any) {
                        logger.error(tenantId, `Failed to fetch communicationId (attempt ${attempt}/${MAX_RETRIES}):`, err.message);
                    }
                }

                if (!communicationId) {
                    logger.warn(tenantId, 'communicationId could not be resolved after all retries');
                }
            }

            // Step 7: Publish correlation event
            await publishCorrelationEvent({
                tenantId,
                conversation_id: genesysResult.conversationId || '',
                communication_id: communicationId,
                whatsapp_message_id: message.metadata.whatsapp_message_id,
                status: 'created',
                timestamp: new Date().toISOString(),
                correlationId: message.metadata.correlationId
            });

            // Step 8: ACK after successful delivery
            logger.info(tenantId, `Message processed: conversationId=${genesysResult.conversationId}`);
            channel.ack(msg);

        } catch (err: any) {
            const status = err.response?.status;

            if (status === 401) {
                // Token expired mid-request → invalidate + NACK to retry
                logger.warn(tenantId, 'Genesys 401 — invalidating token, requeuing for retry');
                if (tenantId) await invalidateToken(tenantId);
                channel.nack(msg, false, true);

            } else if (status && status >= 400 && status < 500) {
                // Other 4xx → permanent failure → DLQ
                const responseBody = err.response?.data ? JSON.stringify(err.response.data, null, 2) : 'no response body';
                logger.error(tenantId, `Genesys ${status} error — routing to DLQ:`, err.message, '\nResponse body:', responseBody);
                await routeToDLQ(channel, msg.content.toString(), `Genesys ${status}: ${err.message} | Response: ${responseBody}`);
                channel.ack(msg);

            } else {
                // 5xx / timeout / network error → retriable → NACK with requeue
                logger.warn(tenantId, `Retriable error — NACKing for requeue: ${err.message}`);
                channel.nack(msg, false, true);
            }
        }
    }, { noAck: false });

    logger.info(null, 'Consumer started and listening');
}

async function routeToDLQ(
    channel: any,
    originalContent: string,
    reason: string
): Promise<void> {
    try {
        await publishToQueue(QUEUES.GENESYS_API_DLQ, {
            originalMessage: originalContent,
            failureReason: reason,
            timestamp: new Date().toISOString()
        });
    } catch (err: any) {
        logger.error(null, 'Failed to route message to DLQ:', err.message);
    }
}
