const config = require('../config');
const logger = require('../utils/logger');

// Import auth services
const genesysOAuthService = require('../services/auth/genesysOAuth.service');
const tenantProvisioningService = require('../services/auth/tenantProvisioning.service');
const userProvisioningService = require('../services/auth/userProvisioning.service');
const jwtService = require('../services/auth/jwt.service');
const sessionService = require('../services/auth/session.service');
const { sendOAuthSuccessResponse, sendOAuthErrorResponse } = require('../utils/responseHelpers');

/**
 * Initiate Genesys OAuth login
 */
async function initiateLogin(req, res) {
    logger.info('Initiating Genesys OAuth login', {
        ip: req.ip,
        authorizeUrl: `https://login.${config.genesys.region}/oauth/authorize`,
        clientId: config.genesys.agentClientId,
        redirectUri: config.genesys.redirectUri,
        region: config.genesys.region
    });

    const authorizeUrl = `https://login.${config.genesys.region}/oauth/authorize`;
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.genesys.agentClientId,
        redirect_uri: config.genesys.redirectUri,
        scope: 'users:readonly organization:readonly'
    });

    res.redirect(`${authorizeUrl}?${params.toString()}`);
}

/**
 * Handle Genesys OAuth callback
 * Auto-provisions user on first login
 * Refactored to use service layer
 */
async function handleCallback(req, res, next) {
    try {
        const { code } = req.query;

        // Validate authorization code
        if (!code) {
            logger.warn('OAuth callback missing authorization code', { ip: req.ip });
            return res.status(400).json({ error: 'No authorization code' });
        }

        logger.info('Processing OAuth callback', { codeLength: code.length });

        // 1. Exchange code for Genesys access token
        const accessToken = await genesysOAuthService.exchangeCodeForToken(code);

        // 2. Get user and organization info from Genesys (parallel)
        const { user: genesysUser, organization: genesysOrg } =
            await genesysOAuthService.getUserAndOrganization(accessToken);

        // Validate organization ID
        if (!genesysOrg.id) {
            logger.warn('Organization has no ID', {
                userId: genesysUser.id,
                email: genesysUser.email
            });
            return res.status(400).json({ error: 'No organization ID found' });
        }

        // 3. Provision tenant (find or create)
        const tenant = await tenantProvisioningService.provisionTenant(
            genesysOrg.id,
            genesysOrg.name,
            config.genesys.region
        );

        // 4. Provision user (find or create)
        const user = await userProvisioningService.provisionUser(genesysUser, tenant.tenantId);

        logger.info('User authenticated via Genesys OAuth', {
            userId: user.user_id,
            tenantId: tenant.tenantId,
            role: user.role
        });

        // 5. Update last login
        await userProvisioningService.updateLastLogin(user.user_id);

        // 6. Generate JWT tokens
        const tokens = jwtService.generateTokenPair(
            user.user_id,
            user.tenant_id,
            user.role
        );

        logger.info('Tokens generated');

        // 7. Create session
        await sessionService.createSession(
            user.user_id,
            tokens.accessToken,
            tokens.refreshToken,
            {
                ip: req.ip,
                userAgent: req.get('user-agent')
            }
        );

        logger.info('Session created, sending success response');

        // 8. Send OAuth success response (HTML with postMessage)
        sendOAuthSuccessResponse(res, tokens, tenant, genesysOrg, user);

    } catch (error) {
        logger.error('OAuth callback error', {
            error: error.message,
            stack: error.stack
        });
        sendOAuthErrorResponse(res, error);
    }
}

/**
 * Refresh access token using refresh token
 */
async function refreshToken(req, res, next) {
    try {
        const { refreshToken } = req.body;

        // Validate request
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        logger.info('Refreshing access token');

        // 1. Validate refresh token
        const decoded = jwtService.validateToken(refreshToken, 'refresh');

        // 2. Generate new token pair
        const tokens = jwtService.generateTokenPair(
            decoded.userId,
            decoded.tenantId,
            decoded.role
        );

        logger.info('Token refresh successful', { userId: decoded.userId });

        // 3. Return new tokens (maintaining exact response format)
        res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn
        });

    } catch (error) {
        logger.error('Token refresh error', { error: error.message });
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
}

/**
 * Logout user
 */
async function logout(req, res) {
    try {
        const userId = req.user?.user_id;
        const token = req.token || req.headers.authorization?.replace('Bearer ', '');

        if (userId && token) {
            // Invalidate session and blacklist token
            await sessionService.invalidateSession(userId, token);
            logger.info('User logged out', { userId });
        }

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        logger.error('Logout error', { error: error.message });
        res.json({ message: 'Logged out successfully' }); // Still return success
    }
}

/**
 * Logout from all devices
 */
async function logoutAll(req, res, next) {
    try {
        const userId = req.user?.user_id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Invalidate all sessions
        const count = await sessionService.invalidateAllSessions(userId);

        logger.info('All user sessions invalidated', {
            userId,
            sessionCount: count
        });

        res.json({
            message: 'Logged out from all devices',
            sessionCount: count
        });
    } catch (error) {
        logger.error('Logout all error', { error: error.message });
        next(error);
    }
}

/**
 * Get user profile
 */
async function getProfile(req, res, next) {
    try {
        const userId = req.user?.user_id;

        logger.info('Getting profile for user', { userId });

        // Get user profile with organization and WhatsApp config
        const profile = await userProvisioningService.getUserProfile(userId);

        res.json(profile);
    } catch (error) {
        logger.error('Get profile error', {
            userId: req.user?.user_id,
            error: error.message,
            stack: error.stack
        });
        next(error);
    }
}

/**
 * Demo login - Skip OAuth and use demo tenant
 */
async function demoLogin(req, res, next) {
    try {
        logger.info('Demo login initiated', { ip: req.ip });

        const demoTenantId = 'demo-tenant-001';
        const demoGenesysUser = {
            id: 'demo-user-001',
            name: 'Demo Agent',
            email: 'demo@example.com',
            organization: { id: 'demo-org-001' }
        };

        // 1. Provision demo user
        const user = await userProvisioningService.provisionUser(demoGenesysUser, demoTenantId);

        logger.info('Demo user authenticated', {
            userId: user.user_id,
            tenantId: demoTenantId
        });

        // 2. Update last login
        await userProvisioningService.updateLastLogin(user.user_id);

        // 3. Generate tokens
        const tokens = jwtService.generateTokenPair(
            user.user_id,
            user.tenant_id,
            user.role
        );

        // 4. Create session
        await sessionService.createSession(
            user.user_id,
            tokens.accessToken,
            tokens.refreshToken,
            {
                ip: req.ip,
                userAgent: req.get('user-agent')
            }
        );

        // 5. Get profile with WhatsApp config
        const profile = await userProvisioningService.getUserProfile(user.user_id);

        logger.info('Demo login successful', { userId: user.user_id });

        // 6. Return response (maintaining exact format)
        res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            agent: {
                user_id: user.user_id,
                name: user.name,
                email: user.genesys_email,
                role: user.role,
                tenant_id: user.tenant_id
            },
            organization: profile.organization
        });
    } catch (error) {
        logger.error('Demo login error', { error: error.message, stack: error.stack });
        next(error);
    }
}

module.exports = {
    initiateLogin,
    handleCallback,
    refreshToken,
    logout,
    logoutAll,
    getProfile,
    demoLogin
};
