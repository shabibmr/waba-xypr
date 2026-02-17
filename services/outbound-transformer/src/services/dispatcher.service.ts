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
    `${config.rabbitmq.routingKey}.*`
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
    await dispatchViaHttp(msg);
  }
}

/**
 * Generic publish to any queue (for internal events/messages)
 */
export async function publishToQueue(queue: string, payload: any): Promise<void> {
  if (!dispatchChannel) {
    throw new Error('Dispatcher channel not initialized');
  }

  const content = Buffer.from(JSON.stringify(payload));
  await dispatchChannel.assertQueue(queue, { durable: true });
  dispatchChannel.sendToQueue(queue, content, { persistent: true });
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
