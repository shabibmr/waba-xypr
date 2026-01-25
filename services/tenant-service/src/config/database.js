const { Pool } = require('pg');

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'whatsapp_genesys',
    user: process.env.DB_USER || 'postgres',
    max: 20
};

// Only add password if it's provided
if (process.env.DB_PASSWORD) {
    config.password = process.env.DB_PASSWORD;
}

const pool = new Pool(config);

module.exports = pool;
