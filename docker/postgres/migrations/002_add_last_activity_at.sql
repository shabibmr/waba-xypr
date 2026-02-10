-- Migration: Add last_activity_at column to conversation_mappings table
-- Date: 2026-02-09
-- Description: Fixes schema bug where mappingService.ts references column that doesn't exist

-- Add the missing column with default value
ALTER TABLE conversation_mappings
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing rows to set last_activity_at from updated_at
UPDATE conversation_mappings
SET last_activity_at = updated_at
WHERE last_activity_at IS NULL;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 002: Added last_activity_at column to conversation_mappings table';
END $$;
