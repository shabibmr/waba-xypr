/**
 * Redis Mock
 * Mock Redis client for testing without a real Redis instance
 */

const redis = require('redis-mock');

class RedisMock {
    constructor() {
        this.client = null;
    }

    /**
     * Create a mock Redis client
     */
    createClient(options = {}) {
        this.client = redis.createClient(options);

        // Pre-seed with test data
        this.seedTestData();

        return this.client;
    }

    /**
     * Seed Redis with test data
     */
    async seedTestData() {
        if (!this.client) return;

        // Seed auth tokens
        await this.client.setEx(
            'genesys:oauth:token',
            3600,
            JSON.stringify({
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
                expiresAt: Math.floor(Date.now() / 1000) + 3600
            })
        );

        // Seed tenant credentials
        await this.client.set(
            'tenant:tenant-001:whatsapp',
            JSON.stringify({
                phoneNumberId: '123456789012345',
                accessToken: 'EAABsbCS1iHgBO7ZCqVz4ZCqJZBZCqVz4ZCqJ',
                displayPhoneNumber: '+1 555-0123'
            })
        );

        await this.client.set(
            'tenant:tenant-001:genesys',
            JSON.stringify({
                orgId: 'org-12345-abcde',
                region: 'mypurecloud.com',
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret'
            })
        );

        // Seed conversation mappings
        await this.client.set(
            'conversation:+919876543210',
            JSON.stringify({
                genesysConversationId: 'conv-12345-abcde-67890',
                tenantId: 'tenant-001',
                status: 'active'
            })
        );

        console.log('Redis test data seeded');
    }

    /**
     * Clear all data
     */
    async clear() {
        if (!this.client) return;
        await this.client.flushAll();
    }

    /**
     * Close the client
     */
    async close() {
        if (!this.client) return;
        await this.client.quit();
        this.client = null;
    }

    /**
     * Helper to set tenant credentials
     */
    async setTenantCredentials(tenantId, platform, credentials) {
        if (!this.client) return;
        await this.client.set(
            `tenant:${tenantId}:${platform}`,
            JSON.stringify(credentials)
        );
    }

    /**
     * Helper to set conversation mapping
     */
    async setConversationMapping(whatsappNumber, mapping) {
        if (!this.client) return;
        await this.client.set(
            `conversation:${whatsappNumber}`,
            JSON.stringify(mapping)
        );
    }

    /**
     * Helper to get all keys matching pattern
     */
    async getKeys(pattern) {
        if (!this.client) return [];
        return new Promise((resolve, reject) => {
            this.client.keys(pattern, (err, keys) => {
                if (err) reject(err);
                else resolve(keys);
            });
        });
    }
}

// Export singleton instance
module.exports = new RedisMock();
