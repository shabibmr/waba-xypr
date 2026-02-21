/**
 * Publisher Service
 * Publishes transformed messages to RabbitMQ for downstream services.
 * Supports multiple output queues for different Open Messaging types.
 */

import * as amqp from 'amqplib';
// @ts-ignore
import rabbitConfig from '../config/rabbitmq';
// @ts-ignore
import { QUEUES } from '../../../../shared/constants';

let channel: amqp.Channel | null = null;

/**
 * Initialize the publisher channel and assert all output queues.
 */
export async function initializePublisher(): Promise<void> {
    try {
        const connection = await amqp.connect(rabbitConfig.url);
        channel = await connection.createChannel();

        // Assert all output queues
        await channel.assertQueue(QUEUES.GENESYS_INBOUND_READY_MSG, { durable: true });
        await channel.assertQueue(QUEUES.INBOUND_STATUS_READY, { durable: true });
        await channel.assertQueue(QUEUES.OUTBOUND_AGENT_READY, { durable: true });

        console.log('Publisher service initialized with all output queues');
    } catch (error: any) {
        console.error('Error initializing publisher service:', error);
        throw error;
    }
}

/**
 * Ensure the channel is available before publishing.
 */
async function ensureChannel(): Promise<amqp.Channel> {
    if (!channel) {
        await initializePublisher();
    }
    if (!channel) {
        throw new Error('RabbitMQ channel not available for publishing');
    }
    return channel;
}

/**
 * Generic publish helper.
 */
async function publishToQueue(queue: string, payload: any): Promise<void> {
    const ch = await ensureChannel();
    const content = Buffer.from(JSON.stringify(payload));
    ch.sendToQueue(queue, content, {
        persistent: true,
        contentType: 'application/json'
    });
    console.log(`Published message to ${queue}`);
}

// ─── Publish Functions ───────────────────────────────────────────────────────

/**
 * Publish transformed inbound message to Genesys API Service.
 * Queue: genesys.inbound.ready.msg
 */
export async function publishToGenesys(payload: any): Promise<void> {
    await publishToQueue(QUEUES.GENESYS_INBOUND_READY_MSG, payload);
}

/**
 * Publish WhatsApp status → Genesys receipt to Genesys API Service.
 * Queue: genesys.outbound.ready.msg (same as inbound messages)
 */
export async function publishStatusReceipt(payload: any): Promise<void> {
    await publishToQueue(QUEUES.INBOUND_STATUS_READY, payload);
}

/**
 * Publish transformed agent message to Agent Ready queue.
 * Queue: outbound.agent.ready.msg
 */
export async function publishToAgentReady(payload: any): Promise<void> {
    await publishToQueue(QUEUES.OUTBOUND_AGENT_READY, payload);
}


