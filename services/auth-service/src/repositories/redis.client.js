const { createClient } = require('redis');
const logger = require('../utils/logger');
const config = require('../config');

let instance = null;

function getRedisClient() {
  if (!instance) {
    instance = createClient({
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) return new Error('Redis max retries exceeded');
          return Math.min(retries * 100, 3000);
        },
      },
    });

    instance.on('connect',      () => logger.info('Redis connected'));
    instance.on('ready',        () => logger.info('Redis ready'));
    instance.on('error',        (err) => logger.error('Redis error', { error: err.message }));
    instance.on('reconnecting', () => logger.warn('Redis reconnecting'));
    instance.on('end',          () => logger.warn('Redis connection closed'));
  }
  return instance;
}

async function connectRedis() {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}

module.exports = { getRedisClient, connectRedis };
