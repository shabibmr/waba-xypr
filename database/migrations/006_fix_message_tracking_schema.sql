-- ============================================================
-- 006_fix_message_tracking_schema.sql
-- Corrective patch: align message_tracking with dbInit.ts (source of truth)
-- Safe / non-destructive (IF NOT EXISTS / IF EXISTS guards)
--
-- SKIPPED (requires table recreation — too risky):
--   - id: INTEGER → UUID
--   - mapping_id: INTEGER → UUID (because conversation_mappings.id is currently INTEGER in DB)
-- ============================================================

-- 1. Add missing mapping_id column
-- NOTE: In dbInit.ts this is UUID, but our live conversation_mappings.id is INTEGER.
-- To maintain the FK relationship without rebuilding conversation_mappings, we must use INTEGER.
ALTER TABLE message_tracking
    ADD COLUMN IF NOT EXISTS mapping_id INTEGER REFERENCES conversation_mappings(id) ON DELETE CASCADE;

-- 2. Add missing media_url column
ALTER TABLE message_tracking
    ADD COLUMN IF NOT EXISTS media_url TEXT;

-- 3. Add missing updated_at column
ALTER TABLE message_tracking
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 4. Drop incorrect conversation_id column (not in dbInit.ts for message_tracking, it's in mappings)
-- ALTER TABLE message_tracking DROP COLUMN IF EXISTS conversation_id;
-- Skipping drop for safety unless explicitly requested, but it's dead weight.

-- 5. Add missing indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_message_id ON message_tracking(meta_message_id);
CREATE INDEX IF NOT EXISTS idx_mapping_id ON message_tracking(mapping_id);
CREATE INDEX IF NOT EXISTS idx_genesys_message_id ON message_tracking(genesys_message_id);
CREATE INDEX IF NOT EXISTS idx_mt_direction ON message_tracking(direction);
CREATE INDEX IF NOT EXISTS idx_mt_status ON message_tracking(status);
CREATE INDEX IF NOT EXISTS idx_mt_created_at ON message_tracking(created_at);
