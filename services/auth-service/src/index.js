// auth-service/server.js
const express = require('express');
const axios = require('axios');
const redis = require('redis');

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

// Get Genesys credentials for a tenant
async function getTenantGenesysCredentials(tenantId) {
  try {
    const response = await axios.get(
      `${TENANT_SERVICE_URL}/api/tenants/${tenantId}/genesys/credentials`
    );
    return {
      clientId: response.data.clientId,
      clientSecret: response.data.clientSecret,
      region: response.data.region
    };
  } catch (error) {
    console.error(`Failed to fetch Genesys credentials for tenant ${tenantId}:`, error.message);
    throw new Error(`Genesys credentials not configured for tenant ${tenantId}`);
  }
}

// Get valid OAuth token for a specific tenant (cached or new)
async function getValidToken(tenantId) {
  try {
    const tokenCacheKey = `genesys:oauth:token:${tenantId}`;

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

// Get token endpoint (tenant-aware)
app.get('/auth/token', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];

    if (!tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header required' });
    }

    const token = await getValidToken(tenantId);
    res.json({
      token,
      type: 'Bearer'
    });
  } catch (error) {
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

  // Redirect to Genesys login
  res.redirect(authUrl.toString());
});

// OAuth callback endpoint (receives authorization code)
app.get('/auth/genesys/callback', async (req, res) => {
  const { code, state, error } = req.query;

  // Handle OAuth error
  if (error) {
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
    return res.status(400).send('Invalid state parameter');
  }

  oauthStates.delete(state);

  try {
    const redirectUri = process.env.GENESYS_REDIRECT_URI || 'http://localhost:3006/auth/callback';

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

    // Get organization details
    const orgResponse = await axios.get(
      `https://api.${GENESYS_CONFIG.region}/api/v2/organizations/me`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    const org = orgResponse.data;

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
    console.error('OAuth callback error:', error.response?.data || error.message);
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
    // Clear cache
    await redisClient.del(TOKEN_CACHE_KEY);

    // Get new token
    const token = await getValidToken();

    res.json({
      token,
      type: 'Bearer',
      refreshed: true
    });
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
    const cachedToken = await redisClient.get(TOKEN_CACHE_KEY);

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
      redis: 'connected'
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