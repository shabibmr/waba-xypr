# 08 — Input Validation (Joi)

> **FRD Reference:** Section 9.2 (Input Validation), Lines 2800-2900
> **Priority:** 🔴 High — MVP Phase 1 (Foundational)

---

## Gap Summary

| Feature | FRD | Code | Gap |
|---------|-----|------|-----|
| Joi validation middleware | ✅ | ✅ | Implemented in `middleware/validation.js` |
| Auth endpoint schemas | ✅ | ✅ | Implemented |
| Message endpoint schemas | ✅ | ✅ | Implemented |
| Conversation query schemas | ✅ | ✅ | Implemented |
| Organization schemas | ✅ | ✅ | Implemented |

---

## Tasks

### T08.1 — Create Validation Middleware
- [x] **File:** `src/middleware/validation.js` (MODIFY or NEW)
- [x] **What:** Generic `validate(schema, 'body'|'query'|'params')` middleware
- [x] **Install:** `joi`

### T08.2 — Auth Schemas
- [x] **File:** `src/middleware/validation/auth.schema.js` (NEW)
- [x] **Schemas:**
  - `refreshToken` — `{ refreshToken: Joi.string().required() }`
  - `demoLogin` — `{ email, tenantId }`

### T08.3 — Message Schemas
- [x] **File:** `src/middleware/validation/message.schema.js` (NEW)
- [x] **Schemas:**
  - `sendMessage` — `{ to: Joi.string().pattern(/^\d+$/).required(), text: Joi.string().max(4096) }`
  - `sendTemplate` — `{ to, template_name, parameters[] }`

### T08.4 — Conversation Schemas
- [x] **File:** `src/middleware/validation/conversation.schema.js` (NEW)
- [x] **Schemas:**
  - `listConversations` — `{ limit: Joi.number().max(100), offset }`
  - `transfer` — `{ to_user_id: Joi.string().uuid() }`

### T08.5 — Wire Validation to Routes
- [x] **File:** All route files (MODIFY)
- [x] **What:** Add `validate(schema)` middleware before controller in each route
