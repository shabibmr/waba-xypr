/**
 * Inbound Message Consumer
 * RabbitMQ consumer for processing inbound WhatsApp messages
 */

import * as amqp from 'amqplib';
import { Channel, Connection, ConsumeMessage } from 'amqplib';
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
        channel = await connection.createChannel();

        await channel!.assertQueue(
            rabbitConfig.queues.inbound.name,
            rabbitConfig.queues.inbound.options
        );

        channel!.prefetch(rabbitConfig.consumer.prefetch);

        console.log('Waiting for inbound messages...');

        channel!.consume(rabbitConfig.queues.inbound.name, async (msg: ConsumeMessage | null) => {
            if (msg) {
                try {
                    const payload = JSON.parse(msg.content.toString());
                    await processInboundMessage(payload);
                    channel!.ack(msg);
                } catch (error) {
                    console.error('Message processing error:', error);
                    // Requeue with delay
                    setTimeout(() => channel!.nack(msg, false, true), rabbitConfig.consumer.retryDelay);
                }
            }
        });
    } catch (error) {
        console.error('RabbitMQ consumer error:', error);
        setTimeout(startConsumer, rabbitConfig.connection.reconnectDelay);
    }
}
