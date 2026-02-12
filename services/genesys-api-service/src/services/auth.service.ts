/**
 * Authentication service
 * OAuth token management with Redis caching (T07)
 */

import axios from 'axios';
// @ts-ignore
import config from '../config/config';
// @ts-ignore
import * as logger from '../utils/logger';
import { redisGet, redisSet, redisDel } from './redis.service';

const TOKEN_KEY_PREFIX = 'genesys:token:';
const DEFAULT_TTL_SECONDS = 3300; // 55 minutes when expires_in not provided

/**
 * Get OAuth token for tenant, with Redis caching.
 * Cache key: genesys:token:{tenantId}
 * TTL: expires_in - 300 (5-minute buffer before expiry)
 */
export async function getAuthToken(tenantId: string): Promise<string> {
    const cacheKey = `${TOKEN_KEY_PREFIX}${tenantId}`;

    // 1. Try Redis cache
    try {
        const cached = await redisGet(cacheKey);
        if (cached) {
            const tokenData = JSON.parse(cached);
            const nowSeconds = Math.floor(Date.now() / 1000);
            if (tokenData.expiry && tokenData.expiry > nowSeconds + 300) {
                logger.debug(tenantId, 'Token cache HIT');
                return tokenData.access_token;
            }
            logger.debug(tenantId, 'Token cache EXPIRED — fetching fresh token');
        } else {
            logger.debug(tenantId, 'Token cache MISS — fetching from auth service');
        }
    } catch (err: any) {
        logger.warn(tenantId, 'Redis token read failed (falling back to auth service):', err.message);
    }

    // 2. Fetch from auth service
    try {
        const response = await axios.get(
            `${config.services.authService.url}/auth/token`,
            {
                headers: { 'X-Tenant-ID': tenantId },
                timeout: 5000
            }
        );

        const data = response.data;
        // Support both OAuth standard { access_token, expires_in } and legacy { token }
        const accessToken: string = data.access_token || data.token;
        const expiresIn: number = data.expires_in || DEFAULT_TTL_SECONDS;
        const ttl = Math.max(expiresIn - 300, 60);

        // 3. Cache in Redis
        try {
            const cacheValue = JSON.stringify({
                access_token: accessToken,
                expiry: Math.floor(Date.now() / 1000) + ttl
            });
            await redisSet(cacheKey, cacheValue, ttl);
        } catch (err: any) {
            logger.warn(tenantId, 'Redis token cache write failed (non-fatal):', err.message);
        }

        return accessToken;
    } catch (error: any) {
        logger.error(tenantId, 'Failed to fetch auth token:', error.message);
        throw error;
    }
}

/**
 * Invalidate cached token (called on 401 from Genesys).
 */
export async function invalidateToken(tenantId: string): Promise<void> {
    const cacheKey = `${TOKEN_KEY_PREFIX}${tenantId}`;
    await redisDel(cacheKey);
    logger.info(tenantId, 'Token invalidated');
}
