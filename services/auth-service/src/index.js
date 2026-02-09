// auth-service/server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const redis = require('redis');
const { KEYS } = require('../../../shared/constants');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

// Redis client for token caching
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.connect();

// Token cache configuration
const TOKEN_EXPIRY_BUFFER = 300; // 5 minutes buffer before expiry

// Tenant Service URL
const TENANT_SERVICE_URL = process.env.TENANT_SERVICE_URL || 'http://tenant-service:3007';

// Genesys OAuth Configuration
const GENESYS_CONFIG = {
  clientId: process.env.GENESYS_CLIENT_ID,
  clientSecret: process.env.GENESYS_CLIENT_SECRET,
  region: process.env.GENESYS_REGION || 'mypurecloud.com',
  tokenUrl: `https://login.${process.env.GENESYS_REGION || 'mypurecloud.com'}/oauth/token`
};

console.log('Auth Service Configuration:', {
  region: GENESYS_CONFIG.region,
  clientId: GENESYS_CONFIG.clientId ? `${GENESYS_CONFIG.clientId.substring(0, 8)}...` : 'NOT_SET',
  clientSecret: GENESYS_CONFIG.clientSecret ? '***' + GENESYS_CONFIG.clientSecret.slice(-4) : 'NOT_SET',
  tenantServiceUrl: TENANT_SERVICE_URL
});

// Get Genesys credentials for a tenant
async function getTenantGenesysCredentials(tenantId) {
  try {
    console.log(`Fetching Genesys credentials for tenant ${tenantId}`, {
      url: `${TENANT_SERVICE_URL}/api/tenants/${tenantId}/genesys/credentials`
    });
    const response = await axios.get(
      `${TENANT_SERVICE_URL}/api/tenants/${tenantId}/genesys/credentials`
    );
    console.log(`Credentials retrieved for tenant ${tenantId}`, {
      hasClientId: !!response.data.clientId,
      hasClientSecret: !!response.data.clientSecret,
      region: response.data.region
    });
    return {
      clientId: response.data.clientId,
      clientSecret: response.data.clientSecret,
      region: response.data.region
    };
  } catch (error) {
    console.error(`Failed to fetch Genesys credentials for tenant ${tenantId}:`, {
      error: error.message,
      status: error.response?.status,
      url: `${TENANT_SERVICE_URL}/api/tenants/${tenantId}/genesys/credentials`
    });
    throw new Error(`Genesys credentials not configured for tenant ${tenantId}`);
  }
}

// Get WhatsApp credentials for a tenant (with caching)
async function getWhatsAppCredentials(tenantId) {
  try {
    const tokenCacheKey = `tenant:${tenantId}:whatsapp:token`;

    // Check cache first
    const cachedToken = await redisClient.get(tokenCacheKey);

    if (cachedToken) {
      const tokenData = JSON.parse(cachedToken);
      console.log(`Using cached WhatsApp token for tenant ${tenantId}`);
      return tokenData;
    }

    // Fetch from Tenant Service
    console.log(`Fetching WhatsApp credentials for tenant ${tenantId}`);
    const response = await axios.get(
      `${TENANT_SERVICE_URL}/api/tenants/${tenantId}/credentials?type=whatsapp`
    );

    const credentials = {
      access_token: response.data.access_token,
      phone_number_id: response.data.phone_number_id,
      business_account_id: response.data.business_account_id
    };

    // Cache for 24 hours (WhatsApp tokens are long-lived)
    const WHATSAPP_TOKEN_TTL = 24 * 60 * 60; // 24 hours
    await redisClient.setEx(
      tokenCacheKey,
      WHATSAPP_TOKEN_TTL,
      JSON.stringify(credentials)
    );

    console.log(`WhatsApp token cached for tenant ${tenantId} (24h TTL)`);
    return credentials;

  } catch (error) {
    console.error(`Failed to fetch WhatsApp credentials for tenant ${tenantId}:`, {
      error: error.message,
      status: error.response?.status
    });
    throw new Error(`WhatsApp credentials not configured for tenant ${tenantId}`);
  }
}

// Get valid OAuth token for a specific tenant (cached or new)
async function getValidToken(tenantId) {
  try {
    const tokenCacheKey = KEYS.genesysToken(tenantId);

    // Check cache first
    const cachedToken = await redisClient.get(tokenCacheKey);

    if (cachedToken) {
      const tokenData = JSON.parse(cachedToken);
      const now = Math.floor(Date.now() / 1000);

      // Return cached token if still valid
      if (tokenData.expiresAt > now + TOKEN_EXPIRY_BUFFER) {
        console.log(`Using cached token for tenant ${tenantId}`);
        return tokenData.accessToken;
      }
    }

    // Get tenant-specific credentials
    const credentials = await getTenantGenesysCredentials(tenantId);
    const tokenUrl = `https://login.${credentials.region}/oauth/token`;

    // Request new token
    console.log(`Requesting new token from Genesys for tenant ${tenantId}`);
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'client_credentials'
      }).toString(),
      {
        auth: {
          username: credentials.clientId,
          password: credentials.clientSecret
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, expires_in } = response.data;
    const expiresAt = Math.floor(Date.now() / 1000) + expires_in;

    // Cache the token
    await redisClient.setEx(
      tokenCacheKey,
      expires_in - TOKEN_EXPIRY_BUFFER,
      JSON.stringify({
        accessToken: access_token,
        expiresAt
      })
    );

    console.log(`New token cached for tenant ${tenantId}, expires at: ${new Date(expiresAt * 1000).toISOString()}`);
    return access_token;

  } catch (error) {
    console.error(`Token request error for tenant ${tenantId}:`, error.response?.data || error.message);
    throw new Error(`Failed to obtain OAuth token for tenant ${tenantId}`);
  }
}

// Get token endpoint (tenant-aware, supports Genesys and WhatsApp)
app.get('/auth/token', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const credentialType = req.headers['x-credential-type'] || 'genesys'; // Default to Genesys

    if (!tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header required' });
    }

    if (!['genesys', 'whatsapp'].includes(credentialType)) {
      return res.status(400).json({ error: 'Invalid credential type. Use genesys or whatsapp' });
    }

    // Route to appropriate token handler
    if (credentialType === 'genesys') {
      const token = await getValidToken(tenantId);
      res.json({
        token,
        type: 'Bearer'
      });
    } else {
      const whatsappCreds = await getWhatsAppCredentials(tenantId);
      res.json({
        token: whatsappCreds.access_token,
        phoneNumberId: whatsappCreds.phone_number_id,
        type: 'Bearer'
      });
    }
  } catch (error) {
    console.error('Token request error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// OAuth Authorization Code Flow (for User Authentication)
// ============================================================

const crypto = require('crypto');

// Store OAuth states temporarily
const oauthStates = new Map();

// Initiate OAuth authorization (redirect to Genesys login)
app.get('/auth/genesys/authorize', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  const redirectUri = process.env.GENESYS_REDIRECT_URI || 'http://localhost:3006/auth/callback';

  console.log('Initiating OAuth authorization', {
    state: state.substring(0, 8) + '...',
    redirectUri,
    region: GENESYS_CONFIG.region,
    clientId: GENESYS_CONFIG.clientId ? `${GENESYS_CONFIG.clientId.substring(0, 8)}...` : 'NOT_SET'
  });

  // Store state for validation
  oauthStates.set(state, { timestamp: Date.now() });

  // Clean up old states (older than 10 minutes)
  for (const [key, value] of oauthStates.entries()) {
    if (Date.now() - value.timestamp > 600000) {
      oauthStates.delete(key);
    }
  }

  const authUrl = new URL(`https://login.${GENESYS_CONFIG.region}/oauth/authorize`);
  authUrl.searchParams.append('client_id', GENESYS_CONFIG.clientId);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('state', state);

  console.log('Redirecting to Genesys login', {
    url: authUrl.toString().replace(GENESYS_CONFIG.clientId, `${GENESYS_CONFIG.clientId.substring(0, 8)}...`)
  });

  // Redirect to Genesys login
  res.redirect(authUrl.toString());
});

// OAuth callback endpoint (receives authorization code)
app.get('/auth/genesys/callback', async (req, res) => {
  const { code, state, error } = req.query;

  console.log('OAuth callback received', {
    hasCode: !!code,
    codeLength: code?.length,
    hasState: !!state,
    hasError: !!error,
    error: error || 'none'
  });

  // Handle OAuth error
  if (error) {
    console.error('OAuth callback error from Genesys', { error });
    return res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({
              type: 'genesys-oauth-error',
              error: '${error}'
            }, window.location.origin);
            window.close();
          </script>
        </body>
      </html>
    `);
  }

  // Validate state
  if (!state || !oauthStates.has(state)) {
    console.error('Invalid state parameter', {
      hasState: !!state,
      stateExists: state ? oauthStates.has(state) : false
    });
    return res.status(400).send('Invalid state parameter');
  }

  console.log('State validated successfully');
  oauthStates.delete(state);

  try {
    const redirectUri = process.env.GENESYS_REDIRECT_URI || 'http://localhost:3006/auth/callback';

    console.log('Exchanging authorization code for access token', {
      tokenUrl: GENESYS_CONFIG.tokenUrl,
      redirectUri,
      codeLength: code.length,
      grantType: 'authorization_code'
    });

    // Exchange code for access token
    const tokenResponse = await axios.post(
      GENESYS_CONFIG.tokenUrl,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      }).toString(),
      {
        auth: {
          username: GENESYS_CONFIG.clientId,
          password: GENESYS_CONFIG.clientSecret
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;
    console.log('Token exchange successful', {
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token
    });

    // Get organization details
    console.log('Fetching organization details', {
      url: `https://api.${GENESYS_CONFIG.region}/api/v2/organizations/me`
    });
    const orgResponse = await axios.get(
      `https://api.${GENESYS_CONFIG.region}/api/v2/organizations/me`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    const org = orgResponse.data;
    console.log('Organization details retrieved', {
      orgId: org.id,
      orgName: org.name,
      domain: org.domain
    });

    const orgDetails = {
      orgId: org.id,
      name: org.name,
      region: GENESYS_CONFIG.region,
      domain: org.domain,
      accessToken: access_token,
      refreshToken: refresh_token,
      clientId: GENESYS_CONFIG.clientId,
      clientSecret: GENESYS_CONFIG.clientSecret
    };

    // Send success message to parent window
    res.send(`
      <html>
        <body>
          <h2>Authentication Successful!</h2>
          <p>You can close this window now.</p>
          <script>
            window.opener.postMessage({
              type: 'genesys-oauth-success',
              orgDetails: ${JSON.stringify(orgDetails)}
            }, window.location.origin);
            setTimeout(() => window.close(), 1000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', {
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      stack: error.stack
    });
    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({
              type: 'genesys-oauth-error',
              error: 'Failed to exchange authorization code'
            }, window.location.origin);
            window.close();
          </script>
        </body>
      </html>
    `);
  }
});

// Refresh token endpoint (force new token)
app.post('/auth/refresh', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const credentialType = req.headers['x-credential-type'] || 'genesys';

    if (!tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header required' });
    }

    if (credentialType === 'genesys') {
      // Clear Genesys cache
      await redisClient.del(KEYS.genesysToken(tenantId));

      // Get new token
      const token = await getValidToken(tenantId);

      res.json({
        token,
        type: 'Bearer',
        refreshed: true
      });
    } else {
      // Clear WhatsApp cache
      await redisClient.del(`tenant:${tenantId}:whatsapp:token`);

      // Get new credentials
      const whatsappCreds = await getWhatsAppCredentials(tenantId);

      res.json({
        token: whatsappCreds.access_token,
        phoneNumberId: whatsappCreds.phone_number_id,
        type: 'Bearer',
        refreshed: true
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate token endpoint
app.post('/auth/validate', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token required' });
  }

  try {
    // Test token by making a simple API call
    const testUrl = `https://api.${GENESYS_CONFIG.region}/api/v2/users/me`;

    await axios.get(testUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.json({ valid: true });
  } catch (error) {
    res.json({
      valid: false,
      error: error.response?.status === 401 ? 'Invalid token' : 'Validation failed'
    });
  }
});

// Get token info endpoint
app.get('/auth/info', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];

    if (!tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header required' });
    }

    const cachedToken = await redisClient.get(KEYS.genesysToken(tenantId));

    if (!cachedToken) {
      return res.json({
        cached: false,
        message: 'No token in cache'
      });
    }

    const tokenData = JSON.parse(cachedToken);
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = tokenData.expiresAt - now;

    res.json({
      cached: true,
      expiresAt: new Date(tokenData.expiresAt * 1000).toISOString(),
      timeRemaining,
      timeRemainingMinutes: Math.floor(timeRemaining / 60),
      isValid: timeRemaining > TOKEN_EXPIRY_BUFFER
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await redisClient.ping();
    res.json({
      status: 'healthy',
      redis: 'connected',
      supportedCredentials: ['genesys', 'whatsapp']
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      redis: 'disconnected',
      error: error.message
    });
  }
});

// Middleware to validate required env vars
function validateConfig() {
  const required = ['GENESYS_CLIENT_ID', 'GENESYS_CLIENT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
}

validateConfig();

app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
  console.log(`Genesys region: ${GENESYS_CONFIG.region}`);
});