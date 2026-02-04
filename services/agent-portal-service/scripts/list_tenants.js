const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' });

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'whatsapp_genesys',
    password: process.env.DB_PASSWORD || 'secure_password',
    port: process.env.DB_PORT || 5432,
});

async function listTenants() {
    try {
        const res = await pool.query('SELECT * FROM tenants');
        console.log('Tenants:', JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Error listing tenants:', err);
    } finally {
        await pool.end();
    }
}

listTenants();
