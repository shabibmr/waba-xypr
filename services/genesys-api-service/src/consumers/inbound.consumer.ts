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
import { sendInboundToGenesys } from '../services/genesys-api.service';
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

    logger.info(null, `Starting consumer on queue: ${QUEUES.GENESYS_OUTBOUND_READY}`);

    await channel.consume(QUEUES.GENESYS_OUTBOUND_READY, async (msg: any) => {
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

            // Step 7: Publish correlation event
            await publishCorrelationEvent({
                tenantId,
                conversation_id: genesysResult.conversationId,
                communication_id: genesysResult.communicationId,
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
                logger.error(tenantId, `Genesys ${status} error — routing to DLQ:`, err.message);
                await routeToDLQ(channel, msg.content.toString(), `Genesys ${status}: ${err.message}`);
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
