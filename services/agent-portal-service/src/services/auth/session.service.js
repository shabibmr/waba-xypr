const { GenesysUser } = require('../../models/Agent');
const tokenBlacklist = require('../tokenBlacklist');
const logger = require('../../utils/logger');
const jwt = require('jsonwebtoken');

/**
 * Session Service
 * Handles user session lifecycle including creation, invalidation, and token blacklisting
 * Integrates database sessions with Redis token blacklist
 */
class SessionService {
    /**
     * Create new user session
     * @param {string} userId - User ID
     * @param {string} accessToken - Access token
     * @param {string} refreshToken - Refresh token
     * @param {Object} metadata - Session metadata (ip, userAgent)
     * @returns {Promise<Object>} Created session
     * @throws {Error} If session creation fails
     */
    async createSession(userId, accessToken, refreshToken, metadata = {}) {
        logger.info('Creating session', { userId });

        try {
            const sessionData = {
                user_id: userId,
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                ip_address: metadata.ip || null,
                user_agent: metadata.userAgent || null
            };

            const session = await GenesysUser.createSession(sessionData);

            logger.info('Session created', {
                userId,
                sessionId: session.session_id,
                expiresAt: session.expires_at
            });

            return session;
        } catch (error) {
            logger.error('Failed to create session', {
                userId,
                error: error.message,
                stack: error.stack
            });
            throw new Error('Failed to create session');
        }
    }

    /**
     * Invalidate single session (logout)
     * Marks session as inactive in DB and adds token to blacklist
     * @param {string} userId - User ID
     * @param {string} accessToken - Access token to invalidate
     * @returns {Promise<void>}
     */
    async invalidateSession(userId, accessToken) {
        logger.info('Invalidating session', { userId });

        try {
            // 1. Decode token to get expiry
            const decoded = jwt.decode(accessToken);
            const expirySeconds = decoded?.exp
                ? Math.max(0, decoded.exp - Math.floor(Date.now() / 1000))
                : 3600;

            // 2. Add token to blacklist
            await tokenBlacklist.addToken(accessToken, expirySeconds);

            // 3. Invalidate session in database
            await GenesysUser.invalidateSession(userId, accessToken);

            logger.info('Session invalidated', {
                userId,
                tokenBlacklisted: true
            });
        } catch (error) {
            logger.error('Failed to invalidate session', {
                userId,
                error: error.message
            });
            // Don't throw - logout should succeed even if cleanup fails
        }
    }

    /**
     * Invalidate all user sessions (logout from all devices)
     * @param {string} userId - User ID
     * @returns {Promise<number>} Number of sessions invalidated
     * @throws {Error} If invalidation fails
     */
    async invalidateAllSessions(userId) {
        logger.info('Invalidating all sessions', { userId });

        try {
            // 1. Get all active sessions for the user
            const sessions = await GenesysUser.getActiveSessions(userId);

            // 2. Prepare tokens for blacklisting
            const tokensToBlacklist = sessions.map(session => {
                const decoded = jwt.decode(session.access_token);
                const expirySeconds = decoded?.exp
                    ? Math.max(0, decoded.exp - Math.floor(Date.now() / 1000))
                    : 3600;

                return {
                    token: session.access_token,
                    expirySeconds
                };
            }).filter(t => t.token); // Filter out null tokens

            // 3. Blacklist all tokens
            if (tokensToBlacklist.length > 0) {
                await tokenBlacklist.addTokens(tokensToBlacklist);
            }

            // 4. Invalidate all sessions in database
            const count = await GenesysUser.invalidateAllSessions(userId);

            logger.info('All sessions invalidated', {
                userId,
                sessionCount: count,
                tokensBlacklisted: tokensToBlacklist.length
            });

            return count;
        } catch (error) {
            logger.error('Failed to invalidate all sessions', {
                userId,
                error: error.message,
                stack: error.stack
            });
            throw new Error('Failed to invalidate all sessions');
        }
    }

    /**
     * Refresh session tokens
     * Creates new session with new tokens and invalidates old session
     * @param {string} refreshToken - Refresh token
     * @param {Object} metadata - Session metadata (ip, userAgent)
     * @returns {Promise<Object>} New tokens
     * @throws {Error} If refresh fails
     */
    async refreshSession(refreshToken, metadata = {}) {
        logger.info('Refreshing session');

        try {
            // Find session by refresh token
            const session = await GenesysUser.findSessionByRefreshToken(refreshToken);

            if (!session) {
                throw new Error('Invalid or expired refresh token');
            }

            logger.info('Session found for refresh', {
                userId: session.user_id,
                sessionId: session.session_id
            });

            return {
                userId: session.user_id,
                tenantId: session.tenant_id,
                role: session.role
            };
        } catch (error) {
            logger.error('Session refresh failed', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get active sessions for user
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Active sessions
     */
    async getActiveSessions(userId) {
        logger.info('Fetching active sessions', { userId });

        try {
            const sessions = await GenesysUser.getActiveSessions(userId);

            logger.info('Active sessions retrieved', {
                userId,
                count: sessions.length
            });

            return sessions;
        } catch (error) {
            logger.error('Failed to fetch active sessions', {
                userId,
                error: error.message
            });
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new SessionService();
