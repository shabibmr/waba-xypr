const pool = require('../config/database');

// Initialize enhanced tenant schema
async function initDatabase() {
  const client = await pool.connect();
  try {
    // Create tables
    await client.query(`
      -- Main tenants table with Genesys org fields
      CREATE TABLE IF NOT EXISTS tenants (
        tenant_id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        domain VARCHAR(255),
        subdomain VARCHAR(100) UNIQUE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
        plan VARCHAR(50) DEFAULT 'standard',
        rate_limit INTEGER DEFAULT 100,
        phone_number_id VARCHAR(100) UNIQUE,
        genesys_integration_id VARCHAR(100) UNIQUE,
        genesys_org_id VARCHAR(100),
        genesys_org_name VARCHAR(255),
        genesys_region VARCHAR(100),
        onboarding_completed BOOLEAN DEFAULT false,
        onboarding_completed_at TIMESTAMP,
        whatsapp_configured BOOLEAN DEFAULT false,
        settings JSONB,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        business_account_id VARCHAR(100),
        display_phone_number VARCHAR(50),
        verify_token VARCHAR(255),
        quality_rating VARCHAR(50),
        configured BOOLEAN DEFAULT true,
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
    `);

    // Migrate existing tables: add new columns if they don't exist (idempotent)
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email VARCHAR(255);
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain VARCHAR(255);
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone_number_id VARCHAR(100);
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS genesys_integration_id VARCHAR(100);
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings JSONB;
    `);

    // Add unique constraints separately (cannot use ADD COLUMN IF NOT EXISTS with UNIQUE inline for existing tables)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'tenants_phone_number_id_key'
        ) THEN
          ALTER TABLE tenants ADD CONSTRAINT tenants_phone_number_id_key UNIQUE (phone_number_id);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'tenants_genesys_integration_id_key'
        ) THEN
          ALTER TABLE tenants ADD CONSTRAINT tenants_genesys_integration_id_key UNIQUE (genesys_integration_id);
        END IF;
      END
      $$;
    `);

    // Migrate tenant_whatsapp_config: add new columns if missing
    await client.query(`
      ALTER TABLE tenant_whatsapp_config ADD COLUMN IF NOT EXISTS business_account_id VARCHAR(100);
      ALTER TABLE tenant_whatsapp_config ADD COLUMN IF NOT EXISTS verify_token VARCHAR(255);
      ALTER TABLE tenant_whatsapp_config ADD COLUMN IF NOT EXISTS configured BOOLEAN DEFAULT true;
    `);

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_status ON tenants(status);
      CREATE INDEX IF NOT EXISTS idx_tenant_subdomain ON tenants(subdomain);
      CREATE INDEX IF NOT EXISTS idx_tenant_phone_number_id ON tenants(phone_number_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_genesys_integration_id ON tenants(genesys_integration_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_waba ON tenant_whatsapp_config(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_creds_tenant_type
        ON tenant_credentials(tenant_id, credential_type);
    `);

    // updated_at trigger
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_tenants_updated_at'
        ) THEN
          CREATE TRIGGER update_tenants_updated_at
            BEFORE UPDATE ON tenants
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END
      $$;
    `);

    console.log('Enhanced tenant schema initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  } finally {
    client.release();
  }
}

module.exports = { initDatabase };
