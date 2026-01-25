/**
 * Inbound Message Consumer
 * RabbitMQ consumer for processing inbound WhatsApp messages
 */

const amqp = require('amqplib');
const rabbitConfig = require('../config/rabbitmq');
const { processInboundMessage } = require('../services/transformerService');

let channel = null;

/**
 * Get the current RabbitMQ channel
 * @returns {Object|null} RabbitMQ channel or null if not connected
 */
function getChannel() {
    return channel;
}

/**
 * Start the RabbitMQ consumer for inbound messages
 * @returns {Promise<void>}
 */
async function startConsumer() {
    try {
        const connection = await amqp.connect(rabbitConfig.url);
        channel = await connection.createChannel();

        await channel.assertQueue(
            rabbitConfig.queues.inbound.name,
            rabbitConfig.queues.inbound.options
        );

        channel.prefetch(rabbitConfig.consumer.prefetch);

        console.log('Waiting for inbound messages...');

        channel.consume(rabbitConfig.queues.inbound.name, async (msg) => {
            if (msg) {
                try {
                    const payload = JSON.parse(msg.content.toString());
                    await processInboundMessage(payload);
                    channel.ack(msg);
                } catch (error) {
                    console.error('Message processing error:', error);
                    // Requeue with delay
                    setTimeout(() => channel.nack(msg, false, true), rabbitConfig.consumer.retryDelay);
                }
            }
        });
    } catch (error) {
        console.error('RabbitMQ consumer error:', error);
        setTimeout(startConsumer, rabbitConfig.connection.reconnectDelay);
    }
}

module.exports = {
    startConsumer,
    getChannel
};
