/**
 * Inbound Message Consumer
 * Multi-queue RabbitMQ consumer for processing all Open Messaging types:
 *   1. inbound.enriched.msg    — WhatsApp inbound messages (existing)
 *   2. inbound.status.evt      — WhatsApp status events
 *   3. om.outbound.msg         — Genesys outbound messages
 *   4. om.outbound.evt         — Genesys outbound events (Typing/Disconnect/Receipt)
 */

import * as amqp from 'amqplib';
import { Channel, ConsumeMessage } from 'amqplib';
// @ts-ignore
import rabbitConfig from '../config/rabbitmq';
// @ts-ignore
import {
    processInboundMessage,
    processStatusEvent,
    processAgentMessage
} from '../services/transformerService';

let channel: Channel | null = null;

/**
 * Get the current RabbitMQ channel
 */
export function getChannel(): Channel | null {
    return channel;
}

/**
 * Create a consumer for a given queue with shared retry/DLQ logic.
 */
function consumeQueue(
    ch: Channel,
    queueName: string,
    handler: (payload: any) => Promise<void>
): void {
    ch.consume(queueName, async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        const currentChannel = channel;
        if (!currentChannel) return;

        const retryCount: number = (msg.properties.headers?.['x-retry-count'] as number) || 0;

        try {
            const payload = JSON.parse(msg.content.toString());
            await handler(payload);
            currentChannel.ack(msg);
        } catch (error) {
            console.error(
                `[${queueName}] Processing error (attempt ${retryCount + 1}/${rabbitConfig.consumer.maxRetries}):`,
                error
            );

            if (retryCount >= rabbitConfig.consumer.maxRetries) {
                console.error(`[${queueName}] Max retries exceeded, routing to dead-letter queue`);
                currentChannel.nack(msg, false, false);
            } else {
                const delay = rabbitConfig.consumer.retryDelay * Math.pow(2, retryCount);
                setTimeout(() => {
                    if (channel) {
                        channel.sendToQueue(queueName, msg.content, {
                            persistent: true,
                            headers: {
                                ...msg.properties.headers,
                                'x-retry-count': retryCount + 1
                            }
                        });
                    }
                }, delay);
                currentChannel.ack(msg);
            }
        }
    });
}

/**
 * Route enriched inbound messages by type field.
 * Messages with type "message" go to processInboundMessage.
 * Messages with type "event" go to processStatusEvent.
 */
async function routeEnrichedMessage(payload: any): Promise<void> {
    if (payload.type === 'event') {
        await processStatusEvent(payload);
    } else {
        // Default: treat as inbound message (type: "message" or unspecified)
        await processInboundMessage(payload);
    }
}

/**
 * Start all RabbitMQ consumers.
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

        // Assert all consume queues
        await channel!.assertQueue(rabbitConfig.queues.inbound.name, { durable: true });
        await channel!.assertQueue(rabbitConfig.queues.inboundStatusEvents.name, rabbitConfig.queues.inboundStatusEvents.options);
        await channel!.assertQueue(rabbitConfig.queues.agentWidgetMessages.name, rabbitConfig.queues.agentWidgetMessages.options);

        channel!.prefetch(rabbitConfig.consumer.prefetch);

        // 1. Enriched inbound messages (existing + status event routing)
        console.log(`Consuming: ${rabbitConfig.queues.inbound.name}`);
        consumeQueue(channel!, rabbitConfig.queues.inbound.name, routeEnrichedMessage);

        // 2. Inbound status events (dedicated queue)
        console.log(`Consuming: ${rabbitConfig.queues.inboundStatusEvents.name}`);
        consumeQueue(channel!, rabbitConfig.queues.inboundStatusEvents.name, processStatusEvent);

        // 3. Agent Widget messages
        console.log(`Consuming: ${rabbitConfig.queues.agentWidgetMessages.name}`);
        consumeQueue(channel!, rabbitConfig.queues.agentWidgetMessages.name, processAgentMessage);


        console.log('All inbound-transformer consumers started');
    } catch (error) {
        console.error('RabbitMQ consumer error:', error);
        setTimeout(startConsumer, rabbitConfig.connection.reconnectDelay);
    }
}
