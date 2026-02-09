const { createClient } = require('redis');
const config = require('../config');
const logger = require('../utils/logger');

class TokenBlacklist {
    constructor() {
        this.redis = createClient({
            url: config.redis.url,
            socket: {
                reconnectStrategy: (retries) => {
                    const delay = Math.min(retries * 50, 2000);
                    return delay;
                }
            }
        });

        this.redis.on('error', (err) => {
            logger.error('Redis connection error', { error: err.message });
        });

        this.redis.on('connect', () => {
            logger.info('Redis connected for token blacklist');
        });

        // Connect to Redis
        this.redis.connect().catch(err => {
            logger.error('Failed to connect to Redis', { error: err.message });
        });

        this.keyPrefix = 'blacklist:token:';
    }

    /**
     * Add token to blacklist
     * @param {string} token - JWT token to blacklist
     * @param {number} expirySeconds - Time until token naturally expires
     */
    async addToken(token, expirySeconds) {
        try {
            if (!this.redis.isOpen) {
                await this.redis.connect();
            }

            const key = this.keyPrefix + token;

            // Store token with TTL matching token expiry
            // No need to keep it in Redis after token expires anyway
            await this.redis.setEx(key, expirySeconds, '1');

            logger.info('Token added to blacklist', {
                tokenPrefix: token.substring(0, 20),
                expirySeconds
            });

            return true;
        } catch (error) {
            logger.error('Failed to add token to blacklist', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Check if token is blacklisted
     * @param {string} token - JWT token to check
     * @returns {boolean} - True if token is blacklisted
     */
    async isBlacklisted(token) {
        try {
            if (!this.redis.isOpen) {
                await this.redis.connect();
            }

            const key = this.keyPrefix + token;
            const result = await this.redis.exists(key);

            return result === 1;
        } catch (error) {
            logger.error('Failed to check token blacklist', {
                error: error.message
            });
            // Fail open - allow request if Redis is down
            return false;
        }
    }

    /**
     * Remove token from blacklist (rarely needed)
     * @param {string} token - JWT token to remove
     */
    async removeToken(token) {
        try {
            if (!this.redis.isOpen) {
                await this.redis.connect();
            }

            const key = this.keyPrefix + token;
            await this.redis.del(key);

            logger.info('Token removed from blacklist', {
                tokenPrefix: token.substring(0, 20)
            });

            return true;
        } catch (error) {
            logger.error('Failed to remove token from blacklist', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Add multiple tokens to blacklist (for logout all)
     * @param {Array<{token: string, expirySeconds: number}>} tokens
     */
    async addTokens(tokens) {
        try {
            if (!this.redis.isOpen) {
                await this.redis.connect();
            }

            // Use multi for transaction
            const multi = this.redis.multi();

            tokens.forEach(({ token, expirySeconds }) => {
                const key = this.keyPrefix + token;
                multi.setEx(key, expirySeconds, '1');
            });

            await multi.exec();

            logger.info('Multiple tokens added to blacklist', {
                count: tokens.length
            });

            return true;
        } catch (error) {
            logger.error('Failed to add multiple tokens to blacklist', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get blacklist statistics
     */
    async getStats() {
        try {
            if (!this.redis.isOpen) {
                await this.redis.connect();
            }

            const keys = await this.redis.keys(this.keyPrefix + '*');

            return {
                blacklistedTokens: keys.length,
                prefix: this.keyPrefix
            };
        } catch (error) {
            logger.error('Failed to get blacklist stats', {
                error: error.message
            });
            return {
                blacklistedTokens: 0,
                error: error.message
            };
        }
    }

    /**
     * Close Redis connection (for graceful shutdown)
     */
    async close() {
        try {
            if (this.redis.isOpen) {
                await this.redis.quit();
                logger.info('Redis connection closed');
            }
        } catch (error) {
            logger.error('Error closing Redis connection', {
                error: error.message
            });
        }
    }
}

// Singleton instance
const tokenBlacklist = new TokenBlacklist();

module.exports = tokenBlacklist;
