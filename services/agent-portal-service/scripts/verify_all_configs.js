const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' });

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'whatsapp_genesys',
    password: process.env.DB_PASSWORD || 'secure_password',
    port: process.env.DB_PORT || 5432,
});

async function verifyAll() {
    try {
        const query = `
            SELECT 
                t.tenant_id, 
                t.name as "Tenant Name", 
                t.genesys_org_id as "Genesys Org ID",
                t.genesys_org_name as "Genesys Org Name",
                wc.waba_id as "WABA ID",
                wc.phone_number_id as "Phone ID",
                wc.display_phone_number as "Phone Number",
                wc.is_active as "WABA Connected"
            FROM tenants t
            LEFT JOIN tenant_whatsapp_config wc ON t.tenant_id = wc.tenant_id
        `;

        const res = await pool.query(query);

        console.log('--- Verification Report ---');
        if (res.rows.length === 0) {
            console.log('No tenants found.');
        } else {
            res.rows.forEach((row, i) => {
                console.log(`\n[Organization ${i + 1}]`);
                console.log(JSON.stringify(row, null, 2));
            });
        }
        console.log('\n---------------------------');

    } catch (err) {
        console.error('Error verifying configs:', err);
    } finally {
        await pool.end();
    }
}

verifyAll();
