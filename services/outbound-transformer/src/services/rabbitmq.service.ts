/**
 * RabbitMQ Consumer Service - Rewritten per FRD
 * Consumes from outbound-processed, validates, processes, handles retries + DLQ
 */

import * as amqp from 'amqplib';
import { Channel, ConsumeMessage } from 'amqplib';
import config from '../config';
import { InputMessage } from '../types/messages';
import { validateInputMessage } from './validator.service';
import { processOutboundMessage } from './message-processor.service';
import { initDispatcher } from './dispatcher.service';
import { classifyError, calculateBackoff, getRetryCount, buildDlqMessage } from './error.service';

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
 * Initialize RabbitMQ connection, assert queues, and start consuming
 */
export async function startMessageConsumer(): Promise<void> {
  try {
    rabbitConnection = await amqp.connect(config.rabbitmq.url);
    rabbitChannel = await (rabbitConnection as any).createChannel();

    const channel = rabbitChannel!;

    // Assert input queue
    await channel.assertQueue(config.rabbitmq.inputQueue, { durable: true });

    // Assert DLQ
    await channel.assertQueue(config.rabbitmq.dlqQueue, { durable: true });

    // Set prefetch
    channel.prefetch(config.rabbitmq.prefetch);

    // Initialize dispatcher (asserts exchange + output queue + binding)
    await initDispatcher(channel);

    console.log(`Consumer started: queue=${config.rabbitmq.inputQueue}, prefetch=${config.rabbitmq.prefetch}`);

    // Start consuming
    channel.consume(config.rabbitmq.inputQueue, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      // Parse JSON
      let payload: unknown;
      try {
        payload = JSON.parse(msg.content.toString());
      } catch (parseError) {
        // Invalid JSON: ACK to remove (don't retry - it'll never be valid)
        console.error('Invalid JSON in message, ACKing to remove:', (parseError as Error).message);
        rabbitChannel?.ack(msg);
        return;
      }

      // Validate input schema
      const validation = validateInputMessage(payload);
      if (!validation.valid) {
        // Validation failure: ACK (don't retry) and route to DLQ
        const validationError = new Error(`Validation failed: ${validation.errors.join('; ')}`);
        validationError.name = 'ValidationError';
        await routeToDlq(payload, validationError, 0);
        rabbitChannel?.ack(msg);
        console.error(`Invalid message ACKed and sent to DLQ: ${validation.errors.join('; ')}`);
        return;
      }

      // Process the valid message
      const inputMessage = payload as InputMessage;
      const retryCount = getRetryCount(msg);
      const firstAttemptTimestamp = (msg.properties.headers?.['x-first-attempt'] as number) || Math.floor(Date.now() / 1000);

      try {
        await processOutboundMessage(inputMessage);
        rabbitChannel?.ack(msg);
      } catch (error: unknown) {
        const err = error as Error;
        const classified = classifyError(err);

        console.error(`Processing error [attempt ${retryCount + 1}/${config.retry.maxRetries}]: ${err.message}`);

        if (!classified.retryable || retryCount >= config.retry.maxRetries - 1) {
          // Non-retryable or max retries exceeded: route to DLQ and ACK
          await routeToDlq(payload, err, retryCount + 1, firstAttemptTimestamp);
          rabbitChannel?.ack(msg);
        } else {
          // Retryable: NACK with requeue after backoff delay
          const delay = calculateBackoff(retryCount);
          console.warn(`Retrying in ${delay}ms (attempt ${retryCount + 1})`);

          // Update retry headers for next attempt
          if (msg.properties.headers) {
            msg.properties.headers['x-retry-count'] = retryCount + 1;
            msg.properties.headers['x-first-attempt'] = firstAttemptTimestamp;
          }

          setTimeout(() => {
            rabbitChannel?.nack(msg, false, true);
          }, delay);
        }
      }
    });

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
