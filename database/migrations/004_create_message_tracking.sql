-- Create message_tracking table
CREATE TABLE IF NOT EXISTS message_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapping_id UUID NOT NULL REFERENCES conversation_mappings(id) ON DELETE CASCADE,
    wamid VARCHAR(100),                        -- WhatsApp message ID (unique when present)
    genesys_message_id VARCHAR(100),
    direction VARCHAR(20) NOT NULL,            -- INBOUND | OUTBOUND
    status VARCHAR(20) NOT NULL,               -- queued | sent | delivered | read | received | processed | failed
    media_url TEXT,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB
);

-- Unique constraint on wamid (non-null only)
-- Required by: ON CONFLICT (wamid) DO NOTHING in trackMessage
CREATE UNIQUE INDEX idx_message_tracking_wamid
    ON message_tracking(wamid) WHERE wamid IS NOT NULL;

-- Indexes for lookups
CREATE INDEX idx_message_tracking_mapping_id
    ON message_tracking(mapping_id);

CREATE INDEX idx_message_tracking_genesys_message_id
    ON message_tracking(genesys_message_id);

CREATE INDEX idx_message_tracking_created_at
    ON message_tracking(created_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_message_tracking_updated_at
    BEFORE UPDATE ON message_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
