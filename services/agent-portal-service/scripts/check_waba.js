const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' });

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'whatsapp_genesys',
    password: process.env.DB_PASSWORD || 'secure_password',
    port: process.env.DB_PORT || 5432,
});

async function checkWaba() {
    try {
        const res = await pool.query('SELECT * FROM tenant_whatsapp_config');
        if (res.rows.length === 0) {
            console.log('No WhatsApp configuration found.');
        } else {
            console.log('WhatsApp Configuration found:', JSON.stringify(res.rows, null, 2));
        }
    } catch (err) {
        console.error('Error checking WABA config:', err);
    } finally {
        await pool.end();
    }
}

checkWaba();
