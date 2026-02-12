# 03 — Security Hardening

> **FRD Reference:** Section 9 (Security), Lines 2700-3000
> **Priority:** 🔴 High — MVP Phase 2

---

## Gap Summary

| Feature | FRD | Code | Gap |
|---------|-----|------|-----|
| Helmet security headers | ✅ | ❌ | Not installed or used |
| CORS strict origin | ✅ | 🟡 | `cors()` used but only `frontend.url` |
| Rate limiting (express-rate-limit) | ✅ | ❌ | Not implemented |
| Per-route rate limits | ✅ | ❌ | Not implemented |
| CSRF protection | ✅ | ❌ | Not implemented |
| Session cookie config (httpOnly, secure, sameSite) | ✅ | ❌ | JWT in body, no cookies used |
| Encryption for sensitive data (AES-256-GCM) | ✅ | ❌ | No encryption utility |
| Request ID middleware | ✅ | ❌ | Not implemented |
| Tenant isolation enforcement | ✅ | 🟡 | Via JWT tenant claim, no middleware guard |

---

## Tasks

### T03.1 — Add Helmet Middleware
- **File:** `src/index.js` (MODIFY)
- **What:** `app.use(helmet())` with FRD-specified options
- **Install:** `helmet`

### T03.2 — Enhance CORS Configuration
- **File:** `src/index.js` (MODIFY)
- **What:** Allow multiple origins (frontend + admin), credentials: true

### T03.3 — Add Rate Limiting Middleware
- **File:** `src/middleware/rateLimiter.js` (NEW)
- **What:** Global limiter (100 req/15min) + auth limiter (5 req/15min for login)
- **Install:** `express-rate-limit`

### T03.4 — Per-Route Rate Limits
- **File:** Various routes (MODIFY)
- **What:** Apply tighter limits on auth, send-message, upload

### T03.5 — Add Request ID Middleware
- **File:** `src/middleware/requestId.js` (NEW)
- **What:** Generate UUID for each request, attach to `req.id`, include in logs

### T03.6 — Tenant Isolation Middleware
- **File:** `src/middleware/tenantGuard.js` (NEW)
- **What:** Ensure `req.tenantId` matches resource's tenant for all data queries

### T03.7 — Encryption Utility for Sensitive Data
- **File:** `src/utils/encryption.js` (NEW)
- **What:** AES-256-GCM for encrypting stored tokens (WhatsApp access_token, etc.)
- **FRD specifies:** `ENCRYPTION_KEY` env var

### T03.8 — Secure Cookie Configuration
- **File:** `src/controllers/authController.js` (MODIFY)
- **What:** Set JWT in httpOnly, secure, sameSite cookie instead of body
- **Note:** Requires frontend changes

### T03.9 — CSRF Protection
- **File:** `src/middleware/csrf.js` (NEW)
- **What:** Add CSRF token generation and validation for state-changing routes
- **Install:** `csurf` or custom implementation
