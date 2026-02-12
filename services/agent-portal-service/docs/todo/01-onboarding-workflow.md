# 01 — Onboarding Workflow

> **FRD Reference:** Section 4 (Onboarding Workflow), Lines 800-1599
> **Priority:** 🔴 High — MVP Phase 1

---

## Gap Summary

| Feature | FRD | Code | Gap |
|---------|-----|------|-----|
| 5-step wizard orchestration | ✅ | ✅ | Implemented in `onboardingController.js` |
| Step 1: Org profile collection | ✅ | ✅ | Implemented |
| Step 2: Genesys credential validation | ✅ | ✅ | Implemented |
| Step 3: WhatsApp config | ✅ | ✅ | Implemented |
| Step 4: User sync from Genesys | ✅ | ✅ | Implemented |
| Step 5: Confirmation + activate tenant | ✅ | ✅ | Implemented |
| Redis-backed onboarding state cache | ✅ | ✅ | Implemented in `onboardingCache.js` |
| Onboarding progress API (`GET /onboarding/status`) | ✅ | ✅ | Implemented |
| Step data schemas (Joi) | ✅ | ✅ | Implemented |

---

## Tasks

### T01.1 — Create Onboarding Controller
- [x] **File:** `src/controllers/onboardingController.js` (NEW)
- [x] **What:** Dedicated controller for the 5-step wizard flow
- [x] **Depends on:** T08.1 (Joi schemas)

### T01.2 — Create Onboarding Routes
- [x] **File:** `src/routes/onboardingRoutes.js` (NEW)
- [x] **Endpoints:**
  - `GET /api/portal/onboarding/status` — current step progress
  - `POST /api/portal/onboarding/step/:stepNumber` — submit step data
  - `POST /api/portal/onboarding/complete` — finalize
- [x] **Mount in:** `src/index.js`

### T01.3 — Redis Onboarding State Cache
- [x] **File:** `src/services/onboardingCache.js` (NEW)
- [x] **What:** Store per-tenant wizard progress in Redis with TTL (24h)
- [x] **Schema per FRD:**
  ```json
  {
    "tenantId": "string",
    "currentStep": 1-5,
    "completedSteps": [],
    "stepData": {},
    "startedAt": "ISO",
    "expiresAt": "ISO"
  }
  ```

### T01.4 — Step 2: Genesys Credential Validation
- [x] **File:** `src/controllers/onboardingController.js`
- [x] **What:** Validate Genesys credentials by calling Genesys API (test auth)
- [x] **Depends on:** Config must have `genesys.region`, `clientId`, `clientSecret`

### T01.5 — Enhance `completeOnboarding`
- [x] **File:** `src/controllers/organizationController.js` (MODIFY)
- [x] **What:** Extend to verify all 5 steps are complete before marking tenant active

### T01.6 — Add Onboarding Joi Schemas
- [x] **File:** `src/middleware/validation/onboarding.schema.js` (NEW)
- [x] **What:** Joi schemas for each step's payload
- [x] **Depends on:** T08.1

### T01.7 — Wire Onboarding Routes in `index.js`
- [x] **File:** `src/index.js` (MODIFY)
- [x] **What:** Import and mount `onboardingRoutes` under `/api/portal/onboarding`

### T01.8 — Move `completeOnboarding` Out of Organization Controller
- [x] **File:** `src/controllers/organizationController.js` (MODIFY)
- [x] **What:** Current `completeOnboarding` should be refactored into onboarding controller
