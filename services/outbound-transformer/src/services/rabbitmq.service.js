const amqp = require('amqplib');
const config = require('../config');
const { processOutboundMessage } = require('./message-processor.service');

let rabbitChannel = null;

/**
 * Get the current RabbitMQ channel
 * @returns {Object|null} The RabbitMQ channel or null if not connected
 */
function getChannel() {
    return rabbitChannel;
}

/**
 * Initialize RabbitMQ message consumer
 * @returns {Promise<void>}
 */
async function startMessageConsumer() {
    try {
        const connection = await amqp.connect(config.rabbitmq.url);
        rabbitChannel = await connection.createChannel();
        await rabbitChannel.assertQueue(config.rabbitmq.queue, { durable: true });
        rabbitChannel.prefetch(config.rabbitmq.prefetch);

        console.log('Waiting for outbound messages...');

        rabbitChannel.consume(config.rabbitmq.queue, async (msg) => {
            if (msg) {
                try {
                    const payload = JSON.parse(msg.content.toString());
                    await processOutboundMessage(payload);
                    rabbitChannel.ack(msg);
                } catch (error) {
                    console.error('Message processing error:', error);
                    setTimeout(() => rabbitChannel.nack(msg, false, true), 5000);
                }
            }
        });
    } catch (error) {
        console.error('RabbitMQ consumer error:', error);
        setTimeout(startMessageConsumer, 5000);
    }
}

module.exports = {
    startMessageConsumer,
    getChannel
};
