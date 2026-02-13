-- Create conversation_mappings table
CREATE TABLE IF NOT EXISTS conversation_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_id VARCHAR(20) NOT NULL,
    conversation_id VARCHAR(100),              -- NULL until Genesys correlates
    communication_id VARCHAR(100),             -- NULL until Genesys correlates
    last_message_id VARCHAR(100),              -- wamid of last message
    contact_name VARCHAR(255),
    phone_number_id VARCHAR(50),
    display_phone_number VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | closed | expired
    last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB
);

-- Partial unique index: one active mapping per wa_id
-- Required by: ON CONFLICT (wa_id) WHERE status = 'active' in createMappingForInbound
CREATE UNIQUE INDEX idx_conversation_mappings_active_wa_id
    ON conversation_mappings(wa_id) WHERE status = 'active';

-- Index for outbound resolution: conversation_id lookup
CREATE INDEX idx_conversation_mappings_conversation_id
    ON conversation_mappings(conversation_id);

-- Index for expiry job: find stale active mappings
CREATE INDEX idx_conversation_mappings_status_activity
    ON conversation_mappings(status, last_activity_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_conversation_mappings_updated_at
    BEFORE UPDATE ON conversation_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
