// tenant-service/src/index.js - Enhanced Tenant Management Service
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { Pool } = require('pg');
const redis = require('redis');
const crypto = require('crypto');
const axios = require('axios');

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

const app = express();
const PORT = process.env.PORT || 3007;

app.use(express.json());

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'whatsapp_genesys',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20
});

const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.connect();

// Initialize enhanced tenant schema
async function initDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
      -- Main tenants table with Genesys org fields
      CREATE TABLE IF NOT EXISTS tenants (
        tenant_id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subdomain VARCHAR(100) UNIQUE,
        status VARCHAR(20) DEFAULT 'active',
        plan VARCHAR(50) DEFAULT 'standard',
        rate_limit INTEGER DEFAULT 100,
        genesys_org_id VARCHAR(100),
        genesys_org_name VARCHAR(255),
        genesys_region VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      );

      -- Existing tenant_credentials table
      CREATE TABLE IF NOT EXISTS tenant_credentials (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        credential_type VARCHAR(50) NOT NULL,
        credentials JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- WhatsApp Business API configuration table
      CREATE TABLE IF NOT EXISTS tenant_whatsapp_config (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        waba_id VARCHAR(100) NOT NULL,
        phone_number_id VARCHAR(100) NOT NULL,
        access_token TEXT NOT NULL,
        business_id VARCHAR(100),
        display_phone_number VARCHAR(50),
        quality_rating VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id)
      );

      CREATE TABLE IF NOT EXISTS tenant_api_keys (
        api_key VARCHAR(100) PRIMARY KEY,
        tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tenant_status ON tenants(status);
      CREATE INDEX IF NOT EXISTS idx_tenant_subdomain ON tenants(subdomain);
      CREATE INDEX IF NOT EXISTS idx_tenant_waba ON tenant_whatsapp_config(tenant_id);

      -- Add tenant_id to existing tables if they don't have it
      ALTER TABLE conversation_mappings ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50);
      ALTER TABLE message_tracking ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50);
      
      CREATE INDEX IF NOT EXISTS idx_conv_tenant ON conversation_mappings(tenant_id, wa_id);
      CREATE INDEX IF NOT EXISTS idx_msg_tenant ON message_tracking(tenant_id, created_at);
    `);
        console.log('Enhanced tenant schema initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
    } finally {
        client.release();
    }
}

initDatabase();

// ============================================================
// Tenant Management Endpoints
// ============================================================

// Create new tenant
app.post('/tenants', async (req, res) => {
    const { tenantId, name, subdomain, plan, genesysOrgId, genesysOrgName, genesysRegion } = req.body;

    if (!tenantId || !name) {
        return res.status(400).json({ error: 'tenantId and name required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO tenants (tenant_id, name, subdomain, plan, genesys_org_id, genesys_org_name, genesys_region)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [tenantId, name, subdomain, plan || 'standard', genesysOrgId, genesysOrgName, genesysRegion]
        );

        const tenant = result.rows[0];

        // Generate API key
        const apiKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
        await pool.query(
            `INSERT INTO tenant_api_keys (api_key, tenant_id, name)
       VALUES ($1, $2, $3)`,
            [apiKey, tenantId, 'Default API Key']
        );

        // Cache tenant data
        await cacheTenantData(tenant);
        await redisClient.set(`apikey:${apiKey}`, tenantId);
        if (subdomain) {
            await redisClient.set(`subdomain:${subdomain}`, tenantId);
        }

        res.json({
            tenant,
            apiKey,
            message: 'Tenant created successfully'
        });
    } catch (error) {
        console.error('Tenant creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// List all tenants (no auth for admin dashboard)
app.get('/tenants', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM tenants ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get tenant details
app.get('/tenants/:tenantId', async (req, res) => {
    const { tenantId } = req.params;

    try {
        const result = await pool.query(
            'SELECT * FROM tenants WHERE tenant_id = $1',
            [tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// WhatsApp Business API Configuration
// ============================================================

// Store WhatsApp WABA credentials
app.post('/tenants/:tenantId/whatsapp', async (req, res) => {
    const { tenantId } = req.params;
    const { wabaId, phoneNumberId, accessToken, businessId, displayPhoneNumber, qualityRating } = req.body;

    if (!wabaId || !phoneNumberId || !accessToken) {
        return res.status(400).json({
            error: 'wabaId, phoneNumberId, and accessToken are required'
        });
    }

    try {
        // Check if config already exists
        const existing = await pool.query(
            'SELECT id FROM tenant_whatsapp_config WHERE tenant_id = $1',
            [tenantId]
        );

        let result;
        if (existing.rows.length > 0) {
            // Update existing
            result = await pool.query(
                `UPDATE tenant_whatsapp_config 
         SET waba_id = $1, phone_number_id = $2, access_token = $3, 
             business_id = $4, display_phone_number = $5, quality_rating = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $7
         RETURNING *`,
                [wabaId, phoneNumberId, accessToken, businessId, displayPhoneNumber, qualityRating, tenantId]
            );
        } else {
            // Insert new
            result = await pool.query(
                `INSERT INTO tenant_whatsapp_config 
         (tenant_id, waba_id, phone_number_id, access_token, business_id, display_phone_number, quality_rating)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
                [tenantId, wabaId, phoneNumberId, accessToken, businessId, displayPhoneNumber, qualityRating]
            );
        }

        // Invalidate cache
        await redisClient.del(`tenant:${tenantId}:whatsapp`);

        res.json({
            success: true,
            config: maskWhatsAppConfig(result.rows[0])
        });
    } catch (error) {
        console.error('WhatsApp config error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get WhatsApp configuration (masked for security)
app.get('/tenants/:tenantId/whatsapp', async (req, res) => {
    const { tenantId } = req.params;

    try {
        // Check cache
        const cached = await redisClient.get(`tenant:${tenantId}:whatsapp`);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const result = await pool.query(
            `SELECT * FROM tenant_whatsapp_config 
       WHERE tenant_id = $1 AND is_active = true`,
            [tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'WhatsApp config not found' });
        }

        const maskedConfig = maskWhatsAppConfig(result.rows[0]);

        // Cache for 1 hour
        await redisClient.setEx(
            `tenant:${tenantId}:whatsapp`,
            3600,
            JSON.stringify(maskedConfig)
        );

        res.json(maskedConfig);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Handle WhatsApp embedded signup callback
app.post('/api/whatsapp/signup', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Authorization code required' });
    }

    try {
        // Exchange code for access token
        const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
            params: {
                client_id: process.env.META_APP_ID,
                client_secret: process.env.META_APP_SECRET,
                code: code
            }
        });

        const { access_token } = tokenResponse.data;

        // Get WABA info from the access token
        const wabaResponse = await axios.get('https://graph.facebook.com/v18.0/debug_token', {
            params: {
                input_token: access_token,
                access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
            }
        });

        const wabaData = wabaResponse.data.data.granular_scopes.find(s =>
            s.scope === 'whatsapp_business_management'
        );

        // Get phone number details
        const phoneResponse = await axios.get(`https://graph.facebook.com/v18.0/${wabaData.target_ids[0]}`, {
            params: { access_token },
            headers: { 'Authorization': `Bearer ${access_token}` }
        });

        const phoneData = phoneResponse.data;

        res.json({
            wabaId: wabaData.target_ids[0],
            phoneNumberId: phoneData.id,
            displayPhoneNumber: phoneData.display_phone_number,
            qualityRating: phoneData.quality_rating,
            accessToken: access_token,
            businessId: phoneData.business_id || null
        });
    } catch (error) {
        console.error('WhatsApp signup error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to complete WhatsApp signup',
            details: error.response?.data?.error?.message
        });
    }
});

// ============================================================
// Credential Management
// ============================================================

// Store tenant credentials (Genesys, etc.)
app.post('/tenants/:tenantId/credentials', async (req, res) => {
    const { tenantId } = req.params;
    const { type, credentials } = req.body;

    if (!type || !credentials) {
        return res.status(400).json({ error: 'type and credentials required' });
    }

    try {
        // Deactivate old credentials of same type
        await pool.query(
            `UPDATE tenant_credentials 
       SET is_active = false 
       WHERE tenant_id = $1 AND credential_type = $2`,
            [tenantId, type]
        );

        // Insert new credentials
        const result = await pool.query(
            `INSERT INTO tenant_credentials (tenant_id, credential_type, credentials)
       VALUES ($1, $2, $3)
       RETURNING id`,
            [tenantId, type, JSON.stringify(credentials)]
        );

        // Invalidate cache
        await redisClient.del(`tenant:${tenantId}:credentials:${type}`);

        res.json({
            success: true,
            credentialId: result.rows[0].id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get tenant credentials
app.get('/tenants/:tenantId/credentials/:type', async (req, res) => {
    const { tenantId, type } = req.params;

    try {
        // Check cache
        const cached = await redisClient.get(`tenant:${tenantId}:credentials:${type}`);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        // Query database
        const result = await pool.query(
            `SELECT credentials 
       FROM tenant_credentials 
       WHERE tenant_id = $1 AND credential_type = $2 AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
            [tenantId, type]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Credentials not found' });
        }

        const credentials = result.rows[0].credentials;

        // Cache for 1 hour
        await redisClient.setEx(
            `tenant:${tenantId}:credentials:${type}`,
            3600,
            JSON.stringify(credentials)
        );

        res.json(credentials);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// Helper Functions
// ============================================================

// Mask sensitive WhatsApp data
function maskWhatsAppConfig(config) {
    return {
        wabaId: config.waba_id,
        phoneNumberId: config.phone_number_id,
        accessToken: maskToken(config.access_token),
        businessId: config.business_id,
        displayPhoneNumber: config.display_phone_number,
        qualityRating: config.quality_rating,
        isActive: config.is_active,
        createdAt: config.created_at
    };
}

function maskToken(token) {
    if (!token || token.length < 8) return '****';
    return `****${token.slice(-4)}`;
}

async function cacheTenantData(tenant) {
    const cacheData = {
        id: tenant.tenant_id,
        name: tenant.name,
        status: tenant.status,
        plan: tenant.plan,
        rateLimit: tenant.rate_limit
    };

    await redisClient.setEx(
        `tenant:${tenant.tenant_id}`,
        3600,
        JSON.stringify(cacheData)
    );
}

// Health check
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        await redisClient.ping();
        res.json({
            status: 'healthy',
            database: 'connected',
            redis: 'connected'
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Enhanced Tenant Service running on port ${PORT}`);
});
