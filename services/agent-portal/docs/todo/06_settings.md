# Task File 06: Settings & Configuration

**Priority**: 🟡 MEDIUM
**Depends on**: `02_state_management.md` (React Query for settings queries), `07_ui_components.md` (form components)
**Blocks**: Nothing downstream
**Estimated effort**: 2 weeks

---

## Context

The FRD specifies a comprehensive settings page covering organization profile, team members, API keys, integration credentials (Genesys + WhatsApp), webhook configuration, secret rotation, and audit logs. The current `Settings.jsx` is a read-only display stub with only logout and a WhatsApp reconnect button.

**FRD Reference**: Section 6.2 — Settings & Configuration

**Relevant files**:
- `src/pages/Settings.jsx` — current stub
- `src/pages/Profile.jsx` — basic profile display
- `../agent-portal-service/src/controllers/organizationController.js` — org endpoints
- `../agent-portal-service/src/routes/organizationRoutes.js` — routes
- `../tenant-service/src/routes/tenantRoutes.js` — credential storage

---

## Tasks

### SET-01 — Frontend: Organization Profile Edit Form
**Status**: ❌ Missing (read-only display exists)
**FRD Reference**: Section 6.2 — "Organization Settings: update profile"

**Action** in `Settings.jsx`:
- Add editable form fields: Company Name, Email, Phone, Timezone, Country, Industry
- Form uses React Hook Form + Zod validation
- Save button → `PUT /api/organization/profile`
- Show success/error toast
- Loading state on save button

**Files to change**: `src/pages/Settings.jsx`

---

### SET-02 — Frontend: Team Member Management
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "Manage team members"

**Action** in `Settings.jsx` (new tab/section):
- Table of current users (from `GET /api/organization/users`): Name | Email | Role | Last Login
- "Sync from Genesys" button → `POST /api/organization/sync-users`
- Role badge: admin / supervisor / agent
- Remove user button (if admin)

**Files to change**: `src/pages/Settings.jsx`

---

### SET-03 — Frontend: Genesys Credentials Update
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "Integration Settings: Genesys Cloud config"

**Action** in `Settings.jsx`:
- Form: Client ID, Client Secret (masked), Region selector
- "Test Connection" button → calls `POST /api/onboarding/validate` (reuse from OB-03)
- Save button → `PUT /api/organization/profile` with genesys config fields
- Show current connection status (green/red indicator)

**Files to change**: `src/pages/Settings.jsx`

---

### SET-04 — Frontend: WhatsApp Credentials Update
**Status**: ⚠️ Partial (Connect button exists, no credential display)
**FRD Reference**: Section 6.2 — "WhatsApp Business config"

**Action** in `Settings.jsx`:
- Show connected phone number(s) with status
- "Reconnect" button triggers Meta Embedded Signup again
- Display WABA ID, Phone Number ID (read-only)
- Show token expiry date if available
- "Refresh Token" button → POST to refresh Meta token

**Files to change**: `src/pages/Settings.jsx`

---

### SET-05 — Backend: `GET /api/organization/settings`
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "Get full settings object"

**Action** in `organizationController.js`:
- Return combined settings object:
  - Organization profile fields
  - Genesys connection status (connected/disconnected, masked client_id)
  - WhatsApp connection status (phone_number_id, whatsapp_configured)
  - Webhook URLs
  - API keys (masked)

**Endpoint**: `GET /api/organization/settings`
**Files to change**: `../agent-portal-service/src/controllers/organizationController.js`

---

### SET-06 — Backend: `PUT /api/organization/settings`
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "Update settings"

**Action**:
- Accepts partial settings update (PATCH semantics)
- Validates input with Zod schema
- Updates tenant profile via tenant-service API
- Returns updated settings object

**Endpoint**: `PUT /api/organization/settings`
**Files to change**: `../agent-portal-service/src/controllers/organizationController.js`

---

### SET-07 — Frontend: Webhook Configuration UI
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "Webhook configuration"

**Action** in `Settings.jsx`:
- Display current webhook URLs (read-only with copy button)
- Display webhook verify token (masked, with reveal button)
- "Rotate Webhook Secret" button (see SET-08)

**Files to change**: `src/pages/Settings.jsx`

---

### SET-08 — Frontend + Backend: Webhook Secret Rotation
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "Secret rotation with confirmation token"

**Frontend Action**:
- "Rotate Secret" button opens confirmation modal:
  - Warning: "This will invalidate your current webhook. Update Meta and Genesys immediately."
  - Text field: Type "ROTATE" to confirm
  - Confirm button → calls `POST /api/organization/settings/rotate-secret`
  - Show new secret once (with copy button), then masks again

**Backend Action** in `organizationController.js`:
- Generate new random secret (crypto.randomBytes)
- Store in tenant credentials
- Invalidate old secret
- Return new secret (only once)
- Log audit event

**Endpoint**: `POST /api/organization/settings/rotate-secret`
**Files to change**: `src/pages/Settings.jsx`, `../agent-portal-service/src/controllers/organizationController.js`

---

### SET-09 — Frontend: API Key Management
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "API key management"

**Action** in `Settings.jsx`:
- List current API keys: Name | Created | Last Used | Actions (revoke)
- "Generate New Key" button:
  - Shows key name input
  - Creates key → displays full key ONCE with copy button
- "Revoke" button per key with confirmation

**Files to change**: `src/pages/Settings.jsx`

---

### SET-10 — Backend: API key generation and revocation
**Status**: ❌ Missing

**Action** in `organizationController.js`:
- `POST /api/organization/api-keys` — generate new API key
- `DELETE /api/organization/api-keys/:keyId` — revoke key
- Store hashed key in DB, return raw key only on creation

**Files to change**: `../agent-portal-service/src/controllers/organizationController.js`

---

### SET-11 — Frontend: Audit Log Viewer
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "Audit logs for credential changes"

**Action** in `Settings.jsx`:
- New "Audit Log" section/tab
- Table: Timestamp | Action | Actor | Details | IP Address
- Filter by date range
- Paginated (20/page)

**Files to change**: `src/pages/Settings.jsx`

---

### SET-12 — Backend: `GET /api/organization/audit-logs`
**Status**: ❌ Missing

**Action**:
- Returns audit events for the tenant
- Filters: `from`, `to`, `action`, `page`
- Events logged on: credential update, secret rotation, user changes, login

**Endpoint**: `GET /api/organization/audit-logs`
**Files to change**: `../agent-portal-service/src/controllers/organizationController.js`

---

## Acceptance Criteria

- [ ] Organization profile is editable and saves correctly
- [ ] Genesys credentials can be updated with connection test
- [ ] WhatsApp reconnect flow works via Embedded Signup
- [ ] Webhook URLs are displayed with copy buttons
- [ ] Secret rotation requires typed confirmation and shows new secret once
- [ ] API keys can be generated, listed (masked), and revoked
- [ ] Audit log shows last 100 events with timestamp and actor
- [ ] Team member list shows Genesys-synced users with roles
