-- PostgreSQL Initialization Script
-- This script runs automatically when the database is first created

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)
-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Create basic tables for tenant management
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    whatsapp_phone_number_id VARCHAR(255),
    whatsapp_business_account_id VARCHAR(255),
    meta_access_token TEXT,
    genesys_client_id VARCHAR(255),
    genesys_client_secret TEXT,
    genesys_region VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create conversation state table
CREATE TABLE IF NOT EXISTS conversation_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    whatsapp_conversation_id VARCHAR(255) NOT NULL,
    genesys_conversation_id VARCHAR(255),
    customer_phone VARCHAR(50),
    agent_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, whatsapp_conversation_id)
);

-- Create message log table
CREATE TABLE IF NOT EXISTS message_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_state_id UUID REFERENCES conversation_states(id) ON DELETE CASCADE,
    direction VARCHAR(20) NOT NULL, -- 'inbound' or 'outbound'
    source VARCHAR(50) NOT NULL, -- 'whatsapp' or 'genesys'
    message_id VARCHAR(255),
    content TEXT,
    media_url TEXT,
    status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);
CREATE INDEX IF NOT EXISTS idx_conversation_states_tenant ON conversation_states(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_states_whatsapp ON conversation_states(whatsapp_conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_states_genesys ON conversation_states(genesys_conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_conversation ON message_logs(conversation_state_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_created ON message_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_states_updated_at BEFORE UPDATE ON conversation_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert a sample tenant for testing (optional)
INSERT INTO tenants (name, is_active) 
VALUES ('Default Tenant', true)
ON CONFLICT DO NOTHING;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'WhatsApp-Genesys database initialized successfully';
END $$;
