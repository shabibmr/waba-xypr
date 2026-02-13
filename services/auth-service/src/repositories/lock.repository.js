const { randomUUID } = require('crypto');
const logger = require('../utils/logger');
const { RedisKeys, RedisTTL } = require('../utils/redis-keys');

// Lua: only delete if value matches (prevents releasing another owner's lock)
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

class LockRepository {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async acquire(provider, tenantId) {
    const key = RedisKeys.lock(provider, tenantId);
    const lockValue = randomUUID();

    try {
      const result = await this.redis.set(key, lockValue, {
        NX: true,
        EX: RedisTTL.LOCK_TTL,
      });

      const acquired = result === 'OK';
      if (acquired) {
        logger.debug('Lock acquired', { provider, tenantId });
      }
      return { acquired, lockValue };
    } catch (err) {
      logger.error('Lock acquisition error', { error: err.message, provider, tenantId });
      return { acquired: false, lockValue: null };
    }
  }

  async release(provider, tenantId, lockValue) {
    if (!lockValue) return;
    const key = RedisKeys.lock(provider, tenantId);
    try {
      await this.redis.eval(RELEASE_SCRIPT, {
        keys: [key],
        arguments: [lockValue],
      });
      logger.debug('Lock released', { provider, tenantId });
    } catch (err) {
      logger.error('Lock release error', { error: err.message, provider, tenantId });
      // Non-critical — lock will expire automatically
    }
  }
}

module.exports = { LockRepository };
