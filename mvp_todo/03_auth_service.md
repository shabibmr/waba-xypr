# 03 - Auth Service Updates

**Priority:** HIGH  
**Estimated Time:** 2-3 hours  
**Dependencies:** 00 (Infrastructure), 02 (Tenant Service)  
**Can Run in Parallel:** Yes (with 01)

---

## 🎯 Objective
Add WhatsApp token support to Auth Service, allowing services to request both Genesys and WhatsApp credentials with Redis caching.

---

## 🛡️ Guard Rails (Check Before Starting)

- [x] Infrastructure setup complete (Task 00)
- [x] Tenant Service updated with generic credentials endpoint (Task 02)
- [x] Redis is accessible
- [x] Auth Service exists at `/services/auth-service`
- [x] Current Genesys OAuth flow working

---

## 📍 Anchors (Where to Make Changes)

**Existing Files to Modify:**
- `/services/auth-service/src/index.js` - Add WhatsApp token logic

**Current Implementation:**
- Auth Service already has Genesys OAuth with Redis caching
- Need to add WhatsApp token retrieval and caching

---

## 📝 Step-by-Step Implementation

### Step 1: Update Token Endpoint to Support WhatsApp

**File:** `src/index.js` (modify existing `GET /auth/token` endpoint)

Find this section (around line 132):

```javascript
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
```

**Replace with:**

```javascript
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
```

### Step 2: Add WhatsApp Credentials Function

**File:** `src/index.js` (add after the `getTenantGenesysCredentials` function, around line 66)

```javascript
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
```

### Step 3: Add Refresh Endpoint for WhatsApp

**File:** `src/index.js` (update existing `/auth/refresh` endpoint, around line 344)

Find:

```javascript
// Refresh token endpoint (force new token)
app.post('/auth/refresh', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];

    if (!tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header required' });
    }

    // Clear cache
    await redisClient.del(KEYS.genesysToken(tenantId));

    // Get new token
    const token = await getValidToken(tenantId);

    res.json({
      token,
      type: 'Bearer',
      refreshed: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Replace with:**

```javascript
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
```

### Step 4: Update Health Check (Optional)

**File:** `src/index.js` (update health check to show both credential types)

```javascript
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
```

---

## ✅ Verification Steps

### 1. Start the Service

```bash
cd services/auth-service
npm run dev
```

### 2. Test Genesys Token (Existing Functionality)

```bash
curl -X GET http://localhost:3004/auth/token \
  -H "X-Tenant-ID: demo-tenant-001" \
  -H "X-Credential-Type: genesys"
```

Expected Response:
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "type": "Bearer"
}
```

### 3. Test WhatsApp Token (New Functionality)

```bash
curl -X GET http://localhost:3004/auth/token \
  -H "X-Tenant-ID: demo-tenant-001" \
  -H "X-Credential-Type: whatsapp"
```

Expected Response:
```json
{
  "token": "EAAxxxxxxxx",
  "phoneNumberId": "123456789",
  "type": "Bearer"
}
```

### 4. Test Default Behavior (Should Default to Genesys)

```bash
curl -X GET http://localhost:3004/auth/token \
  -H "X-Tenant-ID: demo-tenant-001"
```

Should return Genesys token.

### 5. Verify Redis Caching

```bash
# First request - should hit Tenant Service
curl -X GET http://localhost:3004/auth/token \
  -H "X-Tenant-ID: demo-tenant-001" \
  -H "X-Credential-Type: whatsapp"

# Check Redis
redis-cli get "tenant:demo-tenant-001:whatsapp:token"

# Second request - should hit cache (check logs)
curl -X GET http://localhost:3004/auth/token \
  -H "X-Tenant-ID: demo-tenant-001" \
  -H "X-Credential-Type: whatsapp"
```

### 6. Test Refresh Endpoint

```bash
# Refresh WhatsApp token
curl -X POST http://localhost:3004/auth/refresh \
  -H "X-Tenant-ID: demo-tenant-001" \
  -H "X-Credential-Type: whatsapp"
```

Expected Response:
```json
{
  "token": "EAAxxxxxxxx",
  "phoneNumberId": "123456789",
  "type": "Bearer",
  "refreshed": true
}
```

### 7. Test Health Check

```bash
curl -X GET http://localhost:3004/health
```

Expected Response:
```json
{
  "status": "healthy",
  "redis": "connected",
  "supportedCredentials": ["genesys", "whatsapp"]
}
```

---

## 🚨 Common Issues

### Issue 1: WhatsApp Credentials Not Found
**Solution:**
```bash
# Verify credentials exist in database
psql -d waba_mvp -c "SELECT * FROM tenant_credentials WHERE credential_type = 'whatsapp';"

# If missing, re-run seed data
psql -d waba_mvp -f database/seeds/001_demo_tenant.sql
```

### Issue 2: Tenant Service Not Responding
**Solution:**
```bash
# Check Tenant Service is running
curl http://localhost:3007/health

# If not running:
cd services/tenant-service
npm run dev
```

### Issue 3: Redis Cache Not Working
**Solution:**
```bash
# Clear Redis cache
redis-cli FLUSHDB

# Restart Auth Service
cd services/auth-service
npm run dev
```

---

## 📤 Deliverables

- [x] WhatsApp token retrieval with Redis caching (24h TTL)
- [x] Support for `X-Credential-Type` header (genesys/whatsapp)
- [x] Default to Genesys for backward compatibility
- [x] Refresh endpoint supports both credential types
- [x] Return `phoneNumberId` with WhatsApp tokens
- [x] All verification tests passing

---

## 🔗 Next Dependencies

Services that can now proceed:
- ✅ Task 06 - Genesys API Service (uses Genesys tokens)
- ✅ Task 09 - WhatsApp API Service (uses WhatsApp tokens)
- ✅ Task 08 - Outbound Transformer (downloads media from Genesys with token)
