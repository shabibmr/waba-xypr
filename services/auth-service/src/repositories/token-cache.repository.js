const logger = require('../utils/logger');
const { RedisKeys, RedisTTL } = require('../utils/redis-keys');

class TokenCacheRepository {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async get(provider, tenantId) {
    const key = RedisKeys.token(provider, tenantId);
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;

      const cached = JSON.parse(raw);

      if (Date.now() >= cached.expiresAt) {
        logger.debug('Token in cache is expired', { provider, tenantId });
        return null;
      }

      return {
        accessToken: cached.token,
        expiresIn: Math.floor((cached.expiresAt - Date.now()) / 1000),
        tokenType: 'Bearer',
        source: 'cache',
        cachedAt: new Date(cached.cachedAt),
        expiresAt: new Date(cached.expiresAt),
      };
    } catch (err) {
      logger.warn('Token cache get failed', { error: err.message, provider, tenantId });
      return null;
    }
  }

  async set(provider, tenantId, token, expiresIn) {
    const safetyBuffer = RedisTTL.TOKEN_SAFETY_BUFFER;
    const ttl = expiresIn - safetyBuffer;
    if (ttl <= 0) {
      logger.warn('Token TTL too short to cache', { provider, tenantId, expiresIn });
      return;
    }

    const key = RedisKeys.token(provider, tenantId);
    const now = Date.now();
    const payload = {
      token,
      expiresAt: now + expiresIn * 1000,
      cachedAt: now,
    };

    try {
      await this.redis.setEx(key, ttl, JSON.stringify(payload));
      logger.info('Token cached', {
        provider,
        tenantId,
        ttl,
        expiresAt: new Date(payload.expiresAt).toISOString(),
        tokenLength: token.length,
      });
    } catch (err) {
      logger.error('Token cache set failed', { error: err.message, provider, tenantId });
    }
  }

  async delete(provider, tenantId) {
    const key = RedisKeys.token(provider, tenantId);
    try {
      await this.redis.del(key);
      logger.info('Token cache cleared', { provider, tenantId });
    } catch (err) {
      logger.warn('Token cache delete failed', { error: err.message, provider, tenantId });
    }
  }
}

module.exports = { TokenCacheRepository };
