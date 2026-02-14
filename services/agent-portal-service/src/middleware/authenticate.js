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

        // MVP: decode without verification (skip signature check)
        const decoded = jwt.decode(token);

        if (!decoded || !decoded.userId) {
            logger.warn('Token decoding failed or missing userId', { tokenPreview: token.substring(0, 10) + '...' });
            return res.status(401).json({ error: 'Invalid token' });
        }

        logger.info('Token decoded successfully', { userId: decoded.userId, tenantId: decoded.tenantId, role: decoded.role });

        // Attach user info to request
        req.userId = decoded.userId;
        req.tenantId = decoded.tenantId;
        req.userRole = decoded.role;
        req.token = token;

        // Fetch full user details
        try {
            logger.info('Authenticating user from DB', { userId: decoded.userId });
            const startTime = Date.now();
            req.user = await GenesysUser.findById(decoded.userId);
            logger.info('User DB lookup completed', { userId: decoded.userId, duration: Date.now() - startTime });

            if (!req.user) {
                logger.warn('User not found in database', { userId: decoded.userId, path: req.path });
                return res.status(401).json({ error: 'User not found' });
            }
            logger.info('User authenticated from DB', { userId: req.user.user_id, email: req.user.genesys_email });
        } catch (dbError) {
            logger.error('Database error during authentication', { userId: decoded.userId, error: dbError.message, stack: dbError.stack });
            throw dbError; // Re-throw to be caught by outer catch
        }

        next();
    } catch (error) {
        logger.error('Authentication middleware error', {
            path: req.path,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Authentication failed', details: error.message });
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
