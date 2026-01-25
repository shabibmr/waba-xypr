const amqp = require('amqplib');
const config = require('../config/config');
const logger = require('../utils/logger');

class RabbitMQService {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.isConnected = false;
    }

    async initialize() {
        try {
            this.connection = await amqp.connect(config.rabbitmq.url);
            this.channel = await this.connection.createChannel();

            // Assert queues
            await this.channel.assertQueue(config.rabbitmq.queues.outbound, { durable: true });
            await this.channel.assertQueue(config.rabbitmq.queues.events, { durable: true });

            this.isConnected = true;
            logger.info('RabbitMQ connected for Genesys webhooks');

            this.connection.on('close', () => {
                this.isConnected = false;
                logger.warn('RabbitMQ connection closed, reconnecting...');
                this.reconnect();
            });

            this.connection.on('error', (error) => {
                this.isConnected = false;
                logger.error('RabbitMQ connection error', error);
            });

        } catch (error) {
            logger.error('RabbitMQ connection failed', error);
            this.reconnect();
        }
    }

    reconnect() {
        setTimeout(() => {
            logger.info('Attempting to reconnect to RabbitMQ...');
            this.initialize();
        }, config.rabbitmq.reconnectInterval);
    }

    async publishOutboundMessage(payload) {
        if (!this.isConnected || !this.channel) {
            throw new Error('RabbitMQ not connected');
        }

        try {
            await this.channel.sendToQueue(
                config.rabbitmq.queues.outbound,
                Buffer.from(JSON.stringify(payload)),
                { persistent: true }
            );
            return true;
        } catch (error) {
            logger.error('Failed to publish outbound message', error);
            throw error;
        }
    }

    async publishEvent(payload) {
        if (!this.isConnected || !this.channel) {
            throw new Error('RabbitMQ not connected');
        }

        try {
            await this.channel.sendToQueue(
                config.rabbitmq.queues.events,
                Buffer.from(JSON.stringify(payload)),
                { persistent: true }
            );
            return true;
        } catch (error) {
            logger.error('Failed to publish event', error);
            throw error;
        }
    }
}

module.exports = new RabbitMQService();
