-- Create message_tracking table
CREATE TABLE IF NOT EXISTS message_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID,
    meta_message_id VARCHAR(100),
    genesys_message_id VARCHAR(100),
    direction VARCHAR(10) NOT NULL, -- 'inbound' or 'outbound'
    status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'document', 'video', 'audio'
    media_type VARCHAR(50), -- MIME type for media messages
    media_url TEXT, -- MinIO storage URL
    created_at TIMESTAMP DEFAULT NOW(),
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_message_tracking_tenant_id ON message_tracking(tenant_id);
CREATE INDEX idx_message_tracking_conversation_id ON message_tracking(conversation_id);
CREATE INDEX idx_message_tracking_meta_message_id ON message_tracking(meta_message_id);
CREATE INDEX idx_message_tracking_genesys_message_id ON message_tracking(genesys_message_id);
CREATE INDEX idx_message_tracking_direction ON message_tracking(direction);
CREATE INDEX idx_message_tracking_created_at ON message_tracking(created_at DESC);

-- Create updated_at trigger
CREATE TRIGGER update_message_tracking_updated_at BEFORE UPDATE ON message_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
