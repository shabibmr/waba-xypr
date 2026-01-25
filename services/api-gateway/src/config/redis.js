const redis = require('redis');
const CONFIG = require('./config');

// Redis client for distributed rate limiting
const redisClient = redis.createClient({
    url: CONFIG.redisUrl
});

redisClient.connect().catch(err => {
    console.error('Redis connection error:', err);
});

module.exports = redisClient;
