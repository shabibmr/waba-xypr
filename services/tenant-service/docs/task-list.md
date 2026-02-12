# Tenant Service — MVP Tasks

> Ordered by dependency. Security/Auth deferred to post-MVP.
> References → [Gap Analysis](./gap-analysis.md)

---

## Phase 1 — Foundation (Database & Schema) 🏗️

📄 **Detailed steps**: [01-foundation-database-schema.md](./todo/01-foundation-database-schema.md)

| # | Task | Gap | Pri | Effort |
|---|------|-----|-----|--------|
| 1.1 | **Add missing columns** to `tenants`: `email`, `domain`, `phone_number_id`, `genesys_integration_id` | #16 | 🔴 P0 | M |
| 1.2 | **Add `settings JSONB`** column or repurpose `metadata` for timezone/language | #16 | 🔴 P0 | S |
| 1.3 | **Add `updated_at` trigger** — auto-update on row changes | #20 | 🟡 P1 | S |
| 1.4 | **Add indexes** on `phone_number_id`, `genesys_integration_id` | #16 | 🟡 P1 | S |
| 1.5 | **Consolidate Redis clients** — unify `config/redis.js` and `cache.service.js` into one | Cross-cutting | 🟡 P1 | S |
| 1.6 | **Create migration system** — replace `CREATE TABLE IF NOT EXISTS` with `node-pg-migrate` | — | 🟢 P2 | M |

> [!CAUTION]
> **1.1 is a runtime blocker** — `getTenantByPhoneNumberId()` and `getTenantByIntegrationId()` query columns that don't exist.

---

## Phase 2 — API Contract Alignment 📋

📄 **Detailed steps**: [02-api-contract-alignment.md](./todo/02-api-contract-alignment.md)

| # | Task | Gap | Pri | Effort |
|---|------|-----|-----|--------|
| 2.1 | **`POST /tenants` — Fix request schema**: Accept `name`, `email` (required) + `domain`, `settings`. Auto-generate `id` server-side | #1 | 🔴 P0 | L |
| 2.2 | **`POST /tenants` — Return `201`** instead of `200` | #2 | 🟡 P1 | S |
| 2.3 | **`POST /tenants` — Add 409** duplicate check before insert | #3 | 🟡 P1 | S |
| 2.4 | **`GET /tenants` — Add pagination** (`limit`, `offset` → `{ tenants, total, limit, offset }`) | #4 | 🟡 P1 | M |
| 2.5 | **Normalize response schema** — camelCase field names, include `email`, `domain`, `settings`, `status` | #5 | 🔴 P0 | M |
| 2.6 | **WhatsApp config — Add `verifyToken`**, rename `businessId` → `businessAccountId` | #6 | 🟡 P1 | M |
| 2.7 | **`GET .../whatsapp` — Add `configured` boolean**, masked `verifyToken` | #7 | 🟡 P1 | S |
| 2.8 | **Consolidate credential endpoints** — Remove duplicate impl, keep one `POST` + one `GET /:type` per spec | #8, #9 | 🔴 P0 | M |
| 2.9 | **Signup flow — Process `state` param**, associate result with tenant, persist config | #10 | 🔴 P0 | L |
| 2.10 | **Health — Add `timestamp`** field | #11 | 🟢 P2 | S |
| 2.11 | **Standardize errors** → `{ error, code }` format | #13 | 🟡 P1 | M |
| 2.12 | **Update OpenAPI spec** to document extra endpoints or remove them | #15 | 🟡 P1 | M |

---

## Phase 3 — Business Logic & Validation ✅

📄 **Detailed steps**: [03-business-logic-validation.md](./todo/03-business-logic-validation.md)

| # | Task | Gap | Pri | Effort |
|---|------|-----|-----|--------|
| 3.1 | **Input validation middleware** — Joi or express-validator for all endpoints | #18 | 🟡 P1 | L |
| 3.2 | **Enforce status enum** — validate `active | suspended | deleted` | #17 | 🟡 P1 | S |
| 3.3 | **Startup env validation** — fail fast on missing env vars | Cross-cutting | 🟡 P1 | S |
| 3.4 | **WhatsApp signup e2e** — persist config + set `whatsapp_configured = true` on tenant | #10 | 🔴 P0 | L |
| 3.5 | **Structured logging** — replace `console.*` with `pino`/`winston` | #19 | 🟢 P2 | M |
| 3.6 | **Graceful shutdown** — handle SIGTERM/SIGINT | Cross-cutting | 🟢 P2 | S |

---

## Phase 4 — Quality & Documentation 📝

📄 **Detailed steps**: [04-quality-documentation.md](./todo/04-quality-documentation.md)

| # | Task | Gap | Pri | Effort |
|---|------|-----|-----|--------|
| 4.1 | **Write the FRD** — `tenant-service-FRD.md` is empty (0 bytes) | #14 | 🔴 P0 | L |
| 4.2 | **Unit tests** for `tenantService`, `whatsappService`, `credentialService`, `cacheService` | — | 🟡 P1 | XL |
| 4.3 | **API integration tests** via supertest | — | 🟡 P1 | XL |
| 4.4 | **Dockerfile review** — multi-stage build, non-root user, healthcheck | — | 🟢 P2 | S |

---

## Deferred to Post-MVP 🔒

📄 **Detailed steps**: [05-deferred-security-auth.md](./todo/05-deferred-security-auth.md)

| # | Task | Notes |
|---|------|-------|
| D.1 | JWT authentication middleware (`BearerAuth`) | Layer via API gateway or add later |
| D.2 | Apply auth to all protected routes | — |
| D.3 | CORS middleware | — |
| D.4 | Rate limiting middleware (use `rate_limit` column) | — |
| D.5 | OpenAPI runtime validation (`express-openapi-validator`) | — |

---

## Effort Key

| Code | Meaning |
|---|---|
| **S** | < 1 hour |
| **M** | 1–4 hours |
| **L** | 4–8 hours |
| **XL** | 8+ hours |

---

## MVP Critical Path

```
1.1 → 1.2 → 2.1 → 2.5 → 2.8 → 2.9 → 3.4 → 4.1
```

**Estimated MVP effort**: ~30–40 hours across 8 critical tasks.
