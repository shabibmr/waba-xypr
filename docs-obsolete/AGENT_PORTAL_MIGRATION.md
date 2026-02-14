# Agent Portal - Database Migration Guide

## Overview

This guide walks through migrating from the incorrect agent-level WABA architecture to the correct organization-level shared WABA architecture.

## Prerequisites

- PostgreSQL 12+
- Backup of existing database
- Access to `psql` command-line tool

## Migration Steps

### Step 1: Backup Current Database

```bash
# Create backup
pg_dump -U postgres -d whatsapp_genesys > backup_before_agent_portal_$(date +%Y%m%d).sql

# Verify backup
ls -lh backup_before_agent_portal_*.sql
```

### Step 2: Run Migration Script

```bash
# Apply agent portal schema
psql -U postgres -d whatsapp_genesys -f docker/postgres/02-agent-portal-schema.sql
```

**What this does**:
- Drops old incorrect tables (`agents`, `agent_whatsapp_accounts`, `agent_sessions`, `agent_conversation_assignments`)
- Creates new tables (`genesys_users`, `genesys_user_sessions`, `conversation_assignments`)
- Adds indexes for performance

### Step 3: Verify Schema

```bash
# Connect to database
psql -U postgres -d whatsapp_genesys

# Check tables exist
\dt

# Should see:
# - genesys_users
# - genesys_user_sessions
# - conversation_assignments

# Check indexes
\di

# Should see indexes for:  
# - idx_genesys_users_tenant
# - idx_genesys_users_genesys_id
# - idx_conversation_assignments_user
# - idx_conversation_assignments_tenant
```

### Step 4: Verify Tenant Table Has Genesys Org ID

```sql
-- Check if genesys_org_id column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenants' 
  AND column_name = 'genesys_org_id';

-- If not exists, add it
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS genesys_org_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_tenants_genesys_org 
ON tenants(genesys_org_id);
```

### Step 5: Populate Genesys Org ID for Existing Tenants

If you have existing tenants, you need to populate their `genesys_org_id`:

```sql
-- Option 1: Manual update (if you know the IDs)
UPDATE tenants 
SET genesys_org_id = 'your-genesys-org-id-here' 
WHERE tenant_id = 'your-tenant-id';

-- Option 2: Import from CSV
\copy tenants (tenant_id, genesys_org_id) FROM 'tenant_genesys_mapping.csv' WITH CSV HEADER;
```

**tenant_genesys_mapping.csv** example:
```csv
tenant_id,genesys_org_id
acme_corp,abc-123-def-456
globex_inc,xyz-789-ghi-012
```

### Step 6: Start Services with New Schema

```bash
# Start infrastructure
docker compose up -d postgres redis rabbitmq

# Verify agent-portal-service can connect
docker compose up agent-portal-service

# Check logs
docker compose logs agent-portal-service
```

## Data Migration (If Upgrading from Old Version)

### If You Have Existing Agent Data

If you previously had agents in the old `agents` table, migrate them:

```sql
-- 1. Backup old data (before dropping table)
CREATE TABLE agents_backup AS SELECT * FROM agents;
CREATE TABLE agent_whatsapp_accounts_backup AS SELECT * FROM agent_whatsapp_accounts;

-- 2. Create temporary mapping table
CREATE TABLE temp_agent_migration (
    old_agent_id UUID,
    genesys_user_id VARCHAR(255),
    tenant_id VARCHAR(255),
    name VARCHAR(255),
    email VARCHAR(255)
);

-- 3. Populate mapping (manual - requires Genesys user IDs)
INSERT INTO temp_agent_migration (old_agent_id, genesys_user_id, tenant_id, name, email)
VALUES 
  ('old-uuid-1', 'genesys-user-1', 'tenant-1', 'John Doe', 'john@example.com'),
  ('old-uuid-2', 'genesys-user-2', 'tenant-1', 'Jane Smith', 'jane@example.com');

-- 4. Migrate to new genesys_users table
INSERT INTO genesys_users (tenant_id, genesys_user_id, genesys_email, name)
SELECT tenant_id, genesys_user_id, email, name
FROM temp_agent_migration;

-- 5. Cleanup
DROP TABLE temp_agent_migration;
DROP TABLE agents_backup;
DROP TABLE agent_whatsapp_accounts_backup;
```

### Important Notes

> [!WARNING]
> **WhatsApp Account Ownership Changes**:
> - Old: Each agent had their own WABA (stored in `agent_whatsapp_accounts`)
> - New: One WABA per organization (stored in `tenant_whatsapp_config`)
> 
> **Action Required**: Ensure each tenant has WhatsApp configured via admin dashboard.

> [!CAUTION]
> **Breaking Change**:
> - Agents can no longer do individual WhatsApp signup
> - Organization admins must configure WhatsApp for the entire organization
> - Existing agent WhatsApp accounts are no longer used

## Rollback Plan

If migration fails, rollback:

```bash
# Stop services
docker compose down

# Restore backup
psql -U postgres -d whatsapp_genesys < backup_before_agent_portal_20260115.sql

# Verify restoration
psql -U postgres -d whatsapp_genesys -c "\dt"
```

## Post-Migration Testing

### Test 1: Verify Genesys Org Lookup

```bash
# Should return tenant data
curl http://localhost:3000/api/tenants/by-genesys-org/your-genesys-org-id
```

### Test 2: Auto-Provisioning

1. Navigate to `http://localhost:3014/login`
2. Click "Sign in with Genesys Cloud"
3. Authenticate with Genesys credentials
4. Verify user created in database:

```sql
SELECT user_id, tenant_id, genesys_user_id, name, role 
FROM genesys_users 
WHERE genesys_email = 'your-email@example.com';
```

### Test 3: Tenant WABA Access

```bash
# Login as agent, get JWT token
TOKEN="your-jwt-token"

# Check WhatsApp status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/agents/whatsapp/status

# Should show organization's WABA (read-only)
```

### Test 4: Message Sending

```bash
# Send message using tenant's WABA
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "+1234567890", "text": "Test message"}' \
  http://localhost:3000/api/messages/send

# Verify message sent from organization's WhatsApp number
```

## Troubleshooting

### Error: "Tenant not found for this Genesys organization"

**Cause**: `genesys_org_id` not populated in tenants table

**Fix**:
```sql
UPDATE tenants 
SET genesys_org_id = 'your-org-id' 
WHERE tenant_id = 'your-tenant-id';
```

### Error: "WhatsApp not configured for your organization"

**Cause**: Tenant doesn't have WhatsApp configured

**Fix**:
1. Login to admin dashboard as Xypr admin
2. Navigate to tenant settings
3. Complete WhatsApp embedded signup for the organization

### Error: "User belongs to a different organization"

**Cause**: User exists but linked to wrong tenant

**Fix**:
```sql
-- Check current tenant
SELECT user_id, tenant_id, genesys_user_id 
FROM genesys_users 
WHERE genesys_user_id = 'problematic-user-id';

-- If wrong, update (CAREFUL!)
UPDATE genesys_users 
SET tenant_id = 'correct-tenant-id' 
WHERE genesys_user_id = 'problematic-user-id';
```

## Summary

✅ **Completed**:
- Old tables dropped
- New schema created
- Indexes added
- Genesys org lookup enabled

🔄 **Required**:
- Populate `genesys_org_id` for existing tenants
- Ensure tenants have WhatsApp configured via admin dashboard
- Test auto-provisioning flow

🚫 **Removed**:
- Agent-level WhatsApp accounts
- Manual agent signup
- Individual agent WhatsApp setup

The database now correctly supports multi-tenant SAAS architecture with organization-level shared WABA!
