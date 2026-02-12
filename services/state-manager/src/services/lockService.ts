import redisClient from '../config/redis';
import logger from '../utils/logger';

class LockService {
  private readonly lockTTL = parseInt(process.env.LOCK_TTL_SECONDS || '5');
  private readonly maxRetries = parseInt(process.env.LOCK_RETRY_COUNT || '3');

  async acquireLock(wa_id: string): Promise<boolean> {
    const lockKey = `lock:mapping:${wa_id}`;

    try {
      const acquired = await redisClient.setNX(lockKey, '1', this.lockTTL);

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
