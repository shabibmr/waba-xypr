/**
 * Dispatcher Service
 * Publishes transformed messages to outbound-ready queue via topic exchange
 * Optional HTTP pipeline mode behind PIPELINE_MODE_ENABLED flag
 */

import { Channel } from 'amqplib';
import axios from 'axios';
import config from '../config';
import { OutputMessage } from '../types/messages';

let dispatchChannel: Channel | null = null;

/**
 * Initialize the dispatcher with a RabbitMQ channel
 * Asserts exchange, output queue, and binding on startup
 */
export async function initDispatcher(channel: Channel): Promise<void> {
  dispatchChannel = channel;

  await channel.assertExchange(config.rabbitmq.exchange, 'topic', { durable: true });
  await channel.assertQueue(config.rabbitmq.outputQueue, { durable: true });
  await channel.bindQueue(
    config.rabbitmq.outputQueue,
    config.rabbitmq.exchange,
    'outbound.ready.*'
  );

  console.log(`Dispatcher initialized: exchange=${config.rabbitmq.exchange}, queue=${config.rabbitmq.outputQueue}`);
}

/**
 * Dispatch one or more transformed messages
 * Handles both single messages and arrays (e.g. audio + text split)
 */
export async function dispatch(messages: OutputMessage | OutputMessage[]): Promise<void> {
  const msgArray = Array.isArray(messages) ? messages : [messages];

  for (const msg of msgArray) {
    if (config.pipelineMode) {
      await dispatchViaHttp(msg);
    } else {
      await dispatchViaQueue(msg);
    }
  }
}

/**
 * Publish transformed message to outbound-ready queue via topic exchange
 */
async function dispatchViaQueue(message: OutputMessage): Promise<void> {
  if (!dispatchChannel) {
    throw new Error('Dispatcher not initialized - RabbitMQ channel not available');
  }

  const routingKey = `outbound.ready.${message.metadata.tenantId}`;
  const content = Buffer.from(JSON.stringify(message));

  const published = dispatchChannel.publish(
    config.rabbitmq.exchange,
    routingKey,
    content,
    {
      persistent: true,                    // deliveryMode: 2
      contentType: 'application/json',
      headers: {
        'X-Tenant-ID': message.metadata.tenantId,
        'X-Correlation-ID': message.metadata.correlationId,
        'X-Message-Type': 'outbound',
        'X-Timestamp': Math.floor(Date.now() / 1000).toString(),
      },
    }
  );

  if (!published) {
    throw new Error('RabbitMQ publish failed - channel backpressure');
  }

  console.log(`Dispatched to queue: ${routingKey} [${message.metadata.internalId}]`);
}

/**
 * HTTP pipeline dispatch to whatsapp-api-service (optional mode)
 * Retries up to 3 times with exponential backoff
 */
async function dispatchViaHttp(message: OutputMessage): Promise<void> {
  const baseUrl = config.services.whatsappService;
  const maxAttempts = 3;
  const backoffMs = [2000, 4000, 8000];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await axios.post(`${baseUrl}/whatsapp/send`, message, {
        headers: {
          'X-Tenant-ID': message.metadata.tenantId,
          'X-Correlation-ID': message.metadata.correlationId,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      console.log(`Dispatched via HTTP: [${message.metadata.internalId}]`);
      return;
    } catch (error: any) {
      const status = error.response?.status;

      // Client errors: don't retry
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw new Error(`HTTP dispatch client error ${status}: ${error.message}`);
      }

      // Rate limited: throw to trigger NACK for requeue
      if (status === 429) {
        throw new Error(`HTTP dispatch rate limited (429)`);
      }

      // Server error or timeout: retry
      if (attempt < maxAttempts - 1) {
        console.warn(`HTTP dispatch attempt ${attempt + 1} failed, retrying in ${backoffMs[attempt]}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffMs[attempt]));
      } else {
        throw new Error(`HTTP dispatch failed after ${maxAttempts} attempts: ${error.message}`);
      }
    }
  }
}
