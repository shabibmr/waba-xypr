const amqp = require('amqplib');
const config = require('../config');
const logger = require('../utils/logger');

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
            logger.info('Connecting to RabbitMQ...', { url: config.rabbitmq.url });
            const separator = config.rabbitmq.url.includes('?') ? '&' : '?';
            this.connection = await amqp.connect(
                `${config.rabbitmq.url}${separator}heartbeat=60&connection_timeout=5000`
            );
            this.channel = await this.connection.createChannel();

            // Assert queues
            await this.channel.assertQueue(config.rabbitmq.queues.inboundMessages, {
                durable: true
            });

            // Assert Agent Widget queue
            await this.channel.assertQueue(config.rabbitmq.queues.agentWidgetMessages, {
                durable: true
            });

            this.isConnected = true;
            logger.info('RabbitMQ connected for Agent Portal Service');

            // Handle connection close
            this.connection.on('close', () => {
                this.isConnected = false;
                logger.warn('RabbitMQ connection closed, reconnecting...');
                this.reconnect();
            });

            // Handle connection error
            this.connection.on('error', (error) => {
                this.isConnected = false;
                logger.error('RabbitMQ connection error', error);
            });

        } catch (error) {
            logger.error('RabbitMQ connection failed', error);
            this.reconnect();
        }
    }

    /**
     * Reconnect to RabbitMQ
     */
    reconnect() {
        setTimeout(() => {
            logger.info('Attempting to reconnect to RabbitMQ...');
            this.initialize();
        }, config.rabbitmq.reconnectInterval);
    }

    /**
     * Publish message to inbound messages queue
     */
    async consume(queueName, callback) {
        if (!this.isConnected || !this.channel) {
            try {
                await this.initialize();
            } catch (e) {
                logger.error('RabbitMQ consume failed: Not connected', e);
                return;
            }
        }

        try {
            await this.channel.assertQueue(queueName, { durable: true });

            this.channel.consume(queueName, async (msg) => {
                if (msg !== null) {
                    try {
                        const content = JSON.parse(msg.content.toString());
                        await callback(content);
                        this.channel.ack(msg);
                    } catch (err) {
                        logger.error('Error processing RabbitMQ message', err);
                        // Nack? Or Ack to avoid poison pill? For now, Ack to avoid loop
                        this.channel.ack(msg);
                    }
                }
            });

            logger.info(`Started consuming queue: ${queueName}`);
        } catch (error) {
            logger.error(`Failed to consume queue ${queueName}`, error);
        }
    }

    /**
     * Publish message to inbound messages queue
     */
    async publishInboundMessage(payload) {
        if (!this.isConnected || !this.channel) {
            // Try to initialize if not connected
            try {
                await this.initialize();
            } catch (e) {
                throw new Error('RabbitMQ not connected and failed to initialize');
            }
        }

        if (!this.channel) {
            throw new Error('RabbitMQ channel not available');
        }

        try {
            const result = this.channel.sendToQueue(
                config.rabbitmq.queues.inboundMessages,
                Buffer.from(JSON.stringify(payload)),
                { persistent: true }
            );

            if (!result) {
                logger.warn('RabbitMQ buffer full, message might be delayed');
            }

            return result;
        } catch (error) {
            logger.error('Failed to publish message to RabbitMQ', error);
            throw error;
        }
    }

    /**
     * Publish message to agent widget queue
     */
    async publishAgentWidgetMessage(payload) {
        if (!this.isConnected || !this.channel) {
            try {
                await this.initialize();
            } catch (e) {
                throw new Error('RabbitMQ not connected and failed to initialize');
            }
        }

        try {
            const result = this.channel.sendToQueue(
                config.rabbitmq.queues.agentWidgetMessages,
                Buffer.from(JSON.stringify(payload)),
                { persistent: true }
            );

            return result;
        } catch (error) {
            logger.error('Failed to publish agent widget message', error);
            throw error;
        }
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
