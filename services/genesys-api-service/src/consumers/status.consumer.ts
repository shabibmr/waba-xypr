/**
 * Genesys Status Consumer
 * Consumes from genesys-status-processed queue (produced by state-manager).
 * Sends receipt/status events to Genesys Cloud Open Messaging API.
 *
 * Payload schema (EnrichedGenesysStatusEvent from state-manager):
 *   { tenantId, genesysId, originalMessageId, status, timestamp, conversation_id }
 *
 * Only 'delivered' and 'read' statuses are forwarded to Genesys receipts API.
 * Events with no conversation_id are ACKed and dropped (mapping not yet resolved).
 */

// @ts-ignore
import * as logger from '../utils/logger';
import { getChannel, publishToQueue } from '../services/rabbitmq.service';
import { sendReceipt } from '../services/genesys-api.service';
import { invalidateToken } from '../services/auth.service';

// @ts-ignore
const QUEUES = require('../../../shared/constants/queues');

// Genesys Receipt API expects PascalCase status values
const STATUS_TO_GENESYS: Record<string, string> = {
  delivered: 'Delivered',
  read: 'Read',
};

export async function startStatusConsumer(): Promise<void> {
  const channel = getChannel();
  if (!channel) {
    logger.error(null, 'Cannot start status consumer: RabbitMQ channel not available');
    return;
  }

  logger.info(null, `Starting status consumer on queue: ${QUEUES.GENESYS_STATUS_PROCESSED}`);

  await channel.consume(QUEUES.GENESYS_STATUS_PROCESSED, async (msg: any) => {
    if (!msg) return;

    let tenantId = '';

    try {
      // Step 1: Parse JSON
      let payload: any;
      try {
        payload = JSON.parse(msg.content.toString());
      } catch {
        logger.error(null, 'Invalid JSON in status event — routing to DLQ');
        await routeToDLQ(channel, msg.content.toString(), 'Invalid JSON');
        channel.ack(msg);
        return;
      }

      tenantId = payload.tenantId;
      const { conversation_id, originalMessageId, status, timestamp } = payload;

      // Step 2: Skip events without a resolvable conversation_id
      if (!conversation_id) {
        logger.warn(tenantId, `Status event dropped — conversation_id not resolved`, {
          genesysId: payload.genesysId,
          originalMessageId,
          status
        });
        channel.ack(msg);
        return;
      }

      // Step 3: Map status to Genesys value — skip unmapped statuses (typing, disconnect, etc.)
      const genesysStatus = STATUS_TO_GENESYS[status];
      if (!genesysStatus) {
        logger.info(tenantId, `Status '${status}' has no Genesys receipt mapping — skipping`);
        channel.ack(msg);
        return;
      }

      // Step 4: Send receipt to Genesys Cloud
      await sendReceipt(tenantId, {
        conversationId: conversation_id,
        messageId: originalMessageId,
        status: genesysStatus,
        timestamp
      });

      logger.info(tenantId, `Receipt sent to Genesys: conversationId=${conversation_id} status=${genesysStatus}`);
      channel.ack(msg);

    } catch (err: any) {
      const httpStatus = err.response?.status;

      if (httpStatus === 401) {
        logger.warn(tenantId, 'Genesys 401 on receipt — invalidating token, requeuing');
        if (tenantId) await invalidateToken(tenantId);
        channel.nack(msg, false, true);

      } else if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
        logger.error(tenantId, `Genesys ${httpStatus} on receipt — routing to DLQ: ${err.message}`);
        await routeToDLQ(channel, msg.content.toString(), `Genesys ${httpStatus}: ${err.message}`);
        channel.ack(msg);

      } else {
        logger.warn(tenantId, `Retriable error on receipt — requeuing: ${err.message}`);
        channel.nack(msg, false, true);
      }
    }
  }, { noAck: false });

  logger.info(null, 'Status consumer started and listening');
}

async function routeToDLQ(channel: any, originalContent: string, reason: string): Promise<void> {
  try {
    await publishToQueue(QUEUES.GENESYS_API_DLQ, {
      originalMessage: originalContent,
      failureReason: reason,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    logger.error(null, 'Failed to route status event to DLQ:', err.message);
  }
}
