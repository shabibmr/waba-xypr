-- ============================================================
-- 005_fix_conversation_mappings_schema.sql
-- Corrective patch: align conversation_mappings with dbInit.ts (source of truth)
-- Safe / non-destructive (IF NOT EXISTS / IF EXISTS guards)
--
-- SKIPPED (requires table recreation — too risky):
--   - id: INTEGER → UUID (FK referenced by message_tracking)
--   - conversation_id NOT NULL → nullable (need data check first)
-- ============================================================

-- 1. Add missing communication_id column (used in correlateConversation, updateConversationMapping)
ALTER TABLE conversation_mappings
    ADD COLUMN IF NOT EXISTS communication_id VARCHAR(100);

-- 2. Drop incorrect full UNIQUE on wa_id (blocks multiple closed/expired rows for same wa_id)
ALTER TABLE conversation_mappings
    DROP CONSTRAINT IF EXISTS conversation_mappings_wa_id_key;

-- 3. Drop incorrect full UNIQUE on conversation_id (not defined in dbInit.ts)
ALTER TABLE conversation_mappings
    DROP CONSTRAINT IF EXISTS conversation_mappings_conversation_id_key;

-- 4. Add correct partial unique index: one ACTIVE mapping per wa_id (matches dbInit.ts + ON CONFLICT clause)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_mapping
    ON conversation_mappings(wa_id) WHERE status = 'active';

-- 5. General wa_id lookup index
CREATE INDEX IF NOT EXISTS idx_wa_id
    ON conversation_mappings(wa_id);

-- 6. conversation_id lookup index
CREATE INDEX IF NOT EXISTS idx_conversation_id
    ON conversation_mappings(conversation_id);

-- 7. last_message_id index (used in correlateConversation WHERE last_message_id = $3)
CREATE INDEX IF NOT EXISTS idx_last_message_id
    ON conversation_mappings(last_message_id);

-- 8. last_activity_at index (used in expiry job ORDER BY last_activity_at)
CREATE INDEX IF NOT EXISTS idx_last_activity_at
    ON conversation_mappings(last_activity_at);

-- 9. status index (used in expiry job WHERE status = 'active')
CREATE INDEX IF NOT EXISTS idx_status
    ON conversation_mappings(status);
