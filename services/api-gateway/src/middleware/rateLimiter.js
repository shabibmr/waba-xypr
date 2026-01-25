const rateLimit = require('express-rate-limit');
const redisClient = require('../config/redis');

// Rate limiting with Redis store
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: {
        async increment(key) {
            const current = await redisClient.incr(key);
            if (current === 1) {
                await redisClient.expire(key, 60);
            }
            return { totalHits: current, resetTime: new Date(Date.now() + 60000) };
        },
        async decrement(key) {
            await redisClient.decr(key);
        },
        async resetKey(key) {
            await redisClient.del(key);
        }
    }
});

module.exports = limiter;
