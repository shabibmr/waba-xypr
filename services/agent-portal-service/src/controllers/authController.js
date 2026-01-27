const jwt = require('jsonwebtoken');
const axios = require('axios');
const { GenesysUser } = require('../models/Agent');
const config = require('../config');

/**
 * Initiate Genesys OAuth login
 */
async function initiateLogin(req, res) {
    const authorizeUrl = `https://login.${config.genesys.region}/oauth/authorize`;
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.genesys.clientId,
        redirect_uri: config.genesys.redirectUri
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
            return res.status(400).send('<script>window.opener.postMessage({type:"GENESYS_AUTH_ERROR",error:"No authorization code"}, "*");window.close();</script>');
        }

        // Exchange code for token
        const tokenResponse = await axios.post(
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

        const { access_token } = tokenResponse.data;

        // Get user info from Genesys
        const userResponse = await axios.get(
            `https://api.${config.genesys.region}/api/v2/users/me`,
            {
                headers: { Authorization: `Bearer ${access_token}` }
            }
        );

        const genesysUser = userResponse.data;
        const genesysOrgId = genesysUser.organization?.id;

        if (!genesysOrgId) {
            return res.status(400).send('<script>window.opener.postMessage({type:"GENESYS_AUTH_ERROR",error:"No organization found"}, "*");window.close();</script>');
        }

        // Find tenant by Genesys organization ID
        const tenantResponse = await axios.get(
            `${config.services.tenantService}/api/tenants/by-genesys-org/${genesysOrgId}`
        );

        if (tenantResponse.status === 404) {
            return res.status(400).send(`
        <script>
          window.opener.postMessage({
            type: 'GENESYS_AUTH_ERROR',
            error: 'Organization not found. Please contact your administrator to set up your organization first.'
          }, '*');
          window.close();
        </script>
      `);
        }

        const tenant = tenantResponse.data;

        // Find or create user (auto-provisioning)
        const user = await GenesysUser.findOrCreateFromGenesys(genesysUser, tenant.tenant_id);

        // Update last login
        await GenesysUser.updateLastLogin(user.user_id);

        // Issue JWT token
        const jwtToken = jwt.sign(
            {
                userId: user.user_id,
                tenantId: user.tenant_id,
                role: user.role
            },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        // Create session
        await GenesysUser.createSession({
            user_id: user.user_id,
            access_token: jwtToken,
            refresh_token: null,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            ip_address: req.ip,
            user_agent: req.get('user-agent')
        });

        // Send success message to parent window
        res.send(`
      <script>
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
        window.close();
      </script>
    `);
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.send(`
      <script>
        window.opener.postMessage({
          type: 'GENESYS_AUTH_ERROR',
          error: 'Authentication failed'
        }, '*');
        window.close();
      </script>
    `);
    }
}

/**
 * Logout user
 */
async function logout(req, res) {
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
