# 02 - Tenant Service Updates

**Priority:** HIGH  
**Estimated Time:** 3-4 hours  
**Dependencies:** 00 (Infrastructure)  
**Can Run in Parallel:** Yes (with 01, 03)

---

## 🎯 Objective
Add generic credentials endpoint and tenant resolution by phone_number_id and genesys_integration_id with Redis caching.

---

## 🛡️ Guard Rails (Check Before Starting)

- [x] Infrastructure setup complete (Task 00)
- [x] PostgreSQL tables created (`tenants`, `tenant_credentials`)
- [x] Redis is accessible
- [x] Tenant Service exists at `/services/tenant-service`
- [x] Current endpoints working (Genesys-specific credentials)

---

## 📍 Anchors (Where to Make Changes)

**Existing Files to Modify:**
- `/services/tenant-service/src/routes/tenantRoutes.js` - Add new routes
- `/services/tenant-service/src/controllers/tenantController.js` - Add new methods
- `/services/tenant-service/src/services/tenantService.js` - Add credential logic

**New Files to Create:**
- `/services/tenant-service/src/services/cache.service.js` - Redis caching

---

## 📝 Step-by-Step Implementation

### Step 1: Create Cache Service

**File:** `src/services/cache.service.js`

```javascript
const redis = require('redis');

const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.connect().catch(console.error);

const CACHE_TTL = 3600; // 1 hour

class CacheService {
    async get(key) {
        try {
            const value = await redisClient.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    async set(key, value, ttl = CACHE_TTL) {
        try {
            await redisClient.setEx(key, ttl, JSON.stringify(value));
        } catch (error) {
            console.error('Cache set error:', error);
        }
    }

    async del(key) {
        try {
            await redisClient.del(key);
        } catch (error) {
            console.error('Cache delete error:', error);
        }
    }

    // Invalidate all tenant-related caches
    async invalidateTenant(tenantId) {
        const patterns = [
            `tenant:${tenantId}:*`,
            `phone:*`, // We don't know which phone_number_id, so clear all
            `integration:*` // Same for integration_id
        ];

        for (const pattern of patterns) {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        }
    }
}

module.exports = new CacheService();
```

### Step 2: Update Tenant Service

**File:** `src/services/tenantService.js` (add these methods)

```javascript
const pool = require('../config/database');
const cacheService = require('./cache.service');

class TenantService {
    // ... existing methods ...

    /**
     * Get tenant by phone_number_id with caching
     */
    async getTenantByPhoneNumberId(phoneNumberId) {
        // Check cache first
        const cacheKey = `phone:${phoneNumberId}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Query database
        const query = `
            SELECT id, name, phone_number_id, genesys_integration_id, status
            FROM tenants
            WHERE phone_number_id = $1 AND status = 'active'
            LIMIT 1
        `;
        
        const result = await pool.query(query, [phoneNumberId]);
        
        if (result.rows.length === 0) {
            return null;
        }

        const tenant = result.rows[0];
        
        // Cache the result
        await cacheService.set(cacheKey, tenant);
        
        return tenant;
    }

    /**
     * Get tenant by genesys_integration_id with caching
     */
    async getTenantByIntegrationId(integrationId) {
        // Check cache first
        const cacheKey = `integration:${integrationId}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Query database
        const query = `
            SELECT id, name, phone_number_id, genesys_integration_id, status
            FROM tenants
            WHERE genesys_integration_id = $1 AND status = 'active'
            LIMIT 1
        `;
        
        const result = await pool.query(query, [integrationId]);
        
        if (result.rows.length === 0) {
            return null;
        }

        const tenant = result.rows[0];
        
        // Cache the result
        await cacheService.set(cacheKey, tenant);
        
        return tenant;
    }

    /**
     * Get credentials by type (generic endpoint)
     */
    async getCredentials(tenantId, credentialType) {
        const query = `
            SELECT credentials
            FROM tenant_credentials
            WHERE tenant_id = $1 AND credential_type = $2 AND is_active = true
            LIMIT 1
        `;
        
        const result = await pool.query(query, [tenantId, credentialType]);
        
        if (result.rows.length === 0) {
            throw new Error(`${credentialType} credentials not found for tenant ${tenantId}`);
        }

        return result.rows[0].credentials;
    }

    /**
     * Set credentials by type (generic endpoint)
     */
    async setCredentials(tenantId, credentialType, credentials) {
        // Deactivate existing credentials of this type
        await pool.query(
            `UPDATE tenant_credentials 
             SET is_active = false 
             WHERE tenant_id = $1 AND credential_type = $2`,
            [tenantId, credentialType]
        );

        // Insert new credentials
        const query = `
            INSERT INTO tenant_credentials (tenant_id, credential_type, credentials, is_active)
            VALUES ($1, $2, $3, true)
            RETURNING id
        `;
        
        await pool.query(query, [tenantId, credentialType, credentials]);

        // Invalidate cache
        await cacheService.invalidateTenant(tenantId);
    }
}

module.exports = new TenantService();
```

### Step 3: Update Controller

**File:** `src/controllers/tenantController.js` (add these methods)

```javascript
const tenantService = require('../services/tenantService');

// ... existing methods ...

/**
 * Get tenant by phone_number_id
 * GET /api/tenants/by-phone/:phoneNumberId
 */
exports.getTenantByPhoneNumberId = async (req, res) => {
    try {
        const { phoneNumberId } = req.params;
        
        const tenant = await tenantService.getTenantByPhoneNumberId(phoneNumberId);
        
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        res.json(tenant);
    } catch (error) {
        console.error('Error getting tenant by phone_number_id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Get tenant by genesys_integration_id
 * GET /api/tenants/by-integration/:integrationId
 */
exports.getTenantByIntegrationId = async (req, res) => {
    try {
        const { integrationId } = req.params;
        
        const tenant = await tenantService.getTenantByIntegrationId(integrationId);
        
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        res.json(tenant);
    } catch (error) {
        console.error('Error getting tenant by integration_id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Get credentials by type (generic)
 * GET /api/tenants/:tenantId/credentials?type=whatsapp|genesys
 */
exports.getCredentials = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { type } = req.query;

        if (!type || !['whatsapp', 'genesys'].includes(type)) {
            return res.status(400).json({ error: 'Invalid credential type. Use whatsapp or genesys' });
        }

        const credentials = await tenantService.getCredentials(tenantId, type);

        // Mask sensitive fields for response
        const masked = { ...credentials };
        if (masked.clientSecret) {
            masked.clientSecret = '***' + masked.clientSecret.slice(-4);
        }
        if (masked.access_token) {
            masked.access_token = '***' + masked.access_token.slice(-4);
        }

        res.json(masked);
    } catch (error) {
        console.error('Error getting credentials:', error);
        res.status(404).json({ error: error.message });
    }
};

/**
 * Set credentials by type (generic)
 * PUT /api/tenants/:tenantId/credentials
 * Body: { type: 'whatsapp|genesys', credentials: {...} }
 */
exports.setCredentials = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { type, credentials } = req.body;

        if (!type || !['whatsapp', 'genesys'].includes(type)) {
            return res.status(400).json({ error: 'Invalid credential type' });
        }

        if (!credentials || typeof credentials !== 'object') {
            return res.status(400).json({ error: 'Credentials object required' });
        }

        await tenantService.setCredentials(tenantId, type, credentials);

        res.json({ message: 'Credentials updated successfully' });
    } catch (error) {
        console.error('Error setting credentials:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
```

### Step 4: Update Routes

**File:** `src/routes/tenantRoutes.js` (add these routes)

```javascript
const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');

// ... existing routes ...

// Tenant resolution routes
router.get('/by-phone/:phoneNumberId', tenantController.getTenantByPhoneNumberId);
router.get('/by-integration/:integrationId', tenantController.getTenantByIntegrationId);

// Generic credentials routes
router.get('/:tenantId/credentials', tenantController.getCredentials);
router.put('/:tenantId/credentials', tenantController.setCredentials);

module.exports = router;
```

### Step 5: Update Environment Variables

**File:** `.env.example`

```env
PORT=3007
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=waba_mvp
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_URL=redis://localhost:6379
```

---

## ✅ Verification Steps

### 1. Start the Service

```bash
cd services/tenant-service
npm install redis
npm run dev
```

### 2. Test Tenant Resolution by Phone Number

```bash
curl -X GET http://localhost:3007/api/tenants/by-phone/123456789
```

Expected Response:
```json
{
  "id": "demo-tenant-001",
  "name": "Demo Organization",
  "phone_number_id": "123456789",
  "status": "active"
}
```

### 3. Test Tenant Resolution by Integration ID

```bash
curl -X GET http://localhost:3007/api/tenants/by-integration/demo-integration-001
```

### 4. Test Generic Credentials Endpoint (WhatsApp)

```bash
curl -X GET "http://localhost:3007/api/tenants/demo-tenant-001/credentials?type=whatsapp"
```

Expected Response:
```json
{
  "access_token": "***4567",
  "phone_number_id": "123456789",
  "business_account_id": "YOUR_BUSINESS_ACCOUNT_ID"
}
```

### 5. Test Generic Credentials Endpoint (Genesys)

```bash
curl -X GET "http://localhost:3007/api/tenants/demo-tenant-001/credentials?type=genesys"
```

### 6. Test Setting Credentials

```bash
curl -X PUT http://localhost:3007/api/tenants/demo-tenant-001/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "type": "whatsapp",
    "credentials": {
      "access_token": "NEW_TOKEN",
      "phone_number_id": "123456789"
    }
  }'
```

### 7. Verify Redis Caching

```bash
# First request - should hit database
curl -X GET http://localhost:3007/api/tenants/by-phone/123456789

# Check Redis
redis-cli get "phone:123456789"

# Second request - should hit cache (check logs)
curl -X GET http://localhost:3007/api/tenants/by-phone/123456789
```

---

## 🚨 Common Issues

### Issue 1: Redis Connection Error
**Solution:**
```bash
redis-cli ping
# Should return PONG

# If not running:
docker-compose up -d redis
```

### Issue 2: Credentials Not Found
**Solution:**
```bash
# Check database
psql -d waba_mvp -c "SELECT * FROM tenant_credentials WHERE tenant_id = 'demo-tenant-001';"

# Re-run seed data if needed
psql -d waba_mvp -f database/seeds/001_demo_tenant.sql
```

### Issue 3: Cache Not Invalidating
**Solution:**
```bash
# Manually clear cache
redis-cli FLUSHDB

# Or clear specific keys
redis-cli DEL "phone:123456789"
```

---

## 📤 Deliverables

- [x] Generic credentials endpoint (`GET /tenants/:id/credentials?type=`)
- [x] Set credentials endpoint (`PUT /tenants/:id/credentials`)
- [x] Tenant resolution by phone_number_id
- [x] Tenant resolution by genesys_integration_id
- [x] Redis caching for all lookups
- [x] Cache invalidation on updates
- [x] All verification tests passing

---

## 🔗 Next Dependencies

Services that can now proceed:
- ✅ Task 03 - Auth Service (needs generic credentials endpoint)
- ✅ Task 04 - WhatsApp Webhook Service (needs phone_number_id resolution)
- ✅ Task 06 - Genesys API Service (needs credentials)
- ✅ Task 07 - Genesys Webhook Service (needs integration_id resolution)
- ✅ Task 09 - WhatsApp API Service (needs credentials)
