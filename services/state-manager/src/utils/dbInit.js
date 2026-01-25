const pool = require('../config/database');

async function initDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_mappings (
        id SERIAL PRIMARY KEY,
        wa_id VARCHAR(50) UNIQUE NOT NULL,
        conversation_id VARCHAR(100) UNIQUE NOT NULL,
        contact_name VARCHAR(255),
        phone_number_id VARCHAR(50),
        display_phone_number VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active',
        metadata JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_wa_id ON conversation_mappings(wa_id);
      CREATE INDEX IF NOT EXISTS idx_conversation_id ON conversation_mappings(conversation_id);

      CREATE TABLE IF NOT EXISTS message_tracking (
        id SERIAL PRIMARY KEY,
        conversation_id VARCHAR(100) NOT NULL,
        meta_message_id VARCHAR(100),
        genesys_message_id VARCHAR(100),
        direction VARCHAR(10) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivered_at TIMESTAMP,
        metadata JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_meta_message ON message_tracking(meta_message_id);
      CREATE INDEX IF NOT EXISTS idx_genesys_message ON message_tracking(genesys_message_id);

      CREATE TABLE IF NOT EXISTS conversation_context (
        conversation_id VARCHAR(100) PRIMARY KEY,
        context JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('Database schema initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
    } finally {
        client.release();
    }
}

module.exports = initDatabase;
