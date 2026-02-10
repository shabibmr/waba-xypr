-- Create tenant_credentials table
CREATE TABLE IF NOT EXISTS tenant_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    credential_type VARCHAR(20) NOT NULL, -- 'genesys' or 'whatsapp'
    credentials JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_tenant_credentials_tenant_id ON tenant_credentials(tenant_id);
CREATE INDEX idx_tenant_credentials_type ON tenant_credentials(credential_type);
CREATE INDEX idx_tenant_credentials_tenant_type ON tenant_credentials(tenant_id, credential_type);

-- Create unique constraint for active credentials
CREATE UNIQUE INDEX idx_tenant_credentials_unique_active 
    ON tenant_credentials(tenant_id, credential_type) 
    WHERE is_active = true;

-- Create updated_at trigger
CREATE TRIGGER update_tenant_credentials_updated_at BEFORE UPDATE ON tenant_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
