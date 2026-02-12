# Phase 1 — Foundation (Database & Schema) 🏗️

> **Priority**: Must be completed first. All other phases depend on this.
> **Estimated Effort**: ~8–12 hours
> **Reference**: [Gap Analysis](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/docs/gap-analysis.md) — Gaps #16, #20, Cross-cutting

---

## 1.1 Add Missing Columns to `tenants` Table 🔴 P0

> **File**: [schemaService.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/schemaService.js)
> **Runtime Blocker**: `getTenantByPhoneNumberId()` and `getTenantByIntegrationId()` query these columns but they don't exist → SQL errors.

### What's Missing
The `tenants` table is missing 4 columns that are either referenced in code or required by the OpenAPI spec:

| Column | Type | Required By |
|--------|------|-------------|
| `email` | `VARCHAR(255)` | OpenAPI spec (required on create) |
| `domain` | `VARCHAR(255)` | OpenAPI spec (optional) |
| `phone_number_id` | `VARCHAR(100)` | `tenantService.getTenantByPhoneNumberId()` |
| `genesys_integration_id` | `VARCHAR(100)` | `tenantService.getTenantByIntegrationId()` |

### Steps

- [ ] **1.1.1** Add columns to `CREATE TABLE` in `schemaService.js`:
  ```sql
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email VARCHAR(255);
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain VARCHAR(255);
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone_number_id VARCHAR(100);
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS genesys_integration_id VARCHAR(100);
  ```
- [ ] **1.1.2** Also add these to the main `CREATE TABLE IF NOT EXISTS tenants` block so fresh installs include them
- [ ] **1.1.3** Update `createTenant()` in `tenantService.js` to accept and store `email` and `domain`
- [ ] **1.1.4** Update `setGenesysCredentials()` to also write `genesys_integration_id` to the tenants table when `integrationId` is provided
- [ ] **1.1.5** When WhatsApp config is saved, also denormalize `phone_number_id` to the tenants table
- [ ] **1.1.6** Verify `getTenantByPhoneNumberId()` and `getTenantByIntegrationId()` now work without SQL errors

### Acceptance Criteria
- All 4 columns exist in DB after service restart
- `GET /tenants/by-phone/:phoneNumberId` returns a valid tenant
- `GET /tenants/by-integration/:integrationId` returns a valid tenant

---

## 1.2 Add `settings` Column 🔴 P0

> **File**: [schemaService.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/schemaService.js)

### Context
The OpenAPI spec defines `settings` with `timezone` and `language` on tenant creation. The DB has a `metadata JSONB` column that is never used.

### Steps

- [ ] **1.2.1** **Option A** (preferred): Rename `metadata` → `settings` 
  ```sql
  ALTER TABLE tenants RENAME COLUMN metadata TO settings;
  ```
  **Option B**: Add a new `settings JSONB DEFAULT '{}'` column and keep `metadata` for other use
- [ ] **1.2.2** Update `createTenant()` in `tenantService.js` to accept and store `settings` (timezone, language)
- [ ] **1.2.3** Update `updateTenant()` to allow patching `settings`
- [ ] **1.2.4** Include `settings` in tenant response objects

### Acceptance Criteria
- `POST /tenants` with `{ settings: { timezone: "UTC", language: "en" } }` stores and returns the settings
- `GET /tenants/:id` includes `settings` in response

---

## 1.3 Add `updated_at` Trigger 🟡 P1

> **File**: [schemaService.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/schemaService.js)

### Context
All tables have `updated_at DEFAULT CURRENT_TIMESTAMP` but the value never changes after initial insert.

### Steps

- [ ] **1.3.1** Create a PostgreSQL trigger function:
  ```sql
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ language 'plpgsql';
  ```
- [ ] **1.3.2** Attach trigger to all 3 tables:
  ```sql
  CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  CREATE TRIGGER update_credentials_updated_at BEFORE UPDATE ON tenant_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  CREATE TRIGGER update_whatsapp_updated_at BEFORE UPDATE ON tenant_whatsapp_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  ```
- [ ] **1.3.3** Add `DROP TRIGGER IF EXISTS` before each `CREATE TRIGGER` to make idempotent

### Acceptance Criteria
- Updating a tenant row automatically updates `updated_at` without explicit code

---

## 1.4 Add Indexes 🟡 P1

> **File**: [schemaService.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/schemaService.js)

### Steps

- [ ] **1.4.1** Add to `initDatabase()`:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_tenant_phone_number ON tenants(phone_number_id);
  CREATE INDEX IF NOT EXISTS idx_tenant_integration_id ON tenants(genesys_integration_id);
  CREATE INDEX IF NOT EXISTS idx_tenant_genesys_org ON tenants(genesys_org_id);
  CREATE INDEX IF NOT EXISTS idx_tenant_email ON tenants(email);
  CREATE INDEX IF NOT EXISTS idx_tenant_domain ON tenants(domain);
  ```
  > Note: `idx_tenant_status` and `idx_tenant_subdomain` already exist.

### Acceptance Criteria
- All indexes visible via `\di` in psql
- Queries on these columns use index scans (verify with `EXPLAIN`)

---

## 1.5 Consolidate Redis Clients 🟡 P1

> **Files**: [redis.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/config/redis.js), [cache.service.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/cache.service.js)

### Problem
Two separate Redis clients are created:
1. `config/redis.js` — used by `tenantService.js`, `whatsappService.js`, `credentialService.js`
2. `cache.service.js` — creates its own client, used by `tenantService.js` for phone/integration lookups

This means 2 Redis connections per service instance, and `cache.service.js` auto-connects on `require()`.

### Steps

- [ ] **1.5.1** Update `cache.service.js` to import and use the shared client from `config/redis.js` instead of creating its own
- [ ] **1.5.2** Remove the `redis.createClient()` call from `cache.service.js`
- [ ] **1.5.3** Add `isReady` check in `cache.service.js` methods (already done — keep this)
- [ ] **1.5.4** Remove `redisClient.connect()` call from `cache.service.js` (connection managed by `server.js`)
- [ ] **1.5.5** Verify all imports still work: `tenantService`, `whatsappService`, `credentialService` all use `config/redis.js`; only `tenantService` also uses `cache.service.js` for higher-level caching

### Acceptance Criteria
- Only one Redis connection per service instance
- All cache operations still work
- `cache.service.js` uses the shared Redis client

---

## 1.6 Create Migration System 🟢 P2

> **File**: [schemaService.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/schemaService.js)

### Problem
Using `CREATE TABLE IF NOT EXISTS` means column additions/renames require manual `ALTER TABLE` statements. No migration history is tracked.

### Steps

- [ ] **1.6.1** Install `node-pg-migrate`: `npm install node-pg-migrate`
- [ ] **1.6.2** Create `migrations/` directory under `src/`
- [ ] **1.6.3** Create initial migration `001_initial_schema.js` from current `schemaService.js` SQL
- [ ] **1.6.4** Create migration `002_add_missing_columns.js` for email, domain, phone_number_id, genesys_integration_id
- [ ] **1.6.5** Add `"migrate"` script to `package.json`
- [ ] **1.6.6** Update `server.js` to run pending migrations on startup instead of `initDatabase()`
- [ ] **1.6.7** Keep `schemaService.js` as a fallback for development/testing

### Acceptance Criteria
- Running `npm run migrate` applies all pending migrations
- Migration history tracked in `pgmigrations` table
