// Test fixtures for tenant service

const mockTenant = {
    id: 1,
    tenant_id: 'test-tenant-001',
    name: 'Test Tenant',
    subdomain: 'test',
    plan: 'enterprise',
    genesys_org_id: 'org-123',
    genesys_org_name: 'Test Organization',
    genesys_region: 'us-east-1',
    api_key: 'test-api-key-12345',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
};

const mockTenants = [
    mockTenant,
    {
        id: 2,
        tenant_id: 'test-tenant-002',
        name: 'Another Tenant',
        subdomain: 'another',
        plan: 'professional',
        genesys_org_id: 'org-456',
        genesys_org_name: 'Another Organization',
        genesys_region: 'eu-west-1',
        api_key: 'test-api-key-67890',
        is_active: true,
        created_at: '2024-01-02T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z'
    }
];

const mockWhatsAppConfig = {
    id: 1,
    tenant_id: 'test-tenant-001',
    waba_id: '123456789',
    phone_number_id: '987654321',
    access_token: 'test-access-token',
    business_id: 'business-123',
    display_phone_number: '+1234567890',
    quality_rating: 'GREEN',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
};

const mockCredential = {
    id: 1,
    tenant_id: 'test-tenant-001',
    credential_type: 'genesys_oauth',
    encrypted_value: 'encrypted-credential-data',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
};

const mockApiKey = 'sk_test_1234567890abcdef';

module.exports = {
    mockTenant,
    mockTenants,
    mockWhatsAppConfig,
    mockCredential,
    mockApiKey
};
