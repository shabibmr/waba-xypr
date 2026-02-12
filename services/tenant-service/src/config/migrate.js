const { Pool } = require('pg');
require('dotenv').config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'whatsapp_genesys',
    user: process.env.DB_USER || 'postgres',
    max: 1
};

if (process.env.DB_PASSWORD) {
    config.password = process.env.DB_PASSWORD;
}



module.exports = {
    databaseUrl: `postgres://${config.user}:${config.password || ''}@${config.host}:${config.port}/${config.database}`,
    migrationsTable: 'pgmigrations',
    dir: 'migrations',
    count: Infinity
};
