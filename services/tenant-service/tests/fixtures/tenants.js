'use strict';

/**
 * DB row as returned by PostgreSQL (snake_case).
 * Matches the current schema after MVP-critical-path migrations.
 */
const dbTenantRow = {
    tenant_id: 't_abc123def456abc1',
    name: 'Acme Corp',
    email: 'admin@acme.com',
    domain: 'acme.com',
    subdomain: 'acme',
    status: 'active',
    plan: 'standard',
    rate_limit: 100,
    phone_number_id: null,
    genesys_integration_id: null,
    genesys_org_id: null,
    genesys_org_name: null,
    genesys_region: null,
    settings: null,
    metadata: null,
    onboarding_completed: false,
    onboarding_completed_at: null,
    whatsapp_configured: false,
    created_at: new Date('2026-02-12T10:00:00.000Z'),
    updated_at: new Date('2026-02-12T10:00:00.000Z'),
};

/**
 * formatTenant() output (camelCase) for the row above.
 */
const formattedTenant = {
    id: 't_abc123def456abc1',
    name: 'Acme Corp',
    email: 'admin@acme.com',
    domain: 'acme.com',
    subdomain: 'acme',
    status: 'active',
    plan: 'standard',
    rateLimit: 100,
    phoneNumberId: null,
    genesysIntegrationId: null,
    genesysOrgId: null,
    genesysOrgName: null,
    genesysRegion: null,
    settings: null,
    onboardingCompleted: false,
    whatsappConfigured: false,
    createdAt: new Date('2026-02-12T10:00:00.000Z'),
    updatedAt: new Date('2026-02-12T10:00:00.000Z'),
};

/** DB row for a Genesys credential record. */
const dbCredentialRow = {
    id: 1,
    tenant_id: 't_abc123def456abc1',
    credential_type: 'genesys',
    credentials: {
        clientId: 'client-123',
        clientSecret: 'secret-abcxyz',
        region: 'mypurecloud.com',
        integrationId: 'intg-001',
    },
    is_active: true,
    created_at: new Date('2026-02-12T10:00:00.000Z'),
    updated_at: new Date('2026-02-12T10:00:00.000Z'),
};

/** DB row for tenant_whatsapp_config. */
const dbWhatsAppConfigRow = {
    id: 1,
    tenant_id: 't_abc123def456abc1',
    waba_id: 'waba-789',
    phone_number_id: '15550001234',
    access_token: 'EAABtokenxyz1234',
    business_id: 'biz-001',
    business_account_id: 'waba-789',
    display_phone_number: '+1 555-000-1234',
    quality_rating: 'GREEN',
    configured: true,
    is_active: true,
    created_at: new Date('2026-02-12T10:00:00.000Z'),
    updated_at: new Date('2026-02-12T10:00:00.000Z'),
};

// ── Legacy shape kept for backward compat with old tests ──────────────────────
const mockTenant = { ...dbTenantRow };
const mockTenants = [
    mockTenant,
    { ...dbTenantRow, tenant_id: 'test-tenant-002', name: 'Another Tenant' },
];
const mockWhatsAppConfig = dbWhatsAppConfigRow;
const mockCredential = dbCredentialRow;
const mockApiKey = 'sk_testkey1234567890abcdef';

module.exports = {
    dbTenantRow,
    formattedTenant,
    dbCredentialRow,
    dbWhatsAppConfigRow,
    // legacy
    mockTenant,
    mockTenants,
    mockWhatsAppConfig,
    mockCredential,
    mockApiKey,
};
