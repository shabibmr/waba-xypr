# Phase 4 — Quality & Documentation 📝

> **Depends on**: Phase 1, Phase 2, Phase 3 (code must be stable before testing)
> **Estimated Effort**: ~20–30 hours
> **Reference**: [Gap Analysis](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/docs/gap-analysis.md) — Gap #14

---

## 4.1 Write the FRD 🔴 P0

> **File**: [tenant-service-FRD.md](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/docs/tenant-service-FRD.md) — currently empty (0 bytes)

### Context
The FRD is the source of truth for the service's functional requirements. It must document all features, data models, and flows.

### Steps

- [ ] **4.1.1** Document **Service Overview**: purpose, scope, key responsibilities
- [ ] **4.1.2** Document **Architecture**: 
  - Database (PostgreSQL) — tables, relationships, constraints
  - Cache (Redis) — key patterns, TTLs
  - External dependencies (Meta Graph API)
- [ ] **4.1.3** Document **Data Model**:
  - `tenants` table — all columns, types, constraints, defaults
  - `tenant_credentials` table
  - `tenant_whatsapp_config` table
  - `tenant_api_keys` table
- [ ] **4.1.4** Document **API Endpoints** — every endpoint with:
  - HTTP method, path
  - Request body/params
  - Response shape
  - Error codes
  - Auth requirements
- [ ] **4.1.5** Document **Business Logic Flows**:
  - Tenant creation flow
  - Genesys provisioning flow (auto-create tenant)
  - WhatsApp embedded signup flow (code → token → WABA → save)
  - Credential management (store/retrieve/mask)
  - Onboarding completion flow
  - Tenant resolution (by-phone, by-integration, by-genesys-org)
- [ ] **4.1.6** Document **Caching Strategy**:
  - What is cached (tenant data, credentials, WhatsApp config, phone mappings)
  - TTLs (1 hour for most)
  - Invalidation rules
- [ ] **4.1.7** Document **Security Considerations** (even if deferred to post-MVP):
  - JWT auth (planned)
  - Credential masking
  - Rate limiting (planned)
- [ ] **4.1.8** Document **Environment Variables**:
  - All required and optional vars from `.env.example`
- [ ] **4.1.9** Document **Error Codes**:
  - All `code` values returned in error responses

### Acceptance Criteria
- FRD is comprehensive enough that a new developer can understand the service
- All implemented + planned features are documented
- Synced with the final OpenAPI spec

---

## 4.2 Unit Tests 🟡 P1

> **Directory**: `tests/unit/`
> **Existing**: `tests/unit/` has 2 files already

### Files to Test

| Service File | Test File | Key Functions |
|---|---|---|
| `tenantService.js` | `tenantService.test.js` | `createTenant`, `getAllTenants`, `getTenantById`, `getTenantByGenesysOrg`, `ensureTenantByGenesysOrg`, `setGenesysCredentials`, `getGenesysCredentials`, `updateTenant`, `deleteTenant`, `completeOnboarding`, `getTenantByPhoneNumberId`, `getTenantByIntegrationId`, `getCredentials`, `setCredentials` |
| `whatsappService.js` | `whatsappService.test.js` | `updateWhatsAppConfig`, `getWhatsAppConfig`, `getTenantByPhoneNumberId`, `getMetaCredentials` |
| `credentialService.js` | `credentialService.test.js` | `storeCredentials`, `getCredentials` |
| `cache.service.js` | `cacheService.test.js` | `get`, `set`, `del`, `invalidateTenant` |
| `masking.js` | `masking.test.js` | `maskWhatsAppConfig`, `maskToken` |
| `formatter.js` (new) | `formatter.test.js` | `formatTenant` |

### Steps

- [ ] **4.2.1** Review existing test setup in `tests/setup.js` and mocks
- [ ] **4.2.2** Create/update mocks:
  - `tests/mocks/database.js` — mock `pg.Pool.query()`
  - `tests/mocks/redis.js` — mock Redis client methods
- [ ] **4.2.3** Write `tenantService.test.js`:
  - Test `createTenant` — happy path, missing fields, duplicate handling
  - Test `getTenantById` — found, not found
  - Test `updateTenant` — partial update, tenant not found, empty fields
  - Test `deleteTenant` — success, not found, cascading deletes
  - Test `setGenesysCredentials` — success, tenant not found, deactivates old
  - Test `getGenesysCredentials` — from cache, from DB, not configured
  - Test `ensureTenantByGenesysOrg` — existing tenant, new tenant
  - Test `completeOnboarding` — success, not found
  - Test `getTenantByPhoneNumberId` — cached, from DB, not found
  - Test `getTenantByIntegrationId` — cached, from DB, not found
- [ ] **4.2.4** Write `whatsappService.test.js`:
  - Test `updateWhatsAppConfig` — insert new, update existing, cache invalidation
  - Test `getWhatsAppConfig` — from cache, from DB, not found
  - Test `getMetaCredentials` — found, not found
- [ ] **4.2.5** Write `credentialService.test.js`:
  - Test `storeCredentials` — deactivate old + insert new, cache invalidation
  - Test `getCredentials` — from cache, from DB, not found
- [ ] **4.2.6** Write `cacheService.test.js`:
  - Test graceful handling when Redis is down (returns null / no-ops)
  - Test `invalidateTenant` — pattern-based deletion
- [ ] **4.2.7** Write `masking.test.js`:
  - Test various token lengths (null, short, normal)
- [ ] **4.2.8** Run `npm test` — all tests pass
- [ ] **4.2.9** Check coverage: `npx jest --coverage` — target ≥80%

---

## 4.3 API Integration Tests 🟡 P1

> **Directory**: `tests/api/`
> **Existing**: `tests/api/` has 1 file

### Steps

- [ ] **4.3.1** Create test database setup (use a separate test DB or transactions with rollback)
- [ ] **4.3.2** Write `tenants.api.test.js`:
  - `POST /tenants` — create tenant, verify 201, response shape
  - `POST /tenants` — duplicate, verify 409
  - `POST /tenants` — missing fields, verify 400
  - `GET /tenants` — list with pagination, verify `{ tenants, total, limit, offset }`
  - `GET /tenants/:id` — found (200), not found (404)
  - `PATCH /tenants/:id` — partial update, verify response
  - `DELETE /tenants/:id` — success, not found
- [ ] **4.3.3** Write `whatsapp.api.test.js`:
  - `POST /tenants/:id/whatsapp` — store config, verify masked response
  - `GET /tenants/:id/whatsapp` — retrieve config, verify `configured: true`
  - `POST /api/whatsapp/signup` — mock Meta API calls, verify tenant association
- [ ] **4.3.4** Write `credentials.api.test.js`:
  - `POST /tenants/:id/credentials` — store genesys creds
  - `GET /tenants/:id/credentials/genesys` — retrieve masked
  - Invalid type, verify 400
- [ ] **4.3.5** Write `health.api.test.js`:
  - `GET /health` — verify `{ status, timestamp }`
- [ ] **4.3.6** Write `resolution.api.test.js`:
  - `GET /tenants/by-phone/:phoneNumberId`
  - `GET /tenants/by-integration/:integrationId`
  - `GET /tenants/by-genesys-org/:genesysOrgId`
- [ ] **4.3.7** Run full test suite: `npm test`

---

## 4.4 Dockerfile Review 🟢 P2

> **File**: [Dockerfile](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/Dockerfile)

### Checklist

- [ ] **4.4.1** Verify multi-stage build (build stage + production stage)
- [ ] **4.4.2** Verify non-root user:
  ```dockerfile
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  USER appuser
  ```
- [ ] **4.4.3** Add HEALTHCHECK instruction:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3007/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"
  ```
- [ ] **4.4.4** Verify `.dockerignore` includes `node_modules`, `tests`, `docs`, `.env`
- [ ] **4.4.5** Verify `NODE_ENV=production` is set
- [ ] **4.4.6** Verify only production dependencies installed (`npm ci --only=production`)
