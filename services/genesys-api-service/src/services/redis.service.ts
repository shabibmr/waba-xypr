/**
 * Redis service
 * Client setup and helpers for token caching and deduplication (T02)
 */

import { createClient } from 'redis';
// @ts-ignore
import config from '../config/config';
// @ts-ignore
import * as logger from '../utils/logger';

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connected = false;

export async function connectRedis(): Promise<void> {
    try {
        client = createClient({ url: config.redis.url });

        client.on('error', (err: Error) => {
            connected = false;
            logger.warn(null, 'Redis client error (non-fatal):', err.message);
        });
        client.on('ready', () => {
            connected = true;
        });
        client.on('end', () => {
            connected = false;
        });

        await client.connect();
        connected = true;
        logger.info(null, 'Redis connected');
    } catch (err: any) {
        connected = false;
        logger.warn(null, 'Redis connection failed (non-fatal, service continues):', err.message);
    }
}

export async function redisGet(key: string): Promise<string | null> {
    if (!client || !connected) return null;
    try {
        return await client.get(key);
    } catch (err: any) {
        logger.warn(null, 'Redis GET error:', err.message);
        return null;
    }
}

export async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!client || !connected) return;
    try {
        await client.set(key, value, { EX: ttlSeconds });
    } catch (err: any) {
        logger.warn(null, 'Redis SET error:', err.message);
    }
}

/**
 * Atomic SET if not exists.
 * Returns true  → key was newly set (first-time / no duplicate)
 * Returns false → key already existed (duplicate detected)
 * Fail-open: returns true when Redis is unavailable (allow processing to continue)
 */
export async function redisSetNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (!client || !connected) {
        // Fail open: Redis unavailable → treat all messages as new
        return true;
    }
    try {
        const result = await client.set(key, value, { NX: true, EX: ttlSeconds });
        return result === 'OK';
    } catch (err: any) {
        logger.warn(null, 'Redis SETNX error (fail open):', err.message);
        return true; // Fail open
    }
}

export async function redisDel(key: string): Promise<void> {
    if (!client || !connected) return;
    try {
        await client.del(key);
    } catch (err: any) {
        logger.warn(null, 'Redis DEL error:', err.message);
    }
}

export async function redisPing(): Promise<boolean> {
    if (!client || !connected) return false;
    try {
        const result = await client.ping();
        return result === 'PONG';
    } catch {
        return false;
    }
}
