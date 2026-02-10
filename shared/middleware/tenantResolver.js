// shared/middleware/tenant-resolver.js
// Add this middleware to API Gateway and all services

const redis = require('redis');
const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect();

/**
 * Tenant Resolution Strategies:
 * 1. Subdomain: acme.yourdomain.com → tenant_id: "acme"
 * 2. API Key: X-API-Key header contains tenant info
 * 3. JWT Token: Contains tenant_id claim
 */

async function resolveTenantFromSubdomain(req) {
  const host = req.headers.host || req.hostname;
  const subdomain = host.split('.')[0];

  // Check if subdomain maps to a tenant
  const tenantId = await redisClient.get(`subdomain:${subdomain}`);
  return tenantId;
}

async function resolveTenantFromApiKey(req) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return null;

  // Lookup tenant by API key
  const tenantId = await redisClient.get(`apikey:${apiKey}`);
  return tenantId;
}

async function resolveTenantFromJWT(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  try {
    // Decode JWT (use proper JWT library in production)
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return decoded.tenant_id;
  } catch (error) {
    return null;
  }
}

async function validateTenant(tenantId) {
  if (!tenantId) return { valid: false, error: 'Tenant ID required' };

  // Check tenant status
  const tenantData = await redisClient.get(`tenant:${tenantId}:config`);
  if (!tenantData) {
    return { valid: false, error: 'Tenant not found' };
  }

  const tenant = JSON.parse(tenantData);
  if (tenant.status !== 'active') {
    return { valid: false, error: 'Tenant inactive' };
  }

  return { valid: true, tenant };
}

// Main middleware
async function tenantResolver(req, res, next) {
  try {
    // Try all resolution strategies (X-Tenant-ID first for internal service-to-service calls)
    let tenantId = req.headers['x-tenant-id'] ||
      await resolveTenantFromApiKey(req) ||
      await resolveTenantFromJWT(req) ||
      await resolveTenantFromSubdomain(req);

    if (!tenantId) {
      return res.status(401).json({
        error: 'Tenant identification required',
        message: 'Provide tenant via X-API-Key, JWT, or subdomain'
      });
    }

    // Validate tenant
    const validation = await validateTenant(tenantId);
    if (!validation.valid) {
      return res.status(403).json({ error: validation.error });
    }

    // Attach tenant context to request
    req.tenant = {
      id: tenantId,
      ...validation.tenant
    };

    // Add to headers for downstream services
    req.headers['x-tenant-id'] = tenantId;

    next();
  } catch (error) {
    console.error('Tenant resolution error:', error);
    res.status(500).json({ error: 'Tenant resolution failed' });
  }
}

// Rate limiting per tenant
const tenantRateLimiter = async (req, res, next) => {
  const tenantId = req.tenant?.id;
  if (!tenantId) return next();

  const key = `ratelimit:${tenantId}:${Math.floor(Date.now() / 60000)}`;
  const current = await redisClient.incr(key);

  if (current === 1) {
    await redisClient.expire(key, 60);
  }

  // Get tenant's rate limit
  const limit = req.tenant.rateLimit || 100; // requests per minute

  if (current > limit) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      limit,
      retryAfter: 60
    });
  }

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));

  next();
};

module.exports = { tenantResolver, tenantRateLimiter };
