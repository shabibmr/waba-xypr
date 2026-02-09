-- Create conversation_mappings table
CREATE TABLE IF NOT EXISTS conversation_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    wa_id VARCHAR(20) NOT NULL,
    conversation_id UUID NOT NULL,
    contact_name VARCHAR(255),
    phone_number_id VARCHAR(50),
    display_phone_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW()
);

-- Create unique constraints
CREATE UNIQUE INDEX idx_conversation_mappings_wa_id 
    ON conversation_mappings(tenant_id, wa_id);
CREATE UNIQUE INDEX idx_conversation_mappings_conversation_id 
    ON conversation_mappings(tenant_id, conversation_id);

-- Create indexes for fast lookups
CREATE INDEX idx_conversation_mappings_tenant_id ON conversation_mappings(tenant_id);
CREATE INDEX idx_conversation_mappings_last_activity ON conversation_mappings(last_activity_at DESC);
