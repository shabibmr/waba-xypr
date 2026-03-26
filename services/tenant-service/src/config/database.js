const { Pool } = require('pg');

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'whatsapp_genesys',
    user: process.env.DB_USER || 'postgres',
    max: 20,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    // Disable SSL for internal/development connections, enable for production
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

// Only add password if it's provided
if (process.env.DB_PASSWORD) {
    config.password = process.env.DB_PASSWORD;
}

console.log('Database config:', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    ssl: config.ssl
});

const pool = new Pool(config);

// Add error event handler
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

// Add connect event handler for debugging
pool.on('connect', (client) => {
    console.log('Database client connected');
});

// Add remove event handler for debugging
pool.on('remove', (client) => {
    console.log('Database client removed from pool');
});

module.exports = pool;
