-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone_number_id VARCHAR(50) UNIQUE,
    display_phone_number VARCHAR(20),
    genesys_integration_id VARCHAR(100) UNIQUE,
    genesys_org_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX idx_tenants_phone_number_id ON tenants(phone_number_id);
CREATE INDEX idx_tenants_genesys_integration_id ON tenants(genesys_integration_id);
CREATE INDEX idx_tenants_genesys_org_id ON tenants(genesys_org_id);
CREATE INDEX idx_tenants_status ON tenants(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
