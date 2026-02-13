import amqp from 'amqplib';
// @ts-ignore
import config from '../config/config';
// @ts-ignore
import logger from '../utils/logger';

class RabbitMQService {
    connection: any = null;
    channel: any = null;
    isConnected: boolean = false;

    async initialize() {
        try {
            this.connection = await amqp.connect(config.rabbitmq.url);
            this.channel = await this.connection.createChannel();

            // 03-D: Assert correct queues — outboundQueue and statusQueue
            await this.channel.assertQueue(config.rabbitmq.queues.outbound, { durable: true });
            await this.channel.assertQueue(config.rabbitmq.queues.status, { durable: true });

            this.isConnected = true;
            logger.info('RabbitMQ connected for Genesys webhooks', {
                outboundQueue: config.rabbitmq.queues.outbound,
                statusQueue: config.rabbitmq.queues.status
            });

            this.connection.on('close', () => {
                this.isConnected = false;
                logger.warn('RabbitMQ connection closed, reconnecting...');
                this.reconnect();
            });

            this.connection.on('error', (error: any) => {
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

    /**
     * 03-F: Publish with one retry on failure (100ms delay between attempts).
     */
    private async publishWithRetry(queue: string, payload: any): Promise<boolean> {
        const message = Buffer.from(JSON.stringify(payload));

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                if (!this.isConnected || !this.channel) {
                    throw new Error('RabbitMQ not connected');
                }
                this.channel.sendToQueue(queue, message, { persistent: true });
                return true;
            } catch (error: any) {
                if (attempt === 0) {
                    logger.warn('RabbitMQ publish failed, retrying in 100ms', { queue, error: error.message });
                    await new Promise(r => setTimeout(r, 100));
                } else {
                    logger.error('RabbitMQ publish failed after retry', { queue, error: error.message });
                    throw error;
                }
            }
        }
        return false;
    }

    // 03-A: Publish outbound agent message to outboundQueue
    async publishOutboundMessage(payload: any): Promise<boolean> {
        return this.publishWithRetry(config.rabbitmq.queues.outbound, payload);
    }

    // 03-B/C: Publish status event to statusQueue
    async publishStatusEvent(payload: any): Promise<boolean> {
        return this.publishWithRetry(config.rabbitmq.queues.status, payload);
    }
}

export default new RabbitMQService();
