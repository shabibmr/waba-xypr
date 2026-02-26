/**
 * Status Ready Consumer
 * Consumes from inbound.status.ready queue (produced by inbound-transformer).
 * Validates and sends receipt events to Genesys Cloud Open Messaging API.
 */

import * as logger from '../utils/logger';
import { getChannel, publishToQueue } from '../services/rabbitmq.service';
import { sendReceipt } from '../services/genesys-api.service';
import { invalidateToken } from '../services/auth.service';

// @ts-ignore
const QUEUES = require('../../../../shared/constants/queues');

export async function startStatusReadyConsumer(): Promise<void> {
    const channel = getChannel();
    if (!channel) {
        logger.error(null, 'Cannot start status-ready consumer: RabbitMQ channel not available');
        return;
    }

    logger.info(null, `Starting status-ready consumer on queue: ${QUEUES.INBOUND_STATUS_READY}`);

    await channel.assertQueue(QUEUES.INBOUND_STATUS_READY, { durable: true });

    await channel.consume(QUEUES.INBOUND_STATUS_READY, async (msg: any) => {
        if (!msg) return;

        let tenantId = '';

        try {
            // Step 1: Parse JSON
            let payload: any;
            try {
                payload = JSON.parse(msg.content.toString());
            } catch {
                logger.error(null, 'Invalid JSON in status-ready message — routing to DLQ');
                await routeToDLQ(channel, msg.content.toString(), 'Invalid JSON');
                channel.ack(msg);
                return;
            }

            // Expected payload structure from transformerService.ts:
            // { metadata: { tenantId, ... }, genesysPayload: { ... } }

            if (!payload.metadata || !payload.genesysPayload) {
                logger.error(null, 'Invalid payload structure — routing to DLQ');
                await routeToDLQ(channel, msg.content.toString(), 'Missing metadata or genesysPayload');
                channel.ack(msg);
                return;
            }

            tenantId = payload.metadata.tenantId;
            const receipt = payload.genesysPayload;

            // Step 2: Extract details for sendReceipt
            // genesysPayload from transformerService.ts / messageFormatter.ts:
            // { id, channel: { messageId, ... }, status, ... }

            const messageId = receipt.channel?.messageId;
            const status = receipt.status;
            const timestamp = receipt.channel?.time;

            if (!messageId || !status) {
                logger.error(tenantId, 'Missing messageId or status in receipt payload — routing to DLQ');
                await routeToDLQ(channel, msg.content.toString(), 'Missing messageId or status');
                channel.ack(msg);
                return;
            }

            // Step 3: Send receipt to Genesys Cloud
            await sendReceipt(tenantId, {
                messageId,
                status,
                timestamp
            });

            logger.info(tenantId, `Receipt sent to Genesys: messageId=${messageId} status=${status}`);
            channel.ack(msg);

        } catch (err: any) {
            const httpStatus = err.response?.status;

            if (httpStatus === 401) {
                logger.warn(tenantId, 'Genesys 401 on status receipt — invalidating token, requeuing');
                if (tenantId) await invalidateToken(tenantId);
                channel.nack(msg, false, true);

            } else if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
                logger.error(tenantId, `Genesys ${httpStatus} on status receipt — routing to DLQ: ${err.message}`);
                await routeToDLQ(channel, msg.content.toString(), `Genesys ${httpStatus}: ${err.message}`);
                channel.ack(msg);

            } else {
                logger.warn(tenantId, `Retriable error on status receipt — requeuing: ${err.message}`);
                channel.nack(msg, false, true);
            }
        }
    }, { noAck: false });

    logger.info(null, 'Status-ready consumer started and listening');
}

async function routeToDLQ(channel: any, originalContent: string, reason: string): Promise<void> {
    try {
        await publishToQueue(QUEUES.GENESYS_API_DLQ, {
            originalMessage: originalContent,
            failureReason: reason,
            timestamp: new Date().toISOString()
        });
    } catch (err: any) {
        logger.error(null, 'Failed to route status-ready message to DLQ:', err.message);
    }
}
