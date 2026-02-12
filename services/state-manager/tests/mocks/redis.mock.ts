/**
 * Redis Mock — Mimics the RedisWrapper from src/config/redis.ts
 * Supports: get, setEx, setNX, del, expire, ping, getConnectionStatus
 */

export class MockRedis {
    private cache: Map<string, { value: string; expiry: number }> = new Map();
    private connected = true;

    async get(key: string): Promise<string | null> {
        if (!this.connected) return null; // RedisWrapper returns null on error

        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }

    async setEx(key: string, ttl: number, value: string): Promise<void> {
        if (!this.connected) return; // RedisWrapper silently fails

        this.cache.set(key, {
            value,
            expiry: Date.now() + ttl * 1000,
        });
    }

    async setNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
        if (!this.connected) return false;

        if (this.cache.has(key)) {
            const entry = this.cache.get(key)!;
            if (Date.now() <= entry.expiry) return false; // key exists
            this.cache.delete(key);
        }

        this.cache.set(key, {
            value,
            expiry: Date.now() + ttlSeconds * 1000,
        });
        return true;
    }

    async del(key: string | string[]): Promise<void> {
        if (!this.connected) return;

        if (Array.isArray(key)) {
            key.forEach((k) => this.cache.delete(k));
        } else {
            this.cache.delete(key);
        }
    }

    async expire(key: string, ttl: number): Promise<void> {
        if (!this.connected) return;

        const entry = this.cache.get(key);
        if (entry) {
            entry.expiry = Date.now() + ttl * 1000;
        }
    }

    async ping(): Promise<string> {
        if (!this.connected) throw new Error('Redis not connected');
        return 'PONG';
    }

    getConnectionStatus(): boolean {
        return this.connected;
    }

    // --------------- Test utilities ---------------

    simulateDisconnect() {
        this.connected = false;
    }

    simulateReconnect() {
        this.connected = true;
    }

    clear() {
        this.cache.clear();
    }

    getCacheSize(): number {
        return this.cache.size;
    }

    reset() {
        this.clear();
        this.connected = true;
    }
}

export const createMockRedis = () => new MockRedis();
