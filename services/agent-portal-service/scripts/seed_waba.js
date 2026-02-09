const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' }); // Adjust path to root .env

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'whatsapp_genesys',
    password: process.env.DB_PASSWORD || 'secure_password',
    port: process.env.DB_PORT || 5432,
});

async function seedWaba() {
    try {
        console.log('Connecting to database...');

        // 1. Get the first tenant
        const tenantRes = await pool.query('SELECT tenant_id, name FROM tenants LIMIT 1');

        if (tenantRes.rows.length === 0) {
            console.error('No tenants found! Please log in once to create a tenant.');
            process.exit(1);
        }

        const tenant = tenantRes.rows[0];
        console.log(`Found tenant: ${tenant.name} (${tenant.tenant_id})`);

        // 2. Credentials
        const config = {
            waba_id: '790704466912512',
            phone_number_id: '882555404932892',
            display_phone_number: '919061904887',
            access_token: 'EAARKcTyPnWQBQjTzoX2yky4VL8JLLZAfthJ7hoS7N5BqiokW0lFtj8cMcG4vCvjJbvhbp18sw3aJzlRTUWbXLhvUbvThncXjZAMpfW25YopCYdwwxFIaniZChkYL0ENOX1ruqnBFaz3wfcWSu1fK2VDRk0QjZCooSkvzWRAaCNz2MVlw8H2jPrs4ol2CbFZAedcAdseKHaWVCJhswj2pmWoZBNqHr4evaBn3i7VB0EHtGaMQ8EeisvyAwBgHYkf12QljfqLF8e0od35G4WsnW9CdgZD'

        };

        // 3. Upsert configuration
        const query = `
            INSERT INTO tenant_whatsapp_config (tenant_id, waba_id, phone_number_id, display_phone_number, access_token, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (tenant_id)
            DO UPDATE SET 
                waba_id = EXCLUDED.waba_id,
                phone_number_id = EXCLUDED.phone_number_id,
                access_token = EXCLUDED.access_token,
                updated_at = NOW()
            RETURNING *
        `;

        const res = await pool.query(query, [
            tenant.tenant_id,
            config.waba_id,
            config.phone_number_id,
            config.display_phone_number,
            config.access_token
        ]);

        console.log('Successfully updated WhatsApp configuration:', res.rows[0]);

    } catch (err) {
        console.error('Error seeding WABA config:', err);
    } finally {
        await pool.end();
    }
}

seedWaba();
