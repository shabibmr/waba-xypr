-- Insert demo tenant matching actual schema
DO $$
DECLARE
    demo_tenant_id VARCHAR(50) := 'demo-tenant-001';
BEGIN
    -- Insert or update demo tenant
    INSERT INTO tenants (
        tenant_id,
        name,
        subdomain,
        status,
        plan,
        genesys_org_id,
        genesys_region,
        onboarding_completed,
        whatsapp_configured
    ) VALUES (
        demo_tenant_id,
        'Demo Organization',
        'demo',
        'active',
        'standard',
        'demo-org-001',
        'aps1',
        true,
        true
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        genesys_region = EXCLUDED.genesys_region,
        updated_at = CURRENT_TIMESTAMP;

    -- Delete existing credentials to avoid conflicts
    DELETE FROM tenant_credentials WHERE tenant_id = demo_tenant_id;

    -- Insert demo Genesys credentials
    INSERT INTO tenant_credentials (
        tenant_id,
        credential_type,
        credentials,
        is_active
    ) VALUES (
        demo_tenant_id,
        'genesys',
        '{
            "clientId": "28b68c11-9671-464f-a18e-b0d08d048f9e",
            "clientSecret": "YdzMt-W6JpTYzp9zqKHYvubWibfwIONsHcufW8mw0CI",
            "region": "aps1",
            "openMsgSecret": "fK93hs2@dL!92kQ",
            "openMsgIntegrationId": "953973be-eb1f-4a3b-8541-62b3e809c803"
        }'::jsonb,
        true
    );

    -- Insert demo WhatsApp credentials
    INSERT INTO tenant_credentials (
        tenant_id,
        credential_type,
        credentials,
        is_active
    ) VALUES (
        demo_tenant_id,
        'whatsapp',
        '{
            "access_token": "EAARKcTyPnWQBQjTzoX2yky4VL8JLLZAfthJ7hoS7N5BqiokW0lFtj8cMcG4vCvjJbvhbp18sw3aJzlRTUWbXLhvUbvThncXjZAMpfW25YopCYdwwxFIaniZChkYL0ENOX1ruqnBFaz3wfcWSu1fK2VDRk0QjZCooSkvzWRAaCNz2MVlw8H2jPrs4ol2CbFZAedcAdseKHaWVCJhswj2pmWoZBNqHr4evaBn3i7VB0EHtGaMQ8EeisvyAwBgHYkf12QljfqLF8e0od35G4WsnW9CdgZD",
            "phone_number_id": "882555404932892",
            "business_account_id": "790704466912512",
            "waba_id": "1207750114647396"
        }'::jsonb,
        true
    );
END $$;
