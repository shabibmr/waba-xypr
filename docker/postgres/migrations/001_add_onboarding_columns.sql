-- Migration: Add onboarding tracking columns to tenants table
-- Date: 2026-02-05
-- Purpose: Support onboarding completion workflow

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS whatsapp_configured BOOLEAN DEFAULT false;

-- Add index for onboarding status queries
CREATE INDEX IF NOT EXISTS idx_tenants_onboarding ON tenants(onboarding_completed);

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added onboarding columns to tenants table';
END $$;
