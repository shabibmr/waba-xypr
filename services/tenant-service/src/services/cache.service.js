const redis = require('redis');

const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: false // Disable auto-reconnect to prevent crash loop
    }
});

// Handle connection errors gracefully
redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err.message);
    // Don't crash the service if Redis is unavailable
});

redisClient.connect().catch((err) => {
    console.error('Failed to connect to Redis:', err.message);
    console.warn('Service will continue without caching');
});

const CACHE_TTL = 3600; // 1 hour


class CacheService {
    async get(key) {
        try {
            if (!redisClient.isReady) {
                return null; // Skip cache if Redis unavailable
            }
            const value = await redisClient.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Cache get error:', error.message);
            return null;
        }
    }

    async set(key, value, ttl = CACHE_TTL) {
        try {
            if (!redisClient.isReady) {
                return; // Skip cache if Redis unavailable
            }
            await redisClient.setEx(key, ttl, JSON.stringify(value));
        } catch (error) {
            console.error('Cache set error:', error.message);
        }
    }

    async del(key) {
        try {
            if (!redisClient.isReady) {
                return; // Skip cache if Redis unavailable
            }
            await redisClient.del(key);
        } catch (error) {
            console.error('Cache delete error:', error.message);
        }
    }

    // Invalidate all tenant-related caches
    async invalidateTenant(tenantId) {
        try {
            if (!redisClient.isReady) {
                return; // Skip cache if Redis unavailable
            }

            const patterns = [
                `tenant:${tenantId}:*`,
                `phone:*`, // We don't know which phone_number_id, so clear all
                `integration:*` // Same for integration_id
            ];

            for (const pattern of patterns) {
                const keys = await redisClient.keys(pattern);
                if (keys.length > 0) {
                    await redisClient.del(keys);
                }
            }
        } catch (error) {
            console.error('Cache invalidation error:', error.message);
        }
    }
}

module.exports = new CacheService();
