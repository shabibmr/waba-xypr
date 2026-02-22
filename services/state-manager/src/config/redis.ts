import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

class RedisWrapper {
  private client: RedisClientType | null = null;
  private connected = false;

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
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error', { error: err.message });
        this.connected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.connected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis ready');
        this.connected = true;
      });

      await this.client.connect();

    } catch (err: any) {
      logger.error('Failed to connect to Redis', { error: err.message });
      this.connected = false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (!this.client || !this.connected) {
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
      if (!this.client || !this.connected) {
        logger.warn('Redis unavailable, skipping cache write', { key });
        return;
      }
      await this.client.setEx(key, ttl, value);
    } catch (error: any) {
      logger.warn('Redis SETEX failed', { key, error: error.message });
    }
  }

  async setNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    try {
      if (!this.client || !this.connected) {
        logger.warn('Redis unavailable, skipping SET NX', { key });
        return false;
      }
      const result = await this.client.set(key, value, { NX: true, EX: ttlSeconds });
      return result === 'OK';
    } catch (error: any) {
      logger.warn('Redis SET NX failed', { key, error: error.message });
      return false;
    }
  }

  async del(key: string | string[]): Promise<void> {
    try {
      if (!this.client || !this.connected) return;

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
      if (!this.client || !this.connected) return;
      await this.client.expire(key, ttl);
    } catch (error: any) {
      logger.warn('Redis EXPIRE failed', { key, error: error.message });
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      if (!this.client || !this.connected) {
        logger.warn('Redis unavailable, skipping keys lookup', { pattern });
        return [];
      }
      return await this.client.keys(pattern);
    } catch (error: any) {
      logger.warn('Redis KEYS failed', { pattern, error: error.message });
      return [];
    }
  }

  async ping(): Promise<string> {
    if (!this.client || !this.connected) {
      throw new Error('Redis not connected');
    }
    return await this.client.ping();
  }

  getConnectionStatus(): boolean {
    return this.connected;
  }
}

const redisClient = new RedisWrapper();

(async () => {
  await redisClient.connect();
})();

export default redisClient;
