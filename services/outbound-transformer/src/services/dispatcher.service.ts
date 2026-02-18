/**
 * Dispatcher Service
 * Publishes transformed messages to outbound-ready queue via topic exchange
 * Optional HTTP pipeline mode behind PIPELINE_MODE_ENABLED flag
 */

import { Channel } from 'amqplib';
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
    await publishToQueue(config.rabbitmq.outputQueue, msg);
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




// Removed HTTP dispatch logic
