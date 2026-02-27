import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
// @ts-ignore
const { QUEUES } = require('../../../../shared/constants');
import logger from '../utils/logger';
import { InboundMessage, OutboundMessage, StatusUpdate, ConversationCorrelation, GenesysStatusEvent, EnrichedGenesysStatusEvent, DLQMessage, DLQReason, OutboundAckMessage } from '../types';

class RabbitMQService {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;

  private readonly queues = {
    inbound: process.env.INBOUND_QUEUE || QUEUES.INBOUND_WHATSAPP_MESSAGES,
    outbound: process.env.OUTBOUND_QUEUE || QUEUES.OUTBOUND_GENESYS_MESSAGES,
    status: process.env.STATUS_QUEUE || QUEUES.WHATSAPP_STATUS_UPDATES,
    inboundStatus: process.env.INBOUND_STATUS_QUEUE || QUEUES.INBOUND_STATUS_EVENTS,
    genesysStatus: process.env.GENESYS_STATUS_QUEUE || QUEUES.GENESYS_STATUS_UPDATES,
    genesysStatusProcessed: process.env.GENESYS_STATUS_PROCESSED_QUEUE || QUEUES.GENESYS_STATUS_PROCESSED,
    correlation: process.env.CORRELATION_QUEUE || QUEUES.CORRELATION_EVENTS,
    inboundProcessed: process.env.INBOUND_ENRICHED_QUEUE || QUEUES.INBOUND_ENRICHED,
    outboundProcessed: process.env.OUTBOUND_PROCESSED_QUEUE || QUEUES.OUTBOUND_PROCESSED,
    agentPortalEvents: process.env.AGENT_PORTAL_EVENTS_QUEUE || QUEUES.AGENT_PORTAL_EVENTS,
    outboundAck: process.env.OUTBOUND_ACK_QUEUE || QUEUES.OUTBOUND_ACK_EVENTS,
    dlq: process.env.DLQ_NAME || QUEUES.STATE_MANAGER_DLQ
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
      throw error;
    }
  }

  private async assertQueues(): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');

    for (const [name, queueName] of Object.entries(this.queues)) {
      if (name === 'dlq') continue; // Optional: skip dlq here if asserted differently (not the case here)
      await this.channel!.assertQueue(queueName, { durable: true });
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

    setTimeout(async () => {
      try {
        await this.connect();
        logger.info('RabbitMQ reconnected successfully');
      } catch {
        this.reconnect();
      }
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

  async publishToInboundStatus(message: any): Promise<void> {
    await this.publish(this.queues.inboundStatus, message);
    logger.debug('Published to inbound-status queue', {
      wamid: message.whatsappMessageId,
      status: message.status
    });
  }

  async publishToOutboundProcessed(message: any): Promise<void> {
    await this.publish(this.queues.outboundProcessed, message);
    logger.debug('Published to outbound-processed queue', {
      conversation_id: message.conversation_id,
      wa_id: message.wa_id
    });
  }

  async publishToGenesysStatusProcessed(message: EnrichedGenesysStatusEvent): Promise<void> {
    await this.publish(this.queues.genesysStatusProcessed, message);
    logger.debug('Published to genesys-status-processed queue', {
      tenantId: message.tenantId,
      genesysId: message.genesysId,
      status: message.status
    });
  }

  async publishAgentPortalEvent(type: string, tenantId: string, data: any): Promise<void> {
    const event = {
      type,
      tenantId,
      data,
      timestamp: new Date().toISOString()
    };
    await this.publish(this.queues.agentPortalEvents, event);
    logger.debug('Published to agent-portal-events queue', {
      type,
      tenantId
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

  async consumeCorrelation(handler: (msg: ConversationCorrelation) => Promise<void>): Promise<void> {
    await this.consume(this.queues.correlation, handler, 'correlation');
  }

  async consumeGenesysStatus(handler: (msg: GenesysStatusEvent) => Promise<void>): Promise<void> {
    await this.consume(this.queues.genesysStatus, handler, 'genesys-status');
  }

  async consumeOutboundAck(handler: (msg: OutboundAckMessage) => Promise<void>): Promise<void> {
    await this.consume(this.queues.outboundAck, handler, 'outbound-ack');
  }

  private async consume<T>(
    queue: string,
    handler: (msg: T) => Promise<void>,
    consumerTag: string
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    const maxRetries = parseInt(process.env.RABBITMQ_MAX_RETRIES || '3');

    logger.info(`Starting consumer for ${queue}`, { consumerTag });

    await this.channel.consume(queue, async (message: ConsumeMessage | null) => {
      if (!message) return;

      const startTime = Date.now();

      try {
        let payload: T;
        try {
          payload = JSON.parse(message.content.toString());
        } catch (parseError: any) {
          // Non-retryable: malformed JSON → DLQ immediately
          logger.error(`Malformed JSON from ${queue}, sending to DLQ`, {
            consumerTag,
            error: parseError.message
          });
          await this.sendToDLQ(
            { raw: message.content.toString() },
            DLQReason.INVALID_PAYLOAD,
            `JSON parse error: ${parseError.message}`
          );
          this.channel!.ack(message);
          return;
        }

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
        // Check retry count from message headers
        const headers = message.properties.headers || {};
        const retryCount = (headers['x-retry-count'] as number) || 0;

        if (retryCount >= maxRetries) {
          // Max retries exceeded → DLQ
          logger.error(`Max retries (${maxRetries}) exceeded for message from ${queue}, sending to DLQ`, {
            consumerTag,
            retryCount,
            error: error.message
          });

          let payload: any;
          try {
            payload = JSON.parse(message.content.toString());
          } catch {
            payload = { raw: message.content.toString() };
          }

          await this.sendToDLQ(payload, DLQReason.DATABASE_ERROR, `Max retries exceeded: ${error.message}`);
          this.channel!.ack(message);
        } else {
          // Retryable: requeue with incremented retry count and exponential backoff
          const baseDelay = parseInt(process.env.RABBITMQ_RETRY_BASE_DELAY || '500');
          const maxDelay = parseInt(process.env.RABBITMQ_RETRY_MAX_DELAY || '5000');
          const retryDelay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

          logger.warn(`Retrying message from ${queue} in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`, {
            consumerTag,
            retryDelay,
            error: error.message
          });

          this.channel!.ack(message);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          this.channel!.sendToQueue(queue, message.content, {
            persistent: true,
            headers: { ...headers, 'x-retry-count': retryCount + 1 }
          });
        }
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
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await rabbitmqService.connect();
      return;
    } catch (error: any) {
      if (attempt === maxAttempts) {
        throw new Error(`Failed to connect to RabbitMQ after ${maxAttempts} attempts: ${error.message}`);
      }
      const delay = Math.min(5000 * attempt, 30000);
      logger.warn(`RabbitMQ connect attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`, { error: error.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
