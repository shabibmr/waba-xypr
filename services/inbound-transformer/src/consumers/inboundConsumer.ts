/**
 * Inbound Message Consumer
 * RabbitMQ consumer for processing inbound WhatsApp messages
 */

import * as amqp from 'amqplib';
import { Channel, ConsumeMessage } from 'amqplib';
// @ts-ignore
import rabbitConfig from '../config/rabbitmq';
// @ts-ignore
import { processInboundMessage } from '../services/transformerService';

let channel: Channel | null = null;

/**
 * Get the current RabbitMQ channel
 * @returns {Channel|null} RabbitMQ channel or null if not connected
 */
export function getChannel(): Channel | null {
    return channel;
}

/**
 * Start the RabbitMQ consumer for inbound messages
 * @returns {Promise<void>}
 */
export async function startConsumer(): Promise<void> {
    try {
        const connection: any = await amqp.connect(rabbitConfig.url);

        connection.on('close', () => {
            console.error('RabbitMQ connection closed — reconnecting...');
            channel = null;
            setTimeout(startConsumer, rabbitConfig.connection.reconnectDelay);
        });

        connection.on('error', (err: Error) => {
            console.error('RabbitMQ connection error:', err.message);
        });

        channel = await connection.createChannel();

        // Assert DLX exchange and dead-letter queue
        await channel!.assertExchange(rabbitConfig.dlq.exchange, 'direct', { durable: true });
        await channel!.assertQueue(rabbitConfig.dlq.queue, rabbitConfig.dlq.options);
        await channel!.bindQueue(rabbitConfig.dlq.queue, rabbitConfig.dlq.exchange, '');

        // Assert main queue (no DLX args — must match state-manager's declaration)
        await channel!.assertQueue(
            rabbitConfig.queues.inbound.name,
            { durable: true }
        );

        channel!.prefetch(rabbitConfig.consumer.prefetch);

        console.log(`Waiting for inbound messages on queue: ${rabbitConfig.queues.inbound.name}`);

        channel!.consume(rabbitConfig.queues.inbound.name, async (msg: ConsumeMessage | null) => {
            if (!msg) return;

            const currentChannel = channel;
            if (!currentChannel) return;

            const retryCount: number = (msg.properties.headers?.['x-retry-count'] as number) || 0;

            try {
                const payload = JSON.parse(msg.content.toString());
                await processInboundMessage(payload);
                currentChannel.ack(msg);
            } catch (error) {
                console.error(`Message processing error (attempt ${retryCount + 1}/${rabbitConfig.consumer.maxRetries}):`, error);

                if (retryCount >= rabbitConfig.consumer.maxRetries) {
                    // Exhausted retries — nack to dead-letter queue
                    console.error('Max retries exceeded, routing to dead-letter queue');
                    currentChannel.nack(msg, false, false);
                } else {
                    // Ack original and republish with incremented retry count after delay
                    const delay = rabbitConfig.consumer.retryDelay * Math.pow(2, retryCount);
                    setTimeout(() => {
                        if (channel) {
                            channel.sendToQueue(
                                rabbitConfig.queues.inbound.name,
                                msg.content,
                                {
                                    persistent: true,
                                    headers: {
                                        ...msg.properties.headers,
                                        'x-retry-count': retryCount + 1
                                    }
                                }
                            );
                        }
                    }, delay);
                    currentChannel.ack(msg);
                }
            }
        });
    } catch (error) {
        console.error('RabbitMQ consumer error:', error);
        setTimeout(startConsumer, rabbitConfig.connection.reconnectDelay);
    }
}
