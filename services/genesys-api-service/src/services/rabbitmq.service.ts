/**
 * RabbitMQ service
 * Connection management, queue setup, and message publishing (T01 + T04)
 */

// @ts-ignore
import * as amqplib from 'amqplib';
// @ts-ignore
import config from '../config/config';
// @ts-ignore
import * as logger from '../utils/logger';

// @ts-ignore
const QUEUES = require('../../../shared/constants/queues');

let connection: any = null;
let channel: any = null;
let reconnecting = false;
let reconnectDelay = 1000;

export async function connectRabbitMQ(): Promise<void> {
    try {
        connection = await amqplib.connect(config.rabbitmq.url, { heartbeat: 30 });

        connection.on('error', (err: Error) => {
            logger.warn(null, 'RabbitMQ connection error:', err.message);
            scheduleReconnect();
        });

        connection.on('close', () => {
            logger.warn(null, 'RabbitMQ connection closed — scheduling reconnect');
            scheduleReconnect();
        });

        channel = await connection.createChannel();
        await channel.prefetch(config.rabbitmq.prefetch);

        // Assert required queues (idempotent)
        await channel.assertQueue(QUEUES.GENESYS_OUTBOUND_READY, { durable: true });
        await channel.assertQueue(QUEUES.CORRELATION_EVENTS, { durable: true });
        await channel.assertQueue(QUEUES.GENESYS_API_DLQ, { durable: true });

        reconnectDelay = 1000; // reset on successful connect
        logger.info(null, 'RabbitMQ connected and queues asserted');
    } catch (err: any) {
        logger.error(null, 'RabbitMQ connection failed:', err.message);
        scheduleReconnect();
    }
}

function scheduleReconnect(): void {
    if (reconnecting) return;
    reconnecting = true;
    channel = null;
    connection = null;

    const delay = Math.min(reconnectDelay, 30000);
    reconnectDelay = delay * 2;

    logger.info(null, `RabbitMQ reconnecting in ${delay}ms...`);
    setTimeout(async () => {
        reconnecting = false;
        await connectRabbitMQ();
    }, delay);
}

export function getChannel(): any {
    return channel;
}

export function isConnected(): boolean {
    return channel !== null;
}

/**
 * Publish a message directly to a queue.
 */
export async function publishToQueue(queue: string, payload: object): Promise<void> {
    if (!channel) {
        throw new Error('RabbitMQ channel not available');
    }
    const content = Buffer.from(JSON.stringify(payload));
    channel.sendToQueue(queue, content, {
        persistent: true,
        contentType: 'application/json'
    });
}

export interface CorrelationEvent {
    tenantId: string;
    conversationId: string;
    communicationId: string;
    whatsapp_message_id: string;
    status: string;
    timestamp: string;
    correlationId: string;
}

/**
 * Publish a correlation event to the correlation-events queue (T04).
 * This event is consumed by state-manager to create waId ↔ conversationId mapping.
 */
export async function publishCorrelationEvent(event: CorrelationEvent): Promise<void> {
    if (!channel) {
        logger.error(null, 'Cannot publish correlation event: RabbitMQ channel not available');
        throw new Error('RabbitMQ channel not available');
    }

    const content = Buffer.from(JSON.stringify(event));
    channel.sendToQueue(QUEUES.CORRELATION_EVENTS, content, {
        persistent: true,
        contentType: 'application/json',
        correlationId: event.correlationId
    });

    logger.info(event.tenantId, 'Correlation event published, conversationId:', event.conversationId);
}
