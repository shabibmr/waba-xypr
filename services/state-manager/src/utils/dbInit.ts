import pool from '../config/database';

async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('Database schema initialization started...');

    const ENV = process.env.NODE_ENV || 'development';
    if (ENV === 'development') {
      console.log('DEV mode: Dropping existing tables for clean schema');
      await client.query('DROP TABLE IF EXISTS message_tracking, conversation_context, conversation_mappings CASCADE');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wa_id VARCHAR(50) NOT NULL,
        conversation_id VARCHAR(100),
        communication_id VARCHAR(100),
        last_message_id VARCHAR(255),
        contact_name VARCHAR(255),
        phone_number_id VARCHAR(50),
        display_phone_number VARCHAR(50),
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
        last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_mapping
      ON conversation_mappings (wa_id)
      WHERE status = 'active';

      CREATE INDEX IF NOT EXISTS idx_wa_id ON conversation_mappings(wa_id);
      CREATE INDEX IF NOT EXISTS idx_conversation_id ON conversation_mappings(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_last_message_id ON conversation_mappings(last_message_id);
      CREATE INDEX IF NOT EXISTS idx_last_activity_at ON conversation_mappings(last_activity_at);
      CREATE INDEX IF NOT EXISTS idx_status ON conversation_mappings(status);

      CREATE TABLE IF NOT EXISTS message_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mapping_id UUID NOT NULL REFERENCES conversation_mappings(id) ON DELETE CASCADE,
        wamid VARCHAR(255) NOT NULL UNIQUE,
        genesys_message_id VARCHAR(100),
        direction VARCHAR(10) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
        status VARCHAR(20) NOT NULL DEFAULT 'received',
        media_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        delivered_at TIMESTAMP,
        metadata JSONB
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_wamid ON message_tracking(wamid);
      CREATE INDEX IF NOT EXISTS idx_mapping_id ON message_tracking(mapping_id);
      CREATE INDEX IF NOT EXISTS idx_genesys_message_id ON message_tracking(genesys_message_id);
      CREATE INDEX IF NOT EXISTS idx_mt_direction ON message_tracking(direction);
      CREATE INDEX IF NOT EXISTS idx_mt_status ON message_tracking(status);
      CREATE INDEX IF NOT EXISTS idx_mt_created_at ON message_tracking(created_at);

      CREATE TABLE IF NOT EXISTS conversation_context (
        conversation_id VARCHAR(100) PRIMARY KEY,
        context JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('conversation_mappings table created/verified');
    console.log('Partial unique index on (wa_id WHERE status=active) created');
    console.log('5 indexes created for conversation_mappings');
    console.log('message_tracking table created/verified');
    console.log('Foreign key to conversation_mappings established');
    console.log('wamid UNIQUE constraint created for idempotency');
    console.log('6 indexes created for message_tracking');
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  } finally {
    client.release();
  }
}

export default initDatabase;
