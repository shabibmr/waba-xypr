import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import logger from '../utils/logger';
import { InboundMessage, OutboundMessage, StatusUpdate, DLQMessage, DLQReason } from '../types';

class RabbitMQService {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;

  private readonly queues = {
    inbound: process.env.INBOUND_QUEUE || 'inboundQueue',
    outbound: process.env.OUTBOUND_QUEUE || 'outboundQueue',
    status: process.env.STATUS_QUEUE || 'statusQueue',
    inboundProcessed: process.env.INBOUND_PROCESSED_QUEUE || 'inbound-processed',
    outboundProcessed: process.env.OUTBOUND_PROCESSED_QUEUE || 'outbound-processed',
    dlq: process.env.DLQ_NAME || 'state-manager-dlq'
  };

  async connect(): Promise<void> {
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

      logger.info('Connecting to RabbitMQ...', { url: url.replace(/:[^:]*@/, ':***@') });

      this.connection = await amqp.connect(url, {
        heartbeat: parseInt(process.env.RABBITMQ_HEARTBEAT || '60')
      });

      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error', { error: err.message });
        this.reconnect();
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting reconnect...');
        this.reconnect();
      });

      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(parseInt(process.env.RABBITMQ_PREFETCH_COUNT || '100'));

      await this.assertQueues();

      this.reconnectAttempts = 0;
      logger.info('RabbitMQ connected successfully', { queues: Object.keys(this.queues).length });

    } catch (error: any) {
      logger.error('Failed to connect to RabbitMQ', { error: error.message });
      this.reconnect();
    }
  }

  private async assertQueues(): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');

    for (const [name, queueName] of Object.entries(this.queues)) {
      await this.channel.assertQueue(queueName, { durable: true });
      logger.debug(`Queue asserted: ${queueName}`, { logicalName: name });
    }
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.critical('Max RabbitMQ reconnect attempts reached', {
        attempts: this.reconnectAttempts
      });
      process.exit(1);
    }

    this.reconnectAttempts++;
    logger.info(`Reconnecting to RabbitMQ (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  // ==================== Publishers ====================

  async publishToInboundProcessed(message: any): Promise<void> {
    await this.publish(this.queues.inboundProcessed, message);
    logger.debug('Published to inbound-processed queue', {
      wa_id: message.wa_id,
      wamid: message.wamid
    });
  }

  async publishToOutboundProcessed(message: any): Promise<void> {
    await this.publish(this.queues.outboundProcessed, message);
    logger.debug('Published to outbound-processed queue', {
      conversation_id: message.conversation_id,
      wa_id: message.wa_id
    });
  }

  async sendToDLQ<T>(message: T, reason: DLQReason, error?: string): Promise<void> {
    const dlqMessage: DLQMessage<T> = {
      original_payload: message,
      reason,
      error_message: error,
      retry_count: 0,
      timestamp: new Date().toISOString()
    };

    await this.publish(this.queues.dlq, dlqMessage);

    logger.error('Message sent to DLQ', {
      reason,
      error,
      payload: message
    });
  }

  private async publish(queue: string, message: any): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    this.channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
  }

  // ==================== Consumers ====================

  async consumeInbound(handler: (msg: InboundMessage) => Promise<void>): Promise<void> {
    await this.consume(this.queues.inbound, handler, 'inbound');
  }

  async consumeOutbound(handler: (msg: OutboundMessage) => Promise<void>): Promise<void> {
    await this.consume(this.queues.outbound, handler, 'outbound');
  }

  async consumeStatus(handler: (msg: StatusUpdate) => Promise<void>): Promise<void> {
    await this.consume(this.queues.status, handler, 'status');
  }

  private async consume<T>(
    queue: string,
    handler: (msg: T) => Promise<void>,
    consumerTag: string
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    logger.info(`Starting consumer for ${queue}`, { consumerTag });

    await this.channel.consume(queue, async (message: ConsumeMessage | null) => {
      if (!message) return;

      const startTime = Date.now();

      try {
        const payload: T = JSON.parse(message.content.toString());

        logger.debug(`Processing message from ${queue}`, {
          consumerTag,
          messageId: (payload as any).wamid || (payload as any).conversation_id
        });

        await handler(payload);

        this.channel!.ack(message);

        logger.info(`Message processed successfully from ${queue}`, {
          consumerTag,
          duration_ms: Date.now() - startTime
        });

      } catch (error: any) {
        logger.error(`Error processing message from ${queue}`, {
          consumerTag,
          error: error.message,
          stack: error.stack
        });

        // Reject and requeue (RabbitMQ will retry)
        this.channel!.nack(message, false, true);
      }
    });
  }

  // ==================== Health Check ====================

  async getQueueDepth(queue: string): Promise<number> {
    if (!this.channel) return -1;

    try {
      const info = await this.channel.checkQueue(queue);
      return info.messageCount;
    } catch {
      return -1;
    }
  }

  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }
}

export const rabbitmqService = new RabbitMQService();

export async function initializeRabbitMQ(): Promise<void> {
  await rabbitmqService.connect();
}
