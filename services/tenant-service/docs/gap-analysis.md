# Tenant Service — Gap Analysis

> **Source of Truth**: [openapi.yaml](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/docs/openapi.yaml) (FRD file is empty)
> **Date**: 2026-02-12

---

## Summary Matrix

| # | Area | Status | Severity |
|---|------|--------|----------|
| 1 | `POST /tenants` — Request Schema | 🟡 Divergent | 🔴 High |
| 2 | `POST /tenants` — Response Code | 🟡 Divergent | 🟡 Medium |
| 3 | `POST /tenants` — Duplicate Check (409) | 🔴 Missing | 🟡 Medium |
| 4 | `GET /tenants` — Pagination | 🔴 Missing | 🟡 Medium |
| 5 | `GET /tenants/{tenantId}` — Tenant Schema | 🟡 Divergent | 🟡 Medium |
| 6 | `POST /tenants/{tenantId}/whatsapp` — verifyToken | 🔴 Missing | 🟡 Medium |
| 7 | `GET /tenants/{tenantId}/whatsapp` — Response Schema | 🟡 Divergent | 🟡 Medium |
| 8 | `POST /tenants/{tenantId}/credentials` — Dual Implementation | 🟡 Divergent | 🔴 High |
| 9 | `GET /tenants/{tenantId}/credentials/{type}` — Path Param | 🟡 Partial | 🟡 Medium |
| 10 | `POST /api/whatsapp/signup` — `state` param | 🔴 Missing | 🔴 High |
| 11 | `/health` — Response Schema | 🟡 Divergent | 🟢 Low |
| 12 | Authentication / Security (BearerAuth) | 🔴 Missing | 🔴 High |
| 13 | Error Response Format | 🟡 Divergent | 🟡 Medium |
| 14 | FRD Document | 🔴 Empty | 🔴 High |
| 15 | Extra Endpoints (not in spec) | 🟠 Extra | 🟡 Medium |
| 16 | DB Schema — `email` / `domain` / `settings` columns | 🔴 Missing | 🔴 High |
| 17 | Tenant Status Enum | 🟡 Partial | 🟡 Medium |
| 18 | Input Validation (middleware) | 🔴 Missing | 🟡 Medium |
| 19 | Request Logging / Audit trail | 🔴 Missing | 🟢 Low |
| 20 | `updated_at` auto-trigger | 🔴 Missing | 🟢 Low |

---

## Detailed Findings

### 1. `POST /tenants` — Request Schema 🔴

| | OpenAPI Spec | Current Code |
|---|---|---|
| Required fields | `name`, `email` | `tenantId`, `name` |
| Optional fields | `domain`, `settings` (timezone, language) | `subdomain`, `plan`, `genesysOrgId`, `genesysOrgName`, `genesysRegion` |
| ID generation | Server should generate `id` | Client provides `tenantId` |

**Gap**: The spec expects `email` as a required field and server-generated IDs. Implementation requires client-provided `tenantId` and has no `email`, `domain`, or `settings` support. The DB schema also has no `email`, `domain`, or `settings` columns.

---

### 2. `POST /tenants` — Response Code 🟡

| Spec | Code |
|---|---|
| Returns `201 Created` | Returns `200 OK` |

---

### 3. `POST /tenants` — Duplicate Check (409) 🔴

Spec defines a `409 Conflict` response for duplicate tenants. Implementation has no duplicate check — relies only on DB unique constraints which throw a `500`.

---

### 4. `GET /tenants` — Pagination 🔴

| Spec | Code |
|---|---|
| `?limit=50&offset=0` query params | No pagination, returns all tenants |
| Response: `{ tenants, total, limit, offset }` | Returns raw array `[...]` |

---

### 5. `GET /tenants/{tenantId}` — Tenant Schema 🟡

Spec expects `id`, `email`, `domain`, `settings`, `status` (enum: active/suspended/deleted), `createdAt`, `updatedAt`.

Code returns raw DB row with `tenant_id` (not `id`), missing `email`/`domain`/`settings`. Field names are snake_case instead of camelCase.

---

### 6. `POST /tenants/{tenantId}/whatsapp` — verifyToken 🔴

Spec includes `verifyToken` and `businessAccountId` as optional fields. Code accepts `businessId` and `displayPhoneNumber` instead. No `verifyToken` support.

---

### 7. `GET /tenants/{tenantId}/whatsapp` — Response Schema 🟡

| Spec Field | Code Equivalent | Status |
|---|---|---|
| `configured` (boolean) | Not returned | 🔴 Missing |
| `verifyToken` (masked) | Not stored | 🔴 Missing |
| `businessAccountId` | Returned as `businessId` | 🟡 Name mismatch |

---

### 8. `POST /tenants/{tenantId}/credentials` — Dual Implementation 🔴

Two competing implementations exist:
1. **credentialController** + **credentialService** → via `credentialRoutes` (`POST /:tenantId/credentials`)
2. **tenantController.setCredentials** → via `tenantRoutes` (`PUT /:tenantId/credentials`)

Both write to `tenant_credentials` table. The spec expects a single `POST` at `/tenants/{tenantId}/credentials`. Route conflicts and ambiguity present.

---

### 9. `GET /tenants/{tenantId}/credentials/{type}` — Path Param vs Query 🟡

| Spec | Code |
|---|---|
| `type` as path param: `GET /tenants/:id/credentials/:type` | credentialRoutes: path param ✅ |
| | tenantRoutes: `type` as query param `?type=` ❌ |

Spec's path-parameter approach is implemented in `credentialRoutes` but a conflicting query-param approach exists in `tenantRoutes`.

---

### 10. `POST /api/whatsapp/signup` — `state` Parameter 🔴

| Spec | Code |
|---|---|
| Expects `code` + `state` (tenantId) | Only processes `code`, ignores `state` |
| Should associate signup with tenant | No tenant association, returns raw WABA data |
| Returns `SuccessResponse` | Returns raw WABA credentials |

The signup flow doesn't link to any tenant. The `state` param (tenant ID) is ignored.

---

### 11. `/health` — Response Schema 🟡

| Spec | Code |
|---|---|
| `{ status, timestamp }` | `{ status, database, redis }` or `{ status, error }` |

Minor. Code returns more detail (database/redis health), but omits `timestamp`.

---

### 12. Authentication / Security 🔴

The spec declares `BearerAuth` (JWT) on all tenant/whatsapp/credential endpoints. **No authentication middleware exists in the codebase**. All endpoints are fully open.

---

### 13. Error Response Format 🟡

| Spec | Code |
|---|---|
| `{ error: string, code: string }` | `{ error: string }` (no `code` field) |

---

### 14. FRD Document 🔴

The file [tenant-service-FRD.md](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/docs/tenant-service-FRD.md) is **completely empty** (0 bytes). There is no formal FRD.

---

### 15. Extra Endpoints (Not in Spec) 🟠

The following endpoints exist in code but are **not defined** in the OpenAPI spec:

| Endpoint | Purpose |
|---|---|
| `GET /tenants/by-phone/:phoneNumberId` | Lookup tenant by WhatsApp phone |
| `GET /tenants/by-integration/:integrationId` | Lookup tenant by Genesys integration |
| `GET /tenants/by-genesys-org/:genesysOrgId` | Lookup tenant by Genesys org |
| `POST /tenants/provision/genesys` | Auto-provision tenant for Genesys |
| `PATCH /:tenantId` | Update tenant |
| `DELETE /:tenantId` | Delete tenant |
| `PUT /:tenantId/genesys/credentials` | Set Genesys creds (dedicated) |
| `GET /:tenantId/genesys/credentials` | Get Genesys creds (dedicated) |
| `POST /:tenantId/complete-onboarding` | Complete onboarding |
| `GET /:tenantId/credentials/meta` | Get Meta credentials |

> **Decision needed**: Are these intentional extensions or should the spec be updated?

---

### 16. DB Schema — Missing Columns 🔴

| Spec Field | DB Column | Status |
|---|---|---|
| `email` | — | 🔴 Missing |
| `domain` | — | 🔴 Missing |
| `settings` (timezone, language) | `metadata JSONB` (unused) | 🟡 Partially available |
| `phone_number_id` (on tenants table) | — | 🔴 Missing (only in whatsapp_config) |
| `genesys_integration_id` (on tenants table) | — | 🔴 Missing (queries reference it) |

> [!CAUTION]
> `tenantService.getTenantByPhoneNumberId()` and `getTenantByIntegrationId()` query `tenants.phone_number_id` and `tenants.genesys_integration_id`, but these columns do **not exist** in the schema. These queries will fail at runtime.

---

### 17. Tenant Status Enum 🟡

Spec defines: `active | suspended | deleted`. Code only uses `active` and the DB default is `active`. No validation enforces the enum.

---

### 18. Input Validation Middleware 🔴

No request validation middleware (e.g., Joi, express-validator, or schema-based validation). All validation is ad-hoc `if` checks in controllers.

---

### 19. Request Logging / Audit Trail 🔴

No structured logging or audit trail for tenant operations. Only `console.error` in catch blocks.

---

### 20. `updated_at` Auto-trigger 🔴

DB schema defines `updated_at DEFAULT CURRENT_TIMESTAMP` but no trigger or application-level logic updates it on row changes.

---

## Cross-Cutting Concerns

| Concern | Status |
|---|---|
| CORS | Not configured |
| Rate limiting | Schema has `rate_limit` column but no middleware |
| Graceful shutdown | Not implemented |
| Environment validation | No startup validation of required env vars |
| Redis connection in two places | `config/redis.js` and `cache.service.js` create separate clients |
