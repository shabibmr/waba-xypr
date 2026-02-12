# 02 — Infrastructure: RabbitMQ, Redis, Locking

**Priority**: P0-P1  
**Dependencies**: 01-foundation-database-types.md  
**Estimated Effort**: 6-8 hours

---

## Tasks

### 1. Implement RabbitMQ Service `src/services/rabbitmq.service.ts`

**Current Status**: Referenced in `src/index.ts` line 6 but **file does not exist**

**Required Queues (from FRD)**:
- `inboundQueue` — Incoming WhatsApp messages
- `outboundQueue` — Messages from Genesys to send to WhatsApp
- `statusQueue` — Status updates from WhatsApp
- `inbound-processed` — Processed inbound messages (to inbound-transformer)
- `outbound-processed` — Processed outbound messages (to whatsapp-api)
- `state-manager-dlq` — Dead letter queue

#### 1.1 Create RabbitMQ service

```typescript
// src/services/rabbitmq.service.ts

import amqp, { Channel, Connection, ConsumeMessage } from 'amqplib';
import logger from '../utils/logger';
import { InboundMessage, OutboundMessage, StatusUpdate, DLQMessage, DLQReason } from '../types';

class RabbitMQService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // 5 seconds

  // Queue names from environment
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

      // Assert all queues
      await this.assertQueues();

      this.reconnectAttempts = 0;
      logger.info('✓ RabbitMQ connected successfully', { queues: Object.keys(this.queues).length });

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
    }, this.reconnectDelay * this.reconnectAttempts); // Exponential backoff
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

// Export initialization function (called from index.ts)
export async function initializeRabbitMQ(): Promise<void> {
  await rabbitmqService.connect();
}
```

#### 1.2 Update `src/index.ts`

**Current**: Line 12 calls `initializeRabbitMQ()` but it's marked with `@ts-ignore`

**Fix**: Make the call async

```typescript
// src/index.ts (modify lines 11-12)
(async () => {
  await initializeRabbitMQ();
  console.log('✓ RabbitMQ initialized');
})();
```

---

### 2. Enhance Redis Client in `src/config/redis.ts`

**Current Issues**:
- No graceful degradation on failure
- No timeout configuration
- No connection retry logic

#### 2.1 Add graceful degradation wrapper

```typescript
// src/config/redis.ts (replace entire file)

import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

class RedisClient {
  private client: RedisClientType | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '1000'),
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.critical('Redis max reconnect attempts reached');
              return new Error('Max reconnect attempts reached');
            }
            return Math.min(retries * 100, 3000); // Exponential backoff
          }
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('✓ Redis connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('✓ Redis ready');
        this.isConnected = true;
      });

      await this.client.connect();

    } catch (err: any) {
      logger.error('Failed to connect to Redis', { error: err.message });
      this.isConnected = false;
    }
  }

  // Graceful degradation wrapper
  async get(key: string): Promise<string | null> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Redis unavailable, skipping cache read', { key });
        return null;
      }
      return await this.client.get(key);
    } catch (error: any) {
      logger.warn('Redis GET failed, falling back to DB', { key, error: error.message });
      return null;
    }
  }

  async setEx(key: string, ttl: number, value: string): Promise<void> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Redis unavailable, skipping cache write', { key });
        return;
      }
      await this.client.setEx(key, ttl, value);
    } catch (error: any) {
      logger.warn('Redis SETEX failed', { key, error: error.message });
      // Continue without caching
    }
  }

  async del(key: string | string[]): Promise<void> {
    try {
      if (!this.client || !this.isConnected) return;
      
      if (Array.isArray(key)) {
        await this.client.del(key);
      } else {
        await this.client.del(key);
      }
    } catch (error: any) {
      logger.warn('Redis DEL failed', { key, error: error.message });
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      if (!this.client || !this.isConnected) return;
      await this.client.expire(key, ttl);
    } catch (error: any) {
      logger.warn('Redis EXPIRE failed', { key, error: error.message });
    }
  }

  async ping(): Promise<string> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }
    return await this.client.ping();
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

const redisClient = new RedisClient();

// Initialize connection
(async () => {
  await redisClient.connect();
})();

export default redisClient;
```

---

### 3. Implement Distributed Locking `src/services/lockService.ts`

**Purpose**: Redis-based distributed locks for concurrent message processing

```typescript
// src/services/lockService.ts

import redisClient from '../config/redis';
import logger from '../utils/logger';

class LockService {
  private readonly lockTTL = parseInt(process.env.LOCK_TTL_SECONDS || '5');
  private readonly maxRetries = parseInt(process.env.LOCK_RETRY_COUNT || '3');

  async acquireLock(wa_id: string): Promise<boolean> {
    const lockKey = `lock:mapping:${wa_id}`;
    
    try {
      // SET NX (only if not exists) with TTL
      const result = await redisClient['client']?.set(lockKey, '1', {
        NX: true,
        EX: this.lockTTL
      });

      const acquired = result === 'OK';
      
      if (acquired) {
        logger.debug('Lock acquired', { wa_id, lockKey, ttl: this.lockTTL });
      }
      
      return acquired;

    } catch (error: any) {
      logger.warn('Lock acquisition failed (Redis error)', { 
        wa_id, 
        error: error.message 
      });
      return false;
    }
  }

  async releaseLock(wa_id: string): Promise<void> {
    const lockKey = `lock:mapping:${wa_id}`;
    
    try {
      await redisClient.del(lockKey);
      logger.debug('Lock released', { wa_id, lockKey });
    } catch (error: any) {
      logger.warn('Lock release failed', { wa_id, error: error.message });
    }
  }

  async withLockRetry(wa_id: string): Promise<boolean> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const acquired = await this.acquireLock(wa_id);
      
      if (acquired) {
        return true;
      }

      // Exponential backoff: 100ms, 200ms, 400ms
      const delay = 100 * Math.pow(2, attempt);
      logger.debug(`Lock retry ${attempt + 1}/${this.maxRetries}`, { 
        wa_id, 
        delay_ms: delay 
      });
      
      await this.sleep(delay);
    }

    logger.error('Failed to acquire lock after retries', { 
      wa_id, 
      attempts: this.maxRetries 
    });
    
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const lockService = new LockService();
export default lockService;
```

---

### 4. Update Environment Variables

Add to `.env`:

```bash
# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_HEARTBEAT=60
RABBITMQ_PREFETCH_COUNT=100

# Queue Names
INBOUND_QUEUE=inboundQueue
OUTBOUND_QUEUE=outboundQueue
STATUS_QUEUE=statusQueue
INBOUND_PROCESSED_QUEUE=inbound-processed
OUTBOUND_PROCESSED_QUEUE=outbound-processed
DLQ_NAME=state-manager-dlq

# Redis
REDIS_URL=redis://localhost:6379
REDIS_CONNECT_TIMEOUT=1000

# Locking
LOCK_TTL_SECONDS=5
LOCK_RETRY_COUNT=3

# Logging
LOG_LEVEL=DEBUG
```

---

## Verification

1. **Test RabbitMQ connection**:
```bash
npm run dev
# Check logs for "✓ RabbitMQ connected successfully"
```

2. **Test Redis graceful degradation**:
```bash
# Stop Redis
docker stop redis

# Start service - should log "Redis unavailable, falling back to DB"
npm run dev
```

3. **Test distributed lock**:
```typescript
import lockService from './services/lockService';

const acquired = await lockService.withLockRetry('919876543210');
console.log('Lock acquired:', acquired);
await lockService.releaseLock('919876543210');
```

---

## Next Steps

Proceed to:
- **03-core-operations.md** (Implement the 5 core operations)
