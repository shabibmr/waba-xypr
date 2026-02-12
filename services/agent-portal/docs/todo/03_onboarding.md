# Task File 03: Onboarding Wizard Completion

**Priority**: 🔴 HIGH
**Depends on**: `01_security_auth.md` (needs working auth), `02_state_management.md` (useOnboarding hook)
**Blocks**: `06_settings.md` (credentials update reuses same form components)
**Estimated effort**: 1.5 weeks

---

## Context

The FRD specifies a 5-step onboarding wizard. Currently only Steps 1 (organization info) and 3 (WhatsApp Embedded Signup) are partially implemented. Steps 2 (Genesys credentials), 4 (connectivity test), and 5 (webhook deployment) are **entirely missing**.

Additionally, the backend `onboardingRoutes.js` and `onboardingController.js` exist but are stubs.

**Relevant files**:
- `src/pages/Onboarding.jsx` — main wizard file
- `../agent-portal-service/src/routes/onboardingRoutes.js` — backend routes (stub)
- `../agent-portal-service/src/controllers/onboardingController.js` — backend controller (stub)
- `../agent-portal-service/src/routes/agentRoutes.js` — auth + org endpoints already exist
- `../tenant-service/src/routes/tenantRoutes.js` — ultimate store of credentials

---

## Tasks

### OB-01 — Backend: `GET /api/onboarding/progress`
**Status**: ❌ Missing
**FRD Reference**: Section 6.1 — "Auto-save and resume onboarding"

**Action** in `onboardingController.js`:
- Return `{ currentStep, completedSteps, savedData: { orgInfo, genesysConfig } }` for authenticated user
- Pull from database (tenant settings or a new `onboarding_progress` table / tenant `settings` JSONB field)
- If tenant has no onboarding record → return `{ currentStep: 1, completedSteps: [] }`

**Endpoint**: `GET /api/onboarding/progress`
**Files to change**: `../agent-portal-service/src/controllers/onboardingController.js`, `../agent-portal-service/src/routes/onboardingRoutes.js`

---

### OB-02 — Backend: `PUT /api/onboarding/progress`
**Status**: ❌ Missing
**FRD Reference**: Section 6.1 — "Step-by-step data persistence"

**Action**:
- Accepts `{ step, data: { ... } }` body
- Saves step data to tenant `settings` JSONB column (`settings.onboarding.step{N}`)
- Returns `{ success: true, nextStep }`

**Endpoint**: `PUT /api/onboarding/progress`
**Files to change**: `../agent-portal-service/src/controllers/onboardingController.js`

---

### OB-03 — Backend: `POST /api/onboarding/validate`
**Status**: ❌ Missing
**FRD Reference**: Section 6.1 — Step 4 "Test connectivity to both Genesys and WhatsApp"

**Action**:
- Accepts `{ tenantId }` (from JWT)
- Calls tenant-service to retrieve stored Genesys credentials
- Makes a lightweight Genesys API call (e.g., `GET /api/v2/users/me`) to validate credentials
- Makes a lightweight Meta API call (e.g., `GET /{phone-number-id}`) to validate WABA token
- Returns `{ genesys: { ok: true/false, error }, whatsapp: { ok: true/false, error } }`

**Endpoint**: `POST /api/onboarding/validate`
**Files to change**: `../agent-portal-service/src/controllers/onboardingController.js`

---

### OB-04 — Backend: `GET /api/onboarding/webhook-urls`
**Status**: ❌ Missing
**FRD Reference**: Section 6.1 — Step 5 "Display webhook URLs for deployment"

**Action**:
- Returns computed webhook URLs based on tenant + environment:
  ```json
  {
    "whatsappWebhook": "https://{domain}/webhooks/whatsapp/{tenantId}",
    "genesysWebhook": "https://{domain}/webhooks/genesys/{tenantId}",
    "verifyToken": "{tenant verify token}"
  }
  ```

**Endpoint**: `GET /api/onboarding/webhook-urls`
**Files to change**: `../agent-portal-service/src/controllers/onboardingController.js`

---

### OB-05 — Backend: `POST /api/onboarding/complete`
**Status**: ❌ Missing
**FRD Reference**: Section 6.1 — "Mark onboarding complete, redirect to dashboard"

**Action**:
- Sets tenant `onboarding_complete = true` in tenant-service
- Returns `{ success: true, redirectTo: '/dashboard' }`

**Endpoint**: `POST /api/onboarding/complete`
**Files to change**: `../agent-portal-service/src/controllers/onboardingController.js`

---

### OB-06 — Frontend: Step 2 — Genesys Credentials Form
**Status**: ❌ Missing
**FRD Reference**: Section 6.1, Step 2

**Action** in `Onboarding.jsx`:
- Add step 2 form (after org info, before WhatsApp):
  - Client ID (text, required)
  - Client Secret (password input, required)
  - Region (select: mypurecloud.com, mypurecloud.de, etc.)
  - Environment (optional deployment region label)
- On submit → `PUT /api/organization/profile` with Genesys config
- Validate with Zod: all fields required, region from enum
- Show spinner while validating credentials

**Files to change**: `src/pages/Onboarding.jsx`

---

### OB-07 — Frontend: Step 4 — Connectivity Test UI
**Status**: ❌ Missing
**FRD Reference**: Section 6.1, Step 4

**Action** in `Onboarding.jsx`:
- Add step 4 screen:
  - "Testing Genesys connection..." spinner → ✅ Connected / ❌ Failed
  - "Testing WhatsApp connection..." spinner → ✅ Connected / ❌ Failed
- Call `POST /api/onboarding/validate` on mount
- If both pass → enable "Continue" button
- If either fails → show error message with "Retry" or "Go Back to Fix"

**Files to change**: `src/pages/Onboarding.jsx`

---

### OB-08 — Frontend: Step 5 — Webhook URL Display
**Status**: ❌ Missing
**FRD Reference**: Section 6.1, Step 5

**Action** in `Onboarding.jsx`:
- Add step 5 screen:
  - Display WhatsApp webhook URL with Copy button
  - Display Genesys webhook URL with Copy button
  - Display verify token with Copy button
  - Instructions: "Configure these in Meta Business Manager and Genesys"
  - "I've configured the webhooks" checkbox to enable Finish button
- Call `GET /api/onboarding/webhook-urls` on mount

**Files to change**: `src/pages/Onboarding.jsx`

---

### OB-09 — Frontend: Resume incomplete onboarding
**Status**: ❌ Missing
**FRD Reference**: Section 6.1 — "Auto-save and resume"

**Action**:
- On mount of `Onboarding.jsx`, call `GET /api/onboarding/progress`
- Set `currentStep` from response (not always start from step 1)
- Restore saved form values from `progress.savedData`

**Files to change**: `src/pages/Onboarding.jsx`

---

### OB-10 — Frontend: Back button between steps
**Status**: ❌ Missing
**FRD Reference**: Section 6.1 — "Navigation: back/forward between steps"

**Action**:
- Add "Back" button on all steps except Step 1
- Navigating back saves current step data before going back
- Step indicator shows completed steps with checkmarks

**Files to change**: `src/pages/Onboarding.jsx`

---

## Acceptance Criteria

- [ ] Onboarding has 5 clearly labelled steps with progress bar
- [ ] Step 2: Genesys credentials form validates and saves to backend
- [ ] Step 4: Connectivity test calls both Genesys and WhatsApp APIs
- [ ] Step 5: Webhook URLs displayed with one-click copy
- [ ] Refreshing browser during onboarding restores last saved step
- [ ] Back button works on all steps 2–5
- [ ] Completing Step 5 marks onboarding done and redirects to `/dashboard`
