const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const { GenesysUser } = require('../models/Agent');
const tokenBlacklist = require('../services/tokenBlacklist');

async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('Missing or invalid authorization header', {
                path: req.path,
                method: req.method,
                hasHeader: !!authHeader,
                ip: req.ip
            });
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);
        logger.debug('Authenticating request', {
            path: req.path,
            method: req.method,
            tokenLength: token.length
        });

        try {
            const decoded = jwt.verify(token, config.jwt.secret);
            logger.debug('Token verified successfully', {
                userId: decoded.userId,
                tenantId: decoded.tenantId
            });

            // Check if token is blacklisted (revoked)
            const isBlacklisted = await tokenBlacklist.isBlacklisted(token);
            if (isBlacklisted) {
                logger.warn('Blacklisted token used', {
                    userId: decoded.userId,
                    path: req.path
                });
                return res.status(401).json({ error: 'Token has been revoked' });
            }

            // Attach user info to request
            req.userId = decoded.userId;
            req.tenantId = decoded.tenantId;
            req.userRole = decoded.role;
            req.token = token; // Store token for logout

            // Fetch full user details
            req.user = await GenesysUser.findById(decoded.userId);

            if (!req.user) {
                logger.warn('User not found in database', {
                    userId: decoded.userId,
                    path: req.path
                });
                return res.status(401).json({ error: 'User not found' });
            }

            if (!req.user.is_active) {
                logger.warn('Inactive user attempted access', {
                    userId: decoded.userId,
                    path: req.path
                });
                return res.status(401).json({ error: 'User account is inactive' });
            }

            next();
        } catch (jwtError) {
            logger.warn('JWT verification failed', {
                path: req.path,
                error: jwtError.message,
                name: jwtError.name,
                ip: req.ip
            });
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    } catch (error) {
        logger.error('Authentication middleware error', {
            path: req.path,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Authentication failed' });
    }
}

/**
 * Role-based access control middleware
 */
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required_roles: allowedRoles,
                your_role: req.user?.role
            });
        }
        next();
    };
}

module.exports = { authenticate, requireRole };
