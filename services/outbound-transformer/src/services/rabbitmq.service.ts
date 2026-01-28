import * as amqp from 'amqplib';
import { Channel, ConsumeMessage } from 'amqplib';
import config from '../config';
import { processOutboundMessage } from './message-processor.service';

let rabbitChannel: Channel | null = null;

/**
 * Get the current RabbitMQ channel
 * @returns {Channel|null} The RabbitMQ channel or null if not connected
 */
export function getChannel(): Channel | null {
    return rabbitChannel;
}

/**
 * Initialize RabbitMQ message consumer
 * @returns {Promise<void>}
 */
export async function startMessageConsumer(): Promise<void> {
    try {
        const connection: any = await amqp.connect(config.rabbitmq.url);
        rabbitChannel = await connection.createChannel();
        await rabbitChannel!.assertQueue(config.rabbitmq.queue, { durable: true });
        rabbitChannel!.prefetch(config.rabbitmq.prefetch);

        console.log('Waiting for outbound messages...');

        rabbitChannel!.consume(config.rabbitmq.queue, async (msg: ConsumeMessage | null) => {
            if (msg) {
                try {
                    const payload = JSON.parse(msg.content.toString());
                    await processOutboundMessage(payload);
                    rabbitChannel?.ack(msg);
                } catch (error) {
                    console.error('Message processing error:', error);
                    setTimeout(() => rabbitChannel?.nack(msg, false, true), 5000);
                }
            }
        });
    } catch (error) {
        console.error('RabbitMQ consumer error:', error);
        setTimeout(startMessageConsumer, 5000);
    }
}
