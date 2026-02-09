# Database Migration Guide - Onboarding Columns

## Overview
This migration adds onboarding tracking columns to the `tenants` table to support the onboarding completion workflow.

## Columns Added

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `onboarding_completed` | BOOLEAN | `false` | Tracks if tenant completed onboarding |
| `onboarding_completed_at` | TIMESTAMP | `NULL` | When onboarding was completed |
| `whatsapp_configured` | BOOLEAN | `false` | Whether WhatsApp was configured during onboarding |

---

## Option 1: New Database Setup

If starting fresh, the updated schema is already in:
- `docker/postgres/init.sql` ✅
- `services/tenant-service/src/services/schemaService.js` ✅

**Action**: No migration needed - just start your database.

---

## Option 2: Existing Database Migration

If you have an **existing database**, run the migration:

### Via Docker

```bash
# Copy migration to container
docker cp docker/postgres/migrations/001_add_onboarding_columns.sql postgres-container:/tmp/

# Execute migration
docker exec -it postgres-container psql -U postgres -d whatsapp_genesys -f /tmp/001_add_onboarding_columns.sql
```

### Direct PostgreSQL

```bash
# Connect to database
psql -U postgres -h localhost -d whatsapp_genesys

# Run migration
\i docker/postgres/migrations/001_add_onboarding_columns.sql

# Verify columns exist
\d tenants
```

### Manual SQL

```sql
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS whatsapp_configured BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tenants_onboarding ON tenants(onboarding_completed);
```

---

## Verification

Check the migration succeeded:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name IN ('onboarding_completed', 'onboarding_completed_at', 'whatsapp_configured');
```

**Expected Output**:
```
      column_name       |     data_type      | column_default
------------------------+--------------------+----------------
 onboarding_completed   | boolean            | false
 onboarding_completed_at| timestamp          | NULL
 whatsapp_configured    | boolean            | false
```

---

## Rollback (if needed)

```sql
ALTER TABLE tenants 
DROP COLUMN IF EXISTS onboarding_completed,
DROP COLUMN IF EXISTS onboarding_completed_at,
DROP COLUMN IF EXISTS whatsapp_configured;

DROP INDEX IF EXISTS idx_tenants_onboarding;
```
