-- Corrected database schema for agent portal
-- Reflects multi-tenant architecture where agents belong to organizations

-- Genesys Users table (renamed from agents)
-- These are Genesys-licensed users (admins, supervisors, agents)
CREATE TABLE IF NOT EXISTS genesys_users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
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
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES genesys_users(user_id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Conversation assignments (which agent is handling which conversation)
CREATE TABLE IF NOT EXISTS conversation_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES genesys_users(user_id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'closed', 'transferred'
    UNIQUE(conversation_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_genesys_users_tenant ON genesys_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_genesys_users_genesys_id ON genesys_users(genesys_user_id);
CREATE INDEX IF NOT EXISTS idx_genesys_user_sessions_user ON genesys_user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_assignments_user ON conversation_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_assignments_tenant ON conversation_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_assignments_conversation ON conversation_assignments(conversation_id);

-- Migration: Drop old incorrect tables if they exist
DROP TABLE IF EXISTS agent_whatsapp_accounts;
DROP TABLE IF EXISTS agent_conversation_assignments;
DROP TABLE IF EXISTS agent_sessions;
DROP TABLE IF EXISTS agents;

-- Note: WhatsApp credentials are stored at tenant level in tenant_whatsapp_config table
-- All agents within an organization share the same WABA
