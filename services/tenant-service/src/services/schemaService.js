const pool = require('../config/database');

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
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'conversation_mappings') THEN
          ALTER TABLE conversation_mappings ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50);
          CREATE INDEX IF NOT EXISTS idx_conv_tenant ON conversation_mappings(tenant_id, wa_id);
        END IF;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'message_tracking') THEN
          ALTER TABLE message_tracking ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50);
          CREATE INDEX IF NOT EXISTS idx_msg_tenant ON message_tracking(tenant_id, created_at);
        END IF;
      END $$;
    `);
        console.log('Enhanced tenant schema initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
    } finally {
        client.release();
    }
}

module.exports = { initDatabase };
