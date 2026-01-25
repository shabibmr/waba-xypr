// Mock Redis client for testing
class RedisMock {
    constructor() {
        this.store = new Map();
        this.connected = false;
    }

    async connect() {
        this.connected = true;
        return this;
    }

    async disconnect() {
        this.connected = false;
    }

    async get(key) {
        return this.store.get(key) || null;
    }

    async set(key, value) {
        this.store.set(key, value);
        return 'OK';
    }

    async setEx(key, seconds, value) {
        this.store.set(key, value);
        // In a real implementation, would set expiry
        return 'OK';
    }

    async del(key) {
        return this.store.delete(key) ? 1 : 0;
    }

    async exists(key) {
        return this.store.has(key) ? 1 : 0;
    }

    async flushAll() {
        this.store.clear();
        return 'OK';
    }

    // Helper for tests
    clear() {
        this.store.clear();
    }
}

module.exports = RedisMock;
