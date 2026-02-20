/**
 * RabbitMQ Consumer Service - Rewritten per FRD
 * Consumes from:
 *  1. outbound.processed.msg (internal) -> processOutboundMessage
 *  2. om.outbound.msg (Genesys) -> processGenesysOutboundMessage
 *  3. om.outbound.evt (Genesys) -> processGenesysOutboundEvent/Receipt
 */

import * as amqp from 'amqplib';
import { Channel, ConsumeMessage } from 'amqplib';
import config from '../config';
import { InputMessage } from '../types/messages';
import { validateInputMessage } from './validator.service';
import { processOutboundMessage } from './message-processor.service';
import { initDispatcher } from './dispatcher.service';
import { classifyError, calculateBackoff, getRetryCount, buildDlqMessage } from './error.service';
import {
  processGenesysOutboundMessage,
  processGenesysInboundReceipt,
  processGenesysOutboundEvent
} from './transformer.service';

let rabbitChannel: Channel | null = null;
let rabbitConnection: any = null;

/**
 * Get the current RabbitMQ channel
 */
export function getChannel(): Channel | null {
  return rabbitChannel;
}

/**
 * Publish a message to the DLQ with full error context
 */
async function routeToDlq(
  originalMessage: unknown,
  error: Error,
  retryCount: number,
  firstAttemptTimestamp?: number
): Promise<void> {
  if (!rabbitChannel) {
    console.error('Cannot route to DLQ: RabbitMQ channel not available');
    return;
  }

  const dlqMessage = buildDlqMessage(originalMessage, error, retryCount, firstAttemptTimestamp);
  const content = Buffer.from(JSON.stringify(dlqMessage));

  rabbitChannel.sendToQueue(config.rabbitmq.dlqQueue, content, {
    persistent: true,
    contentType: 'application/json',
  });

  console.error(`Message routed to DLQ: ${dlqMessage.metadata.internal_id} [${error.message}]`);
}

/**
 * Shared consumer logic for any queue
 */
function consumeQueue(
  channel: Channel,
  queueName: string,
  handler: (payload: any) => Promise<void>,
  validate: boolean = false
): void {
  channel.consume(queueName, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    // Parse JSON
    let payload: unknown;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch (parseError) {
      console.error(`[${queueName}] Invalid JSON, ACKing:`, (parseError as Error).message);
      channel.ack(msg);
      return;
    }

    // Optional validation (only for internal outbound messages)
    if (validate) {
      const validation = validateInputMessage(payload);
      if (!validation.valid) {
        const validationError = new Error(`Validation failed: ${validation.errors.join('; ')}`);
        validationError.name = 'ValidationError';
        await routeToDlq(payload, validationError, 0);
        channel.ack(msg);
        console.error(`[${queueName}] Invalid message ACKed to DLQ: ${validation.errors.join('; ')}`);
        return;
      }
    }

    // Process
    const retryCount = getRetryCount(msg);
    const firstAttemptTimestamp = (msg.properties.headers?.['x-first-attempt'] as number) || Math.floor(Date.now() / 1000);

    try {
      await handler(payload);
      channel.ack(msg);
    } catch (error: unknown) {
      const err = error as Error;
      const classified = classifyError(err);

      console.error(`[${queueName}] Error [attempt ${retryCount + 1}/${config.retry.maxRetries}]: ${err.message}`);

      if (!classified.retryable || retryCount >= config.retry.maxRetries - 1) {
        await routeToDlq(payload, err, retryCount + 1, firstAttemptTimestamp);
        channel.ack(msg);
      } else {
        const delay = calculateBackoff(retryCount);
        // console.warn(`Retrying in ${delay}ms`);

        // Update headers
        if (msg.properties.headers) {
          msg.properties.headers['x-retry-count'] = retryCount + 1;
          msg.properties.headers['x-first-attempt'] = firstAttemptTimestamp;
        }

        setTimeout(() => {
          // Requeue explicitly? Or send to queue? 
          // Nack with requeue=true puts it back at head (or tail?). 
          // Better to publish with delay or use DLX, but simple buffer delay here:
          if (rabbitChannel) {
            rabbitChannel.nack(msg, false, true);
          }
        }, delay);
      }
    }
  });
}

/**
 * Route Genesys Event (Message vs Event vs Receipt)
 * The om.outbound.evt queue might contain both events and receipts?
 * Per FRD/Code: 
 *   om.outbound.msg -> Outbound Messsages
 *   om.outbound.evt -> Events (Typing, Disconnect) AND Receipts (Published, Failed)?
 * 
 * Looking at Genesys Webhook Service:
 *   It publishes to OM_OUTBOUND_MESSAGES and OM_OUTBOUND_EVENTS.
 *   Status events (Published/Failed) might be in OM_OUTBOUND_EVENTS or separate?
 *   Let's assume OM_OUTBOUND_EVENTS handles both for now, or route based on payload.type.
 */
async function routeGenesysEvent(payload: any): Promise<void> {
  // Check type
  const type = payload.type || payload.body?.type;

  if (type === 'Receipt') {
    // It's an inbound receipt (Published/Failed)
    await processGenesysInboundReceipt(payload);
  } else {
    // Typing, Disconnect, etc.
    await processGenesysOutboundEvent(payload);
  }
}


/**
 * Initialize RabbitMQ connection, assert queues, and start consuming
 */
export async function startMessageConsumer(): Promise<void> {
  try {
    rabbitConnection = await amqp.connect(config.rabbitmq.url);
    rabbitChannel = await (rabbitConnection as any).createChannel();

    const channel = rabbitChannel!;

    // Assert queues
    await channel.assertQueue(config.rabbitmq.inputQueue, { durable: true }); // outbound.processed
    await channel.assertQueue(config.rabbitmq.dlqQueue, { durable: true });

    // Set prefetch
    channel.prefetch(config.rabbitmq.prefetch);

    // Initialize dispatcher
    await initDispatcher(channel);

    console.log(`Consumers start inputs: ${config.rabbitmq.inputQueue}`);

    // 1. Internal Outbound Processed (InputMessage)
    consumeQueue(channel, config.rabbitmq.inputQueue, async (p) => processOutboundMessage(p as InputMessage), true);

    // Handle connection close
    rabbitConnection.on('close', () => {
      console.error('RabbitMQ connection closed, reconnecting...');
      rabbitChannel = null;
      setTimeout(startMessageConsumer, 5000);
    });

    rabbitConnection.on('error', (err: Error) => {
      console.error('RabbitMQ connection error:', err.message);
    });
  } catch (error) {
    console.error('RabbitMQ consumer startup error:', (error as Error).message);
    setTimeout(startMessageConsumer, 5000);
  }
}
