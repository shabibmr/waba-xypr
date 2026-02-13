/**
 * Publisher Service
 * Publishes transformed messages to RabbitMQ for Genesys API Service
 */

import * as amqp from 'amqplib';
// @ts-ignore
import rabbitConfig from '../config/rabbitmq';
// @ts-ignore
import { QUEUES } from '../../../../shared/constants';

let channel: amqp.Channel | null = null;

export async function initializePublisher(): Promise<void> {
    try {
        const connection = await amqp.connect(rabbitConfig.url);
        channel = await connection.createChannel();

        await channel.assertQueue(QUEUES.GENESYS_OUTBOUND_READY, { durable: true });

        console.log('Publisher service initialized');
    } catch (error: any) {
        console.error('Failed to initialize publisher:', error.message);
        // Retry logic could be added here similar to consumers
    }
}

export async function publishToGenesys(payload: any): Promise<void> {
    if (!channel) {
        await initializePublisher();
    }

    if (!channel) {
        throw new Error('RabbitMQ channel not available for publishing');
    }

    const content = Buffer.from(JSON.stringify(payload));

    channel.sendToQueue(QUEUES.GENESYS_OUTBOUND_READY, content, {
        persistent: true,
        contentType: 'application/json'
    });

    console.log(`Published message to ${QUEUES.GENESYS_OUTBOUND_READY}`);
}
