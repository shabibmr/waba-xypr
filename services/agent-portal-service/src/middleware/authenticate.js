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
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Attach user info to request
        req.userId = decoded.userId;
        req.tenantId = decoded.tenantId;
        req.userRole = decoded.role;
        req.token = token;

        // Fetch full user details
        req.user = await GenesysUser.findById(decoded.userId);

        if (!req.user) {
            logger.warn('User not found in database', { userId: decoded.userId, path: req.path });
            return res.status(401).json({ error: 'User not found' });
        }

        next();
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
