const jwt = require('jsonwebtoken');
const axios = require('axios');
const { GenesysUser } = require('../models/Agent');
const config = require('../config');
const logger = require('../utils/logger');
const tokenBlacklist = require('../services/tokenBlacklist');

/**
 * Initiate Genesys OAuth login
 */
async function initiateLogin(req, res) {
    logger.info('Initiating Genesys OAuth login', {
        ip: req.ip,
        authorizeUrl: `https://login.${config.genesys.region}/oauth/authorize`,
        clientId: config.genesys.clientId,
        redirectUri: config.genesys.redirectUri,
        region: config.genesys.region
    });

    const authorizeUrl = `https://login.${config.genesys.region}/oauth/authorize`;
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.genesys.clientId,
        redirect_uri: config.genesys.redirectUri,
        scope: 'users:readonly organization:readonly'
    });

    res.redirect(`${authorizeUrl}?${params.toString()}`);
}

/**
 * Handle Genesys OAuth callback
 * Auto-provisions user on first login
 */
async function handleCallback(req, res, next) {
    try {
        const { code } = req.query;

        if (!code) {
            logger.warn('OAuth callback missing authorization code', { ip: req.ip });
            return res.status(400).send('<script>window.opener.postMessage({type:"GENESYS_AUTH_ERROR",error:"No authorization code"}, "*");window.close();</script>');
        }

        // Exchange code for token
        const tokenUrl = `https://login.${config.genesys.region}/oauth/token`;
        logger.info('Exchanging OAuth code for access token', {
            codeLength: code.length,
            url: tokenUrl,
            clientId: config.genesys.clientId,
            clientSecret: config.genesys.clientSecret ? '***' + config.genesys.clientSecret.slice(-4) : 'NOT_SET',
            redirectUri: config.genesys.redirectUri,
            genesysRegion: config.genesys.region,
            grantType: 'authorization_code'
        });

        let tokenResponse;
        try {
            tokenResponse = await axios.post(
                `https://login.${config.genesys.region}/oauth/token`,
                new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: config.genesys.redirectUri,
                    client_id: config.genesys.clientId,
                    client_secret: config.genesys.clientSecret
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );
            logger.info('Token exchange successful', {
                hasAccessToken: !!tokenResponse.data.access_token
            });
        } catch (tokenError) {
            logger.error('Token exchange failed', {
                url: `https://login.${config.genesys.region}/oauth/token`,
                clientId: config.genesys.clientId,
                redirectUri: config.genesys.redirectUri,
                error: tokenError.message,
                status: tokenError.response?.status,
                statusText: tokenError.response?.statusText,
                data: tokenError.response?.data
            });
            throw tokenError;
        }

        const { access_token } = tokenResponse.data;

        // Get user info from Genesys
        const userInfoUrl = `https://api.${config.genesys.region}/api/v2/users/me`;
        logger.info('Fetching user info from Genesys', {
            url: userInfoUrl,
            hasAccessToken: !!access_token,
            region: config.genesys.region
        });



        let userResponse;
        try {
            userResponse = await axios.get(
                `https://api.${config.genesys.region}/api/v2/users/me`,
                {
                    headers: { Authorization: `Bearer ${access_token}` }
                }
            );
            logger.info('Genesys user info retrieved', {
                userId: userResponse.data.id,
                email: userResponse.data.email,
                orgId: userResponse.data.organization?.id,
                fullUserData: JSON.stringify(userResponse.data, null, 2)
            });
        } catch (userError) {
            logger.error('Failed to fetch Genesys user info', {
                url: `https://api.${config.genesys.region}/api/v2/users/me`,
                region: config.genesys.region,
                error: userError.message,
                status: userError.response?.status,
                statusText: userError.response?.statusText
            });
            throw userError;
        }

        const genesysUser = userResponse.data;

        // Get organization info from Genesys (separate API call)
        const orgInfoUrl = `https://api.${config.genesys.region}/api/v2/organizations/me`;
        logger.info('Fetching organization info from Genesys', {
            url: orgInfoUrl,
            hasAccessToken: !!access_token,
            region: config.genesys.region
        });

        let orgResponse;
        try {
            orgResponse = await axios.get(
                `https://api.${config.genesys.region}/api/v2/organizations/me`,
                {
                    headers: { Authorization: `Bearer ${access_token}` }
                }
            );
            logger.info('Genesys organization info retrieved', {
                orgId: orgResponse.data.id,
                orgName: orgResponse.data.name,
                domain: orgResponse.data.domain
            });
        } catch (orgError) {
            logger.error('Failed to fetch Genesys organization info', {
                url: `https://api.${config.genesys.region}/api/v2/organizations/me`,
                region: config.genesys.region,
                error: orgError.message,
                status: orgError.response?.status,
                statusText: orgError.response?.statusText
            });
            return res.status(400).send('<script>window.opener.postMessage({type:"GENESYS_AUTH_ERROR",error:"Failed to fetch organization info"}, "*");window.close();</script>');
        }

        const genesysOrgId = orgResponse.data.id;

        if (!genesysOrgId) {
            logger.warn('Organization has no ID', {
                userId: genesysUser.id,
                email: genesysUser.email,
                orgData: JSON.stringify(orgResponse.data, null, 2)
            });
            return res.status(400).send('<script>window.opener.postMessage({type:"GENESYS_AUTH_ERROR",error:"No organization ID found"}, "*");window.close();</script>');
        }

        // Find or create tenant by Genesys organization ID (Auto-provisioning)
        const provisioningUrl = `${config.services.tenantService}/api/tenants/provision/genesys`;
        logger.info('Provisioning tenant for Genesys organization', {
            genesysOrgId,
            genesysOrgName: orgResponse.data.name,
            region: config.genesys.region,
            url: provisioningUrl
        });

        let tenantResponse;
        try {
            tenantResponse = await axios.post(
                provisioningUrl,
                {
                    genesysOrgId: genesysOrgId,
                    genesysOrgName: orgResponse.data.name,
                    genesysRegion: config.genesys.region
                }
            );
            logger.info('Tenant provisioned/found', {
                tenantId: tenantResponse.data.tenant_id,
                tenantName: tenantResponse.data.tenant_name
            });
        } catch (tenantError) {
            logger.error('Tenant provisioning failed', {
                genesysOrgId,
                url: provisioningUrl,
                error: tenantError.message,
                status: tenantError.response?.status,
                data: tenantError.response?.data
            });

            return res.status(400).send(`
            <script>
              window.opener.postMessage({
                type: 'GENESYS_AUTH_ERROR',
                error: 'Unable to provision tenant. Please try again later.'
              }, '*');
              window.close();
            </script>
          `);
        }

        const tenant = tenantResponse.data;

        // Find or create user (auto-provisioning)
        const user = await GenesysUser.findOrCreateFromGenesys(genesysUser, tenant.tenant_id);
        logger.info('User authenticated via Genesys OAuth', {
            userId: user.user_id,
            tenantId: tenant.tenant_id,
            role: user.role
        });

        // Update last login
        logger.info('Updating last login...');
        await GenesysUser.updateLastLogin(user.user_id);
        logger.info('Last login updated.');

        // Issue JWT tokens (access + refresh)
        logger.info('Signing JWT tokens...');

        // Access token (short-lived: 1 hour)
        const accessToken = jwt.sign(
            {
                userId: user.user_id,
                tenantId: user.tenant_id,
                role: user.role,
                type: 'access'
            },
            config.jwt.secret,
            { expiresIn: '1h' }
        );

        // Refresh token (long-lived: 7 days)
        const refreshToken = jwt.sign(
            {
                userId: user.user_id,
                tenantId: user.tenant_id,
                type: 'refresh'
            },
            config.jwt.secret,
            { expiresIn: '7d' }
        );

        logger.info('JWT tokens signed.');

        // Create session
        logger.info('Creating session...');
        await GenesysUser.createSession({
            user_id: user.user_id,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            ip_address: req.ip,
            user_agent: req.get('user-agent')
        });
        logger.info('Session created.');

        // Send success message to parent window
        logger.info('Sending success response to browser...');
        res.send(`
      <html><body><p id="status">Authenticating...</p></body>
      <script>
        try {
            window.opener.postMessage({
              type: 'GENESYS_AUTH_SUCCESS',
              accessToken: '${accessToken}',
              refreshToken: '${refreshToken}',
              agent: ${JSON.stringify({
            user_id: user.user_id,
            name: user.name,
            email: user.genesys_email,
            role: user.role,
            tenant_id: user.tenant_id
        })}
            }, '*');
            document.getElementById('status').innerText = 'Success! Closing...';
            window.close();
        } catch (e) {
            document.body.innerHTML = '<h2>Error during authentication</h2><p>' + e.message + '</p><pre>' + e.stack + '</pre>';
            console.error(e);
        }
      </script>
      </html>
    `);
    } catch (error) {
        logger.error('OAuth callback error', {
            error: error.message,
            stack: error.stack
        });
        res.send(`
      <html><body><p id="error-status">Authentication Failed</p></body>
      <script>
        try {
            window.opener.postMessage({
              type: 'GENESYS_AUTH_ERROR',
              error: 'Authentication failed'
            }, '*');
            document.getElementById('error-status').innerText = 'Error sent to parent. Closing...';
            window.close();
        } catch (e) {
            document.body.innerHTML = '<h2>Error sending failure message</h2><p>' + e.message + '</p><pre>' + e.stack + '</pre>';
            console.error(e);
        }
      </script>
      </html>
    `);
    }
}

/**
 * Refresh access token using refresh token
 */
async function refreshToken(req, res, next) {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, config.jwt.secret);

            if (decoded.type !== 'refresh') {
                return res.status(401).json({ error: 'Invalid token type' });
            }
        } catch (err) {
            logger.warn('Invalid refresh token', { error: err.message });
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        // Find session by refresh token
        const session = await GenesysUser.findSessionByRefreshToken(refreshToken);

        if (!session) {
            logger.warn('Session not found for refresh token', { userId: decoded.userId });
            return res.status(401).json({ error: 'Session not found or expired' });
        }

        // Generate new tokens
        const newAccessToken = jwt.sign(
            {
                userId: session.user_id,
                tenantId: session.tenant_id,
                role: session.role,
                type: 'access'
            },
            config.jwt.secret,
            { expiresIn: '1h' }
        );

        const newRefreshToken = jwt.sign(
            {
                userId: session.user_id,
                tenantId: session.tenant_id,
                type: 'refresh'
            },
            config.jwt.secret,
            { expiresIn: '7d' }
        );

        // Update session with new tokens
        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await GenesysUser.updateSession(session.session_id, newAccessToken, newRefreshToken, newExpiresAt);

        logger.info('Token refreshed successfully', { userId: session.user_id });

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: 3600 // 1 hour in seconds
        });
    } catch (error) {
        logger.error('Token refresh error', { error: error.message });
        next(error);
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
            // Decode token to get expiry
            const decoded = jwt.decode(token);
            const expirySeconds = decoded?.exp ? Math.max(0, decoded.exp - Math.floor(Date.now() / 1000)) : 3600;

            // Add token to blacklist
            await tokenBlacklist.addToken(token, expirySeconds);

            // Invalidate the current session in database
            await GenesysUser.invalidateSession(userId, token);

            logger.info('User logged out', { userId, tokenBlacklisted: true });
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

        // Get all active sessions for the user
        const sessions = await GenesysUser.getActiveSessions(userId);

        // Prepare tokens for blacklisting
        const tokensToBlacklist = sessions.map(session => {
            const decoded = jwt.decode(session.access_token);
            const expirySeconds = decoded?.exp ? Math.max(0, decoded.exp - Math.floor(Date.now() / 1000)) : 3600;

            return {
                token: session.access_token,
                expirySeconds
            };
        }).filter(t => t.token); // Filter out null tokens

        // Blacklist all tokens
        if (tokensToBlacklist.length > 0) {
            await tokenBlacklist.addTokens(tokensToBlacklist);
        }

        // Invalidate all sessions in database
        const count = await GenesysUser.invalidateAllSessions(userId);

        logger.info('All user sessions invalidated', {
            userId,
            sessionCount: count,
            tokensBlacklisted: tokensToBlacklist.length
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
        const user = req.user;

        // Get tenant's WhatsApp configuration
        const whatsappConfig = await GenesysUser.getTenantWhatsAppConfig(user.user_id);

        res.json({
            user_id: user.user_id,
            name: user.name,
            email: user.genesys_email,
            role: user.role,
            tenant_id: user.tenant_id,
            created_at: user.created_at,
            last_login_at: user.last_login_at,
            organization: {
                tenant_id: user.tenant_id,
                tenant_name: whatsappConfig?.tenant_name,
                whatsapp: whatsappConfig ? {
                    connected: true,
                    phone_number: whatsappConfig.display_phone_number,
                    waba_id: whatsappConfig.waba_id
                } : {
                    connected: false
                }
            }
        });
    } catch (error) {
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
        const demoUser = {
            id: 'demo-user-001',
            name: 'Demo Agent',
            email: 'demo@example.com',
            organization: { id: 'demo-org-001' }
        };

        // Find or create demo user
        const user = await GenesysUser.findOrCreateFromGenesys(demoUser, demoTenantId);
        logger.info('Demo user authenticated', {
            userId: user.user_id,
            tenantId: demoTenantId
        });

        // Update last login
        await GenesysUser.updateLastLogin(user.user_id);

        // Issue JWT tokens
        const accessToken = jwt.sign(
            {
                userId: user.user_id,
                tenantId: user.tenant_id,
                role: user.role,
                type: 'access'
            },
            config.jwt.secret,
            { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign(
            {
                userId: user.user_id,
                tenantId: user.tenant_id,
                type: 'refresh'
            },
            config.jwt.secret,
            { expiresIn: '7d' }
        );

        // Create session
        await GenesysUser.createSession({
            user_id: user.user_id,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            ip_address: req.ip,
            user_agent: req.get('user-agent')
        });

        logger.info('Demo login successful', { userId: user.user_id });

        // Fetch WhatsApp config for the tenant
        const whatsappConfig = await GenesysUser.getTenantWhatsAppConfig(user.user_id);

        res.json({
            accessToken,
            refreshToken,
            agent: {
                user_id: user.user_id,
                name: user.name,
                email: user.genesys_email,
                role: user.role,
                tenant_id: user.tenant_id
            },
            organization: {
                tenant_id: user.tenant_id,
                whatsapp: whatsappConfig ? {
                    connected: true,
                    phone_number: whatsappConfig.display_phone_number,
                    waba_id: whatsappConfig.waba_id
                } : {
                    connected: false
                }
            }
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
