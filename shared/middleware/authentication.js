// auth-service/server.js (UPDATED for Multi-Tenant)
const express = require('express');
const axios = require('axios');
const redis = require('redis');
const { tenantResolver } = require('../shared/middleware/tenant-resolver');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

// Apply tenant resolver
app.use(tenantResolver);

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.connect();

const TOKEN_EXPIRY_BUFFER = 300; // 5 minutes

// Get tenant-specific Genesys credentials
async function getTenantCredentials(tenantId) {
  try {
    // Fetch from tenant service
    const tenantServiceUrl = process.env.TENANT_SERVICE_URL || 'http://tenant-service:3007';
    const response = await axios.get(
      `${tenantServiceUrl}/tenants/${tenantId}/credentials/genesys`
    );
    
    return response.data;
  } catch (error) {
    console.error(`[${tenantId}] Failed to get credentials:`, error.message);
    throw new Error('Tenant credentials not found');
  }
}

// Get valid OAuth token for tenant
async function getValidToken(tenantId) {
  try {
    // Tenant-specific cache key
    const cacheKey = `tenant:${tenantId}:oauth:token`;
    const cachedToken = await redisClient.get(cacheKey);
    
    if (cachedToken) {
      const tokenData = JSON.parse(cachedToken);
      const now = Math.floor(Date.now() / 1000);
      
      if (tokenData.expiresAt > now + TOKEN_EXPIRY_BUFFER) {
        console.log(`[${tenantId}] Using cached token`);
        return tokenData.accessToken;
      }
    }

    // Get tenant-specific credentials
    const credentials = await getTenantCredentials(tenantId);
    
    if (!credentials.clientId || !credentials.clientSecret) {
      throw new Error('Invalid tenant credentials');
    }

    // Request new token
    console.log(`[${tenantId}] Requesting new token from Genesys`);
    const region = credentials.region || 'mypurecloud.com';
    const tokenUrl = `https://login.${region}/oauth/token`;
    
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
      cacheKey,
      expires_in - TOKEN_EXPIRY_BUFFER,
      JSON.stringify({
        accessToken: access_token,
        expiresAt
      })
    );

    console.log(`[${tenantId}] New token cached, expires at: ${new Date(expiresAt * 1000).toISOString()}`);
    return access_token;

  } catch (error) {
    console.error(`[${tenantId}] Token request error:`, error.response?.data || error.message);
    throw new Error('Failed to obtain OAuth token');
  }
}

// Get token endpoint (TENANT-AWARE)
app.get('/auth/token', async (req, res) => {
  const tenantId = req.tenant.id;
  
  try {
    const token = await getValidToken(tenantId);
    res.json({ 
      token,
      type: 'Bearer',
      tenantId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refresh token endpoint (TENANT-AWARE)
app.post('/auth/refresh', async (req, res) => {
  const tenantId = req.tenant.id;
  
  try {
    // Clear cache
    await redisClient.del(`tenant:${tenantId}:oauth:token`);
    
    // Get new token
    const token = await getValidToken(tenantId);
    
    res.json({ 
      token,
      type: 'Bearer',
      tenantId,
      refreshed: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate token endpoint (TENANT-AWARE)
app.post('/auth/validate', async (req, res) => {
  const { token } = req.body;
  const tenantId = req.tenant.id;

  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token required' });
  }

  try {
    // Get tenant credentials to determine region
    const credentials = await getTenantCredentials(tenantId);
    const region = credentials.region || 'mypurecloud.com';
    const testUrl = `https://api.${region}/api/v2/users/me`;
    
    await axios.get(testUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.json({ valid: true, tenantId });
  } catch (error) {
    res.json({ 
      valid: false,
      tenantId,
      error: error.response?.status === 401 ? 'Invalid token' : 'Validation failed'
    });
  }
});

// Get token info endpoint (TENANT-AWARE)
app.get('/auth/info', async (req, res) => {
  const tenantId = req.tenant.id;
  
  try {
    const cacheKey = `tenant:${tenantId}:oauth:token`;
    const cachedToken = await redisClient.get(cacheKey);
    
    if (!cachedToken) {
      return res.json({ 
        tenantId,
        cached: false,
        message: 'No token in cache'
      });
    }

    const tokenData = JSON.parse(cachedToken);
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = tokenData.expiresAt - now;

    res.json({
      tenantId,
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

// Batch token retrieval for multiple tenants (admin only)
app.post('/auth/tokens/batch', async (req, res) => {
  const { tenantIds } = req.body;
  
  if (!Array.isArray(tenantIds)) {
    return res.status(400).json({ error: 'tenantIds array required' });
  }

  try {
    const tokens = await Promise.all(
      tenantIds.map(async (tenantId) => {
        try {
          const token = await getValidToken(tenantId);
          return { tenantId, token, error: null };
        } catch (error) {
          return { tenantId, token: null, error: error.message };
        }
      })
    );

    res.json({ tokens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check (no tenant required)
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

app.listen(PORT, () => {
  console.log(`Multi-Tenant Auth Service running on port ${PORT}`);
});