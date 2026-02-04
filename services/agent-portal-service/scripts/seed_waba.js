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
            waba_id: '667044745953003',
            phone_number_id: '888340727686839',
            display_phone_number: '+1555023902', // Placeholder as it wasn't provided, safe to update later
            access_token: 'EAAQhGGulP70BPmNwdzOALJ3CPc6ivZCr41oECVDfifZBbIotzMgQL7dKRUyaWSZBpOPZC9mkGkZBKrs0ITG1G6TuLnxLBG0oFCqSLuA8ZA62BLirO5snyjxkkjJx4oJYnzlmg9ijPRiACoox0zpU3e237BlObJ9nHFquHSM69qURKF6cDtcK6SsKgGGaVbvHnjhwZDZD'
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
