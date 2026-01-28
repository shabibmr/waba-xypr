-- PostgreSQL Initialization Script
-- Consolidated Schema for WhatsApp-Genesys Integration
-- This script serves as the single source of truth for the development database schema.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS public;

GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- ==========================================
-- Tenant Service Schema
-- Source: services/tenant-service/src/services/schemaService.js
-- ==========================================

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

CREATE TABLE IF NOT EXISTS tenant_credentials (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    credential_type VARCHAR(50) NOT NULL,
    credentials JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- ==========================================
-- State Manager Schema
-- Source: services/state-manager/src/utils/dbInit.js
-- ==========================================

CREATE TABLE IF NOT EXISTS conversation_mappings (
    id SERIAL PRIMARY KEY,
    wa_id VARCHAR(50) UNIQUE NOT NULL,
    conversation_id VARCHAR(100) UNIQUE NOT NULL,
    contact_name VARCHAR(255),
    phone_number_id VARCHAR(50),
    display_phone_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_wa_id ON conversation_mappings(wa_id);
CREATE INDEX IF NOT EXISTS idx_conversation_id ON conversation_mappings(conversation_id);

CREATE TABLE IF NOT EXISTS message_tracking (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(100) NOT NULL,
    meta_message_id VARCHAR(100),
    genesys_message_id VARCHAR(100),
    direction VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_meta_message ON message_tracking(meta_message_id);
CREATE INDEX IF NOT EXISTS idx_genesys_message ON message_tracking(genesys_message_id);

CREATE TABLE IF NOT EXISTS conversation_context (
    conversation_id VARCHAR(100) PRIMARY KEY,
    context JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Agent Portal Schema
-- Source: services/agent-portal-service/src/models/Agent.js (implied)
-- ==========================================

-- Genesys Users table (Admin/Supervisor/Agent)
CREATE TABLE IF NOT EXISTS genesys_users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    genesys_user_id VARCHAR(255) UNIQUE NOT NULL,
    genesys_email VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'agent', -- 'admin', 'supervisor', 'agent'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- User sessions
CREATE TABLE IF NOT EXISTS genesys_user_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES genesys_users(user_id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Conversation assignments
CREATE TABLE IF NOT EXISTS conversation_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES genesys_users(user_id) ON DELETE CASCADE,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'closed', 'transferred'
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_genesys_users_tenant ON genesys_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_genesys_users_genesys_id ON genesys_users(genesys_user_id);
CREATE INDEX IF NOT EXISTS idx_genesys_user_sessions_user ON genesys_user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_assignments_user ON conversation_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_assignments_tenant ON conversation_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_assignments_conversation ON conversation_assignments(conversation_id);

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Database schema initialized successfully';
END $$;
