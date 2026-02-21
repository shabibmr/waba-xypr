const { createClient } = require('redis');
const logger = require('../utils/logger');
const config = require('../config'); // Use existing config

class RedisService {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async initialize() {
        if (this.isConnected) return;

        try {
            this.client = createClient({
                url: process.env.REDIS_URL || 'redis://whatsapp-redis:6379'
            });

            this.client.on('error', (err) => {
                logger.error('Redis service error', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                logger.info('system', 'Redis service connected successfully');
                this.isConnected = true;
            });

            await this.client.connect();
        } catch (error) {
            logger.error('Failed to initialize Redis service', error);
            throw error;
        }
    }

    /**
     * Store the Genesys User Token in Redis
     * @param {string} agentUserId - The Genesys user ID
     * @param {string} token - The OAuth implicit grant token
     * @param {number} expiresInSeconds - Expiration time (default 12 hours)
     */
    async storeAgentToken(agentUserId, token, expiresInSeconds = 43200) {
        if (!this.isConnected) await this.initialize();
        if (!agentUserId || !token) return;

        try {
            const key = `gc:token:${agentUserId}`;
            await this.client.setEx(key, expiresInSeconds, token);
            logger.debug('system', `Stored agent token in Redis for user: ${agentUserId}`);
        } catch (error) {
            logger.error(`Failed to store agent token for ${agentUserId}`, error);
        }
    }

    /**
     * Get the Genesys User Token from Redis
     * @param {string} agentUserId - The Genesys user ID
     */
    async getAgentToken(agentUserId) {
        if (!this.isConnected) await this.initialize();
        if (!agentUserId) return null;

        try {
            const key = `gc:token:${agentUserId}`;
            return await this.client.get(key);
        } catch (error) {
            logger.error(`Failed to get agent token for ${agentUserId}`, error);
            return null;
        }
    }
}

module.exports = new RedisService();
