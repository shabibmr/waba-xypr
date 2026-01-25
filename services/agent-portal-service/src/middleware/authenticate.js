const jwt = require('jsonwebtoken');
const config = require('../config');
const { GenesysUser } = require('../models/Agent');

async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);

        try {
            const decoded = jwt.verify(token, config.jwt.secret);

            // Attach user info to request
            req.userId = decoded.userId;
            req.tenantId = decoded.tenantId;
            req.userRole = decoded.role;

            // Fetch full user details
            req.user = await GenesysUser.findById(decoded.userId);

            if (!req.user) {
                return res.status(401).json({ error: 'User not found' });
            }

            if (!req.user.is_active) {
                return res.status(401).json({ error: 'User account is inactive' });
            }

            next();
        } catch (jwtError) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    } catch (error) {
        console.error('Authentication error:', error);
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
