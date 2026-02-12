require('dotenv').config();
const { Client } = require('pg');

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'whatsapp_genesys',
    user: process.env.DB_USER || 'postgres',
};

// Intentionally NOT setting password
// if (process.env.DB_PASSWORD) {
//     config.password = process.env.DB_PASSWORD;
// }

console.log(`Connecting to: postgres://${config.user}@${config.host}:${config.port}/${config.database} (No Password)`);

const client = new Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    // password: config.password 
});

async function inspect() {
    try {
        await client.connect();

        const res = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'tenants';
        `);
        console.log('Columns in tenants table:');
        res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    } catch (err) {
        console.error('Connection error:', err.message);
    } finally {
        await client.end();
    }
}

inspect();
