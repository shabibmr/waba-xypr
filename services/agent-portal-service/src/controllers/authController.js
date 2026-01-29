const jwt = require('jsonwebtoken');
const axios = require('axios');
const { GenesysUser } = require('../models/Agent');
const config = require('../config');
const logger = require('../utils/logger');

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

        // Issue JWT token
        logger.info('Signing JWT...');
        const jwtToken = jwt.sign(
            {
                userId: user.user_id,
                tenantId: user.tenant_id,
                role: user.role
            },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );
        logger.info('JWT signed.');

        // Create session
        logger.info('Creating session...');
        await GenesysUser.createSession({
            user_id: user.user_id,
            access_token: jwtToken,
            refresh_token: null,
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
              token: '${jwtToken}',
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
 * Logout user
 */
async function logout(req, res) {
    logger.info('User logged out', { userId: req.user?.user_id });
    // In a real implementation, we would invalidate the session
    res.json({ message: 'Logged out successfully' });
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

module.exports = {
    initiateLogin,
    handleCallback,
    logout,
    getProfile
};
