/**
 * RabbitMQ Service
 * Manages RabbitMQ connection, queue initialization, and message publishing
 */

const amqp = require('amqplib');
const config = require('../config/config');
const Logger = require('../utils/logger');

class RabbitMQService {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.isConnected = false;
    }

    /**
     * Initialize RabbitMQ connection and channels
     */
    async initialize() {
        try {
            this.connection = await amqp.connect(config.rabbitmq.url);
            this.channel = await this.connection.createChannel();

            // Assert queues
            await this.channel.assertQueue(config.rabbitmq.queues.inboundMessages, {
                durable: true
            });
            await this.channel.assertQueue(config.rabbitmq.queues.statusUpdates, {
                durable: true
            });

            this.isConnected = true;
            Logger.info('RabbitMQ connected for WhatsApp webhooks');

            // Handle connection close
            this.connection.on('close', () => {
                this.isConnected = false;
                Logger.warn('RabbitMQ connection closed, reconnecting...');
                this.reconnect();
            });

            // Handle connection error
            this.connection.on('error', (error) => {
                this.isConnected = false;
                Logger.error('RabbitMQ connection error', error);
            });

        } catch (error) {
            Logger.error('RabbitMQ connection failed', error);
            this.reconnect();
        }
    }

    /**
     * Reconnect to RabbitMQ
     */
    reconnect() {
        setTimeout(() => {
            Logger.info('Attempting to reconnect to RabbitMQ...');
            this.initialize();
        }, config.rabbitmq.reconnectInterval);
    }

    /**
     * Publish message to inbound messages queue
     */
    async publishInboundMessage(payload) {
        if (!this.isConnected || !this.channel) {
            throw new Error('RabbitMQ not connected');
        }

        await this.channel.sendToQueue(
            config.rabbitmq.queues.inboundMessages,
            Buffer.from(JSON.stringify(payload)),
            { persistent: true }
        );
    }

    /**
     * Publish status update to status queue
     */
    async publishStatusUpdate(payload) {
        if (!this.isConnected || !this.channel) {
            throw new Error('RabbitMQ not connected');
        }

        await this.channel.sendToQueue(
            config.rabbitmq.queues.statusUpdates,
            Buffer.from(JSON.stringify(payload)),
            { persistent: true }
        );
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            url: config.rabbitmq.url
        };
    }
}

// Export singleton instance
module.exports = new RabbitMQService();
