-- Insert demo tenant (using a fixed UUID for demo purposes)
DO $$
DECLARE
    demo_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Insert or update demo tenant
    INSERT INTO tenants (
        id,
        name,
        phone_number_id,
        display_phone_number,
        genesys_integration_id,
        genesys_org_id,
        status
    ) VALUES (
        demo_tenant_id,
        'Demo Organization',
        '123456789',
        '+1234567890',
        'demo-integration-001',
        'demo-org-001',
        'active'
    ) ON CONFLICT (phone_number_id) DO UPDATE SET
        name = EXCLUDED.name,
        genesys_integration_id = EXCLUDED.genesys_integration_id,
        genesys_org_id = EXCLUDED.genesys_org_id,
        status = EXCLUDED.status;

    -- Delete existing credentials to avoid conflicts
    DELETE FROM tenant_credentials WHERE tenant_id = demo_tenant_id;

    -- Insert demo Genesys credentials (replace with actual values)
    INSERT INTO tenant_credentials (
        tenant_id,
        credential_type,
        credentials,
        is_active
    ) VALUES (
        demo_tenant_id,
        'genesys',
        '{
            "clientId": "YOUR_GENESYS_CLIENT_ID",
            "clientSecret": "YOUR_GENESYS_CLIENT_SECRET",
            "region": "mypurecloud.com"
        }'::jsonb,
        true
    );

    -- Insert demo WhatsApp credentials (replace with actual values)
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
