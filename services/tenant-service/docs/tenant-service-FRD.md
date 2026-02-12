# Tenant Service — Functional Requirements Document

**Version:** 1.0
**Status:** MVP
**Service Port:** 3007

---

## 1. Overview

The Tenant Service is the central configuration store for the WhatsApp-Genesys Cloud integration platform. It manages tenant lifecycle (create, read, update, delete), credential storage, and the WhatsApp Business Account onboarding flow. Every other service resolves tenant identity and credentials through this service.

---

## 2. Responsibilities

| Responsibility | Description |
|---|---|
| Tenant CRUD | Create, read, update, delete tenant records |
| Credential storage | Securely store and retrieve Genesys and WhatsApp credentials |
| WhatsApp onboarding | Process Meta Embedded Signup OAuth callback; persist WABA config |
| Tenant resolution | Look up tenants by phone number ID or Genesys integration ID |
| Caching | Cache tenant config in Redis for low-latency lookups |

---

## 3. Data Model

### 3.1 `tenants` table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `tenant_id` | VARCHAR(50) | PK | Server-generated (`t_<hex16>`) |
| `name` | VARCHAR(255) | NOT NULL | Display name |
| `email` | VARCHAR(255) | | Primary contact email |
| `domain` | VARCHAR(255) | | Custom domain for the tenant |
| `subdomain` | VARCHAR(100) | UNIQUE | Subdomain for multi-tenant routing |
| `status` | VARCHAR(20) | DEFAULT 'active' | `active` \| `suspended` \| `deleted` |
| `plan` | VARCHAR(50) | DEFAULT 'standard' | Billing plan |
| `rate_limit` | INTEGER | DEFAULT 100 | API calls per minute |
| `phone_number_id` | VARCHAR(100) | UNIQUE | WhatsApp phone number ID |
| `genesys_integration_id` | VARCHAR(100) | UNIQUE | Genesys integration ID |
| `genesys_org_id` | VARCHAR(100) | | Genesys organization ID |
| `genesys_region` | VARCHAR(100) | | Genesys API region |
| `whatsapp_configured` | BOOLEAN | DEFAULT false | True after successful WABA signup |
| `onboarding_completed` | BOOLEAN | DEFAULT false | True after onboarding flow complete |
| `settings` | JSONB | | Tenant-specific settings (timezone, language, etc.) |
| `metadata` | JSONB | | Extensible metadata |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | AUTO | Auto-updated by trigger |

### 3.2 `tenant_credentials` table

Stores Genesys OAuth and other credential types. At most one **active** credential per `(tenant_id, credential_type)`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | PK |
| `tenant_id` | VARCHAR(50) | FK -> tenants |
| `credential_type` | VARCHAR(50) | `genesys` \| `whatsapp` |
| `credentials` | JSONB | Credential payload |
| `is_active` | BOOLEAN | Active credential flag |

### 3.3 `tenant_whatsapp_config` table

| Column | Type | Description |
|--------|------|-------------|
| `tenant_id` | VARCHAR(50) | FK -> tenants (UNIQUE) |
| `waba_id` | VARCHAR(100) | WhatsApp Business Account ID |
| `phone_number_id` | VARCHAR(100) | Phone number ID |
| `access_token` | TEXT | Meta Graph API token |
| `business_account_id` | VARCHAR(100) | Meta Business Account ID |
| `verify_token` | VARCHAR(255) | Webhook verify token |
| `display_phone_number` | VARCHAR(50) | Human-readable number |
| `quality_rating` | VARCHAR(50) | GREEN / YELLOW / RED |
| `configured` | BOOLEAN | True once fully configured |

---

## 4. API Specification

### Base URL: `/api/tenants` or `/tenants`

---

### 4.1 Create Tenant

**`POST /tenants`**

Creates a new tenant. The `tenant_id` is auto-generated server-side.

**Request body:**
```json
{
  "name": "Acme Corp",
  "email": "admin@acme.com",
  "domain": "acme.com",
  "subdomain": "acme",
  "plan": "standard",
  "settings": { "timezone": "UTC", "language": "en" }
}
```

Required: `name`, `email`

**Response `201 Created`:**
```json
{
  "tenant": {
    "id": "t_a1b2c3d4e5f6a7b8",
    "name": "Acme Corp",
    "email": "admin@acme.com",
    "domain": "acme.com",
    "status": "active",
    "plan": "standard",
    "whatsappConfigured": false,
    "createdAt": "2026-02-12T10:00:00Z"
  },
  "apiKey": "sk_...",
  "message": "Tenant created successfully"
}
```

**Error `400`:** `name` or `email` missing
**Error `409`:** Tenant with this email or subdomain already exists

---

### 4.2 List Tenants

**`GET /tenants?limit=20&offset=0`**

**Response `200`:**
```json
{
  "tenants": [ { ...tenant } ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

### 4.3 Get Tenant

**`GET /tenants/:tenantId`**

**Response `200`:** Tenant object (camelCase, all fields)
**Error `404`:** Tenant not found

---

### 4.4 Update Tenant

**`PATCH /tenants/:tenantId`**

Accepts any subset of: `name`, `email`, `domain`, `subdomain`, `plan`, `status`, `settings`, `phoneNumberId`, `genesysIntegrationId`.

**Error `404`:** Tenant not found

---

### 4.5 Delete Tenant

**`DELETE /tenants/:tenantId`**

Cascades to all related records. Returns `{ message }`.

---

### 4.6 Genesys Credentials

**`PUT /tenants/:tenantId/genesys/credentials`**

```json
{
  "clientId": "...",
  "clientSecret": "...",
  "region": "mypurecloud.com",
  "integrationId": "..."
}
```

**`GET /tenants/:tenantId/genesys/credentials`**

Returns masked `clientSecret` (`***xxxx`).

---

### 4.7 Generic Credentials

**`POST /tenants/:tenantId/credentials`** — Store credential by type

Body: `{ "type": "genesys|whatsapp", "credentials": { ... } }`

**`GET /tenants/:tenantId/credentials/:type`** — Retrieve credential by type

---

### 4.8 WhatsApp Config

**`POST /tenants/:tenantId/whatsapp`** — Store/update WABA config manually

Body: `{ "wabaId", "phoneNumberId", "accessToken", "businessId"?, "displayPhoneNumber"?, "qualityRating"? }`

**`GET /tenants/:tenantId/whatsapp`** — Retrieve config (access token masked)

Response includes `configured` boolean.

---

### 4.9 WhatsApp Embedded Signup

**`POST /api/whatsapp/signup`**

Processes the Meta Embedded Signup OAuth callback. Persists WABA configuration and sets `whatsapp_configured = true` on the tenant.

**Request body:**
```json
{
  "code": "<oauth-code>",
  "state": "<tenantId>"
}
```

Both fields required.

**Response `200`:**
```json
{
  "message": "WhatsApp signup completed successfully",
  "tenantId": "t_...",
  "config": {
    "wabaId": "...",
    "phoneNumberId": "...",
    "displayPhoneNumber": "+1 555-0100",
    "qualityRating": "GREEN",
    "configured": true
  }
}
```

**Error `400`:** Missing `code` or `state`
**Error `404`:** Tenant not found
**Error `400`:** No WABA found in OAuth token (WABA_NOT_FOUND)

---

### 4.10 Tenant Resolution Endpoints

| Endpoint | Description |
|---|---|
| `GET /tenants/by-phone/:phoneNumberId` | Look up tenant by WhatsApp phone number ID |
| `GET /tenants/by-integration/:integrationId` | Look up tenant by Genesys integration ID |
| `GET /tenants/by-genesys-org/:genesysOrgId` | Look up tenant by Genesys org ID |

These are used internally by other services (inbound-transformer, genesys-webhook-service).

---

### 4.11 Genesys Tenant Provisioning

**`POST /tenants/provision/genesys`**

Get-or-create a tenant for a Genesys organization.

Body: `{ "genesysOrgId", "genesysOrgName", "genesysRegion" }` — all required

Response: `{ "message", "tenantId", "tenantName" }`

---

### 4.12 Health Check

**`GET /health`**

```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2026-02-12T10:00:00Z"
}
```

---

## 5. Response Schema

All responses use **camelCase** field names.

### Tenant Object

```json
{
  "id": "t_a1b2c3d4e5f6a7b8",
  "name": "Acme Corp",
  "email": "admin@acme.com",
  "domain": "acme.com",
  "subdomain": "acme",
  "status": "active",
  "plan": "standard",
  "rateLimit": 100,
  "phoneNumberId": "15550001234",
  "genesysIntegrationId": "intg-001",
  "genesysOrgId": "org-001",
  "genesysRegion": "mypurecloud.com",
  "settings": { "timezone": "UTC" },
  "whatsappConfigured": true,
  "onboardingCompleted": false,
  "createdAt": "2026-02-12T10:00:00Z",
  "updatedAt": "2026-02-12T10:05:00Z"
}
```

### Error Object

```json
{
  "error": {
    "message": "Human-readable description",
    "code": "MACHINE_READABLE_CODE"
  }
}
```

**Error codes:** `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `WABA_NOT_FOUND`, `SIGNUP_ERROR`, `INTERNAL_ERROR`

---

## 6. Caching Strategy

| Cache Key | TTL | Data |
|---|---|---|
| `tenant:{id}:config` | 3600s | Core tenant fields |
| `tenant:{id}:genesys_creds` | 3600s | Genesys credentials |
| `tenant:{id}:whatsapp` | 3600s | WhatsApp config (masked) |
| `tenant:{id}:credentials:{type}` | 3600s | Generic credentials |
| `apikey:{key}` | none | API key -> tenant ID |
| `subdomain:{sub}` | none | Subdomain -> tenant ID |
| `phone:{phoneNumberId}` | 3600s | Phone number -> tenant |
| `integration:{id}` | 3600s | Integration ID -> tenant |

Cache is invalidated on every write. Redis unavailability degrades gracefully (falls through to DB).

---

## 7. Non-functional Requirements (MVP)

| Requirement | Target |
|---|---|
| Availability | 99.9% uptime |
| Response time (cached) | < 10 ms p99 |
| Response time (DB) | < 100 ms p99 |
| Credential masking | Secrets show only last 4 chars in API responses |
| Auth | None for MVP (deferred — handled by API Gateway) |

---

## 8. Deferred (Post-MVP)

- JWT `BearerAuth` on all protected routes (D.1, D.2)
- CORS middleware (D.3)
- Per-tenant rate limiting enforcement (D.4)
- OpenAPI runtime validation (D.5)
- Field-level credential encryption at rest
- `node-pg-migrate` migration system (task 1.6)
