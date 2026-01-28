import redis from 'redis';

const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

(async () => {
    try {
        await redisClient.connect();
        console.log('Redis connected successfully');
    } catch (err) {
        console.error('Failed to connect to Redis', err);
    }
})();

export default redisClient;
