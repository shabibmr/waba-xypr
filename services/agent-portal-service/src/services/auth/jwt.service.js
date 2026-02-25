const jwt = require('jsonwebtoken');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * JWT Service
 * Handles JWT token generation and validation
 * Maintains consistent token structure across the application
 */
class JWTService {
    constructor() {
        this.secret = config.jwt.secret;
        this.accessTokenExpiry = 3600; // 1 hour in seconds
        this.refreshTokenExpiry = '7d'; // 7 days
    }

    /**
     * Generate access token
     * @param {Object} payload - Token payload
     * @param {string} payload.userId - User ID
     * @param {string} payload.tenantId - Tenant ID
     * @param {string} payload.role - User role
     * @param {number} expiresIn - Expiry time in seconds (optional)
     * @returns {string} JWT access token
     */
    generateAccessToken(payload, expiresIn = this.accessTokenExpiry) {
        const tokenPayload = {
            userId: payload.userId,
            tenantId: payload.tenantId,
            role: payload.role,
            type: 'access'
        };

        return jwt.sign(tokenPayload, this.secret, { expiresIn });
    }

    /**
     * Generate refresh token
     * @param {Object} payload - Token payload
     * @param {string} payload.userId - User ID
     * @param {string} payload.tenantId - Tenant ID
     * @returns {string} JWT refresh token
     */
    generateRefreshToken(payload) {
        const tokenPayload = {
            userId: payload.userId,
            tenantId: payload.tenantId,
            type: 'refresh'
        };

        return jwt.sign(tokenPayload, this.secret, { expiresIn: this.refreshTokenExpiry });
    }

    /**
     * Generate both access and refresh tokens
     * @param {string} userId - User ID
     * @param {string} tenantId - Tenant ID
     * @param {string} role - User role
     * @returns {Object} Token pair with expiry
     */
    generateTokenPair(userId, tenantId, role) {
        const accessToken = this.generateAccessToken({ userId, tenantId, role });
        const refreshToken = this.generateRefreshToken({ userId, tenantId });

        return {
            accessToken,
            refreshToken,
            expiresIn: this.accessTokenExpiry
        };
    }

    /**
     * Validate and decode token
     * @param {string} token - JWT token
     * @param {string} expectedType - Expected token type ('access' or 'refresh')
     * @returns {Object} Decoded token payload
     * @throws {Error} If token is invalid or expired
     */
    validateToken(token, expectedType = null) {
        try {
            const decoded = jwt.verify(token, this.secret);

            // Validate token type if specified
            if (expectedType && decoded.type !== expectedType) {
                throw new Error(`Invalid token type. Expected ${expectedType}, got ${decoded.type}`);
            }

            return decoded;
        } catch (error) {
            logger.error('Token validation failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Decode token without verification (for debugging/logging)
     * @param {string} token - JWT token
     * @returns {Object} Decoded token payload
     */
    decodeToken(token) {
        return jwt.decode(token);
    }

    /**
     * Check if token is expired
     * @param {string} token - JWT token
     * @returns {boolean} True if expired
     */
    isTokenExpired(token) {
        try {
            const decoded = this.decodeToken(token);
            if (!decoded || !decoded.exp) {
                return true;
            }

            const currentTime = Math.floor(Date.now() / 1000);
            return decoded.exp < currentTime;
        } catch (error) {
            return true;
        }
    }
}

// Export singleton instance
module.exports = new JWTService();
