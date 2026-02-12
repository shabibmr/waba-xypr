# Phase 2 — API Contract Alignment 📋

> **Depends on**: Phase 1 (DB columns must exist)
> **Estimated Effort**: ~16–24 hours
> **Reference**: [Gap Analysis](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/docs/gap-analysis.md) — Gaps #1–#13, #15

---

## 2.1 `POST /tenants` — Fix Request Schema 🔴 P0

> **Files**: [tenantController.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/controllers/tenantController.js), [tenantService.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/tenantService.js)

### Current Behavior
- Requires `tenantId` and `name` from client
- No `email`, `domain`, or `settings` support

### Expected (OpenAPI Spec)
- Required: `name`, `email`
- Optional: `domain`, `settings` (timezone, language)
- `id` is server-generated

### Steps

- [ ] **2.1.1** Update `createTenant()` controller validation:
  ```js
  const { name, email, domain, settings } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required', code: 'MISSING_FIELDS' });
  }
  ```
- [ ] **2.1.2** Update `createTenant()` service to auto-generate tenant ID:
  ```js
  const tenantId = `tenant-${crypto.randomBytes(6).toString('hex')}`;
  ```
- [ ] **2.1.3** Update the INSERT query to include `email`, `domain`, `settings`:
  ```sql
  INSERT INTO tenants (tenant_id, name, email, domain, settings, plan)
  VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  ```
- [ ] **2.1.4** Keep backward compat: If `tenantId` is explicitly provided in the body (for internal/Genesys provisioning), use it. Otherwise auto-generate.
- [ ] **2.1.5** Update `ensureTenantByGenesysOrg()` — this function already auto-generates IDs, verify it still works

### Acceptance Criteria
- `POST /tenants { name: "Acme", email: "admin@acme.com" }` creates a tenant with auto-generated ID
- Response includes `email`, `domain`, `settings`

---

## 2.2 `POST /tenants` — Return `201` 🟡 P1

> **File**: [tenantController.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/controllers/tenantController.js)

### Steps

- [ ] **2.2.1** Change `res.json(...)` to `res.status(201).json(...)` in `createTenant()` controller
- [ ] **2.2.2** Update any tests that assert `200` → `201`

---

## 2.3 `POST /tenants` — Add 409 Duplicate Check 🟡 P1

> **Files**: [tenantController.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/controllers/tenantController.js), [tenantService.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/tenantService.js)

### Steps

- [ ] **2.3.1** Before INSERT, check for existing tenant by email or domain:
  ```sql
  SELECT tenant_id FROM tenants WHERE email = $1 OR (domain = $2 AND domain IS NOT NULL)
  ```
- [ ] **2.3.2** If exists, throw a typed error (e.g., `DuplicateTenantError`)
- [ ] **2.3.3** In controller, catch this error and return:
  ```json
  { "error": "Tenant already exists", "code": "TENANT_DUPLICATE" }
  ```
  with status `409`
- [ ] **2.3.4** Also handle PostgreSQL unique constraint violations (error code `23505`) as a fallback → return `409`

---

## 2.4 `GET /tenants` — Add Pagination 🟡 P1

> **Files**: [tenantController.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/controllers/tenantController.js), [tenantService.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/tenantService.js)

### Current
Returns raw array of all tenants.

### Expected
`{ tenants: [...], total: 150, limit: 50, offset: 0 }`

### Steps

- [ ] **2.4.1** Update controller to extract query params:
  ```js
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;
  ```
- [ ] **2.4.2** Update service `getAllTenants(limit, offset)`:
  ```sql
  SELECT *, COUNT(*) OVER() AS total_count
  FROM tenants ORDER BY created_at DESC
  LIMIT $1 OFFSET $2
  ```
- [ ] **2.4.3** Return structured response:
  ```js
  res.json({
    tenants: rows.map(formatTenant),
    total: rows[0]?.total_count || 0,
    limit,
    offset
  });
  ```

---

## 2.5 Normalize Response Schema 🔴 P0

> **Files**: All controllers, add a new `utils/formatter.js`

### Problem
- DB returns `snake_case` fields (e.g., `tenant_id`, `created_at`)
- Spec expects `camelCase` (e.g., `id`, `createdAt`)
- Missing fields: `email`, `domain`, `settings`

### Steps

- [ ] **2.5.1** Create `src/utils/formatter.js`:
  ```js
  function formatTenant(row) {
    return {
      id: row.tenant_id,
      name: row.name,
      email: row.email,
      domain: row.domain,
      settings: row.settings || {},
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  ```
- [ ] **2.5.2** Apply `formatTenant()` in:
  - `createTenant` controller response
  - `getAllTenants` controller response (map each item)
  - `getTenantById` controller response
  - `getTenantByGenesysOrg` controller response
  - `getTenantByPhoneNumberId` controller response
  - `getTenantByIntegrationId` controller response
  - `updateTenant` controller response
  - `completeOnboarding` controller response
  - `provisionGenesysTenant` controller response
- [ ] **2.5.3** Ensure internal service-to-service calls still use raw DB format if needed (only format at controller level)

### Acceptance Criteria
- All `GET` / `POST` / `PATCH` responses return camelCase fields
- `id` returned (not `tenant_id`)
- `email`, `domain`, `settings` always present in response

---

## 2.6 WhatsApp Config — Add `verifyToken` 🟡 P1

> **Files**: [whatsappService.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/whatsappService.js), [whatsappController.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/controllers/whatsappController.js), [schemaService.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/schemaService.js)

### Steps

- [ ] **2.6.1** Add `verify_token VARCHAR(255)` column to `tenant_whatsapp_config`:
  ```sql
  ALTER TABLE tenant_whatsapp_config ADD COLUMN IF NOT EXISTS verify_token VARCHAR(255);
  ```
- [ ] **2.6.2** Rename code references: `businessId` → `businessAccountId` in controller request body destructuring
- [ ] **2.6.3** Update `updateWhatsAppConfig()` service to accept and store `verifyToken`
- [ ] **2.6.4** Update INSERT and UPDATE queries to include `verify_token`
- [ ] **2.6.5** Update controller validation: `wabaId`, `phoneNumberId`, `accessToken` required (no change), `businessAccountId` and `verifyToken` optional

---

## 2.7 `GET .../whatsapp` — Fix Response 🟡 P1

> **Files**: [whatsappService.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/whatsappService.js), [masking.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/utils/masking.js)

### Steps

- [ ] **2.7.1** Update `maskWhatsAppConfig()` to return spec-aligned fields:
  ```js
  function maskWhatsAppConfig(config) {
    return {
      wabaId: config.waba_id,
      phoneNumberId: config.phone_number_id,
      businessAccountId: config.business_id,
      accessToken: maskToken(config.access_token),
      verifyToken: maskToken(config.verify_token),
      configured: true
    };
  }
  ```
- [ ] **2.7.2** When config is `null`, return `{ configured: false }` instead of 404
- [ ] **2.7.3** Invalidate related cache entries after schema changes

---

## 2.8 Consolidate Credential Endpoints 🔴 P0

> **Files**: [credentialRoutes.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/routes/credentialRoutes.js), [tenantRoutes.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/routes/tenantRoutes.js), [tenantController.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/controllers/tenantController.js)

### Problem
Two competing implementations:
1. `credentialRoutes.js` → `credentialController` → `credentialService` (POST, GET /:type)
2. `tenantRoutes.js` → `tenantController.setCredentials/getCredentials` (PUT, GET ?type=)

### Steps

- [ ] **2.8.1** **Keep** `credentialRoutes.js` + `credentialController.js` + `credentialService.js` — these match the spec (POST for store, GET /:type for retrieve)
- [ ] **2.8.2** **Remove** from `tenantRoutes.js`:
  ```js
  // DELETE these lines:
  router.get('/:tenantId/credentials', tenantController.getCredentials);
  router.put('/:tenantId/credentials', tenantController.setCredentials);
  ```
- [ ] **2.8.3** **Remove** `getCredentials()` and `setCredentials()` from `tenantController.js` and `tenantService.js`
- [ ] **2.8.4** Verify `credentialRoutes` is mounted at `/api/tenants` in `routes/index.js` (it is ✅)
- [ ] **2.8.5** Add credential masking in `credentialController.getCredentials()` — currently returns raw credentials, should mask `clientSecret` / `accessToken`
- [ ] **2.8.6** Add `type` validation in `credentialController` (only `genesys` or `whatsapp` allowed per spec)

---

## 2.9 Signup Flow — Process `state` Parameter 🔴 P0

> **File**: [whatsappController.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/controllers/whatsappController.js)

### Current Behavior
- Accepts `code` only, ignores `state`
- Returns raw WABA credentials to caller
- Does NOT save anything to DB

### Expected
- Accept `code` + `state` (tenant ID)
- Exchange code for token (✅ already done)
- Fetch WABA info (✅ already done)
- **Save WhatsApp config to the tenant** (❌ missing)
- Return `{ success: true, message: "..." }` (not raw creds)

### Steps

- [ ] **2.9.1** Extract `state` from request body:
  ```js
  const { code, state } = req.body;
  const tenantId = state;
  ```
- [ ] **2.9.2** Validate `state` is present:
  ```js
  if (!code || !state) {
    return res.status(400).json({ error: 'code and state (tenantId) required', code: 'MISSING_FIELDS' });
  }
  ```
- [ ] **2.9.3** After fetching WABA data, save to tenant:
  ```js
  await whatsappService.updateWhatsAppConfig(tenantId, {
    wabaId: wabaData.target_ids[0],
    phoneNumberId: phoneData.id,
    accessToken: access_token,
    businessId: phoneData.business_id,
    displayPhoneNumber: phoneData.display_phone_number,
    qualityRating: phoneData.quality_rating
  });
  ```
- [ ] **2.9.4** Update tenant's `whatsapp_configured` flag:
  ```js
  await tenantService.updateTenant(tenantId, { whatsapp_configured: true });
  ```
- [ ] **2.9.5** Denormalize `phone_number_id` to the tenants table
- [ ] **2.9.6** Return spec-compliant response:
  ```js
  res.json({ success: true, message: 'WhatsApp signup completed' });
  ```

---

## 2.10 Health — Add `timestamp` 🟢 P2

> **File**: [app.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/app.js)

### Steps

- [ ] **2.10.1** Add `timestamp` to healthy response:
  ```js
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected',
    redis: 'connected'
  });
  ```
- [ ] **2.10.2** Add `timestamp` to unhealthy response too

---

## 2.11 Standardize Error Responses 🟡 P1

> **Files**: All controllers

### Expected Format
```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }
```

### Steps

- [ ] **2.11.1** Create `src/utils/errors.js` with error factory:
  ```js
  function errorResponse(res, status, message, code) {
    return res.status(status).json({ error: message, code });
  }
  
  // Error codes
  const CODES = {
    NOT_FOUND: 'NOT_FOUND',
    BAD_REQUEST: 'BAD_REQUEST',
    DUPLICATE: 'DUPLICATE',
    INTERNAL: 'INTERNAL_ERROR',
    MISSING_FIELDS: 'MISSING_FIELDS',
    INVALID_TYPE: 'INVALID_CREDENTIAL_TYPE'
  };
  ```
- [ ] **2.11.2** Replace all `res.status(X).json({ error: '...' })` calls in controllers with `errorResponse()`
- [ ] **2.11.3** Ensure consistency: every error includes both `error` and `code` fields

---

## 2.12 Update OpenAPI Spec 🟡 P1

> **File**: [openapi.yaml](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/docs/openapi.yaml)

### Steps

- [ ] **2.12.1** Add documentation for all extra endpoints currently in code:

  | Endpoint | Method | Description |
  |----------|--------|-------------|
  | `/tenants/by-phone/{phoneNumberId}` | GET | Resolve tenant by WhatsApp phone |
  | `/tenants/by-integration/{integrationId}` | GET | Resolve tenant by Genesys integration |
  | `/tenants/by-genesys-org/{genesysOrgId}` | GET | Resolve tenant by Genesys org |
  | `/tenants/provision/genesys` | POST | Auto-provision tenant for Genesys org |
  | `/tenants/{tenantId}` | PATCH | Partial update tenant |
  | `/tenants/{tenantId}` | DELETE | Delete tenant |
  | `/tenants/{tenantId}/genesys/credentials` | PUT | Set Genesys credentials |
  | `/tenants/{tenantId}/genesys/credentials` | GET | Get Genesys credentials (masked) |
  | `/tenants/{tenantId}/complete-onboarding` | POST | Complete onboarding |
  | `/tenants/{tenantId}/credentials/meta` | GET | Get Meta API credentials |

- [ ] **2.12.2** Add request/response schemas for each new endpoint
- [ ] **2.12.3** Add new tags if needed (e.g., `Onboarding`, `Resolution`)
- [ ] **2.12.4** Validate the spec with `swagger-cli validate docs/openapi.yaml`
