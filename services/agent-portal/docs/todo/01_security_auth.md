# Task File 01: Security & Authentication

**Priority**: 🔴 CRITICAL
**Depends on**: Nothing (must be done first)
**Blocks**: All other tasks (auth is foundational)
**Estimated effort**: 1 week

---

## Context

The FRD mandates PKCE-protected OAuth 2.0 and HTTP-only cookies for token storage.
Current implementation uses `localStorage` for tokens (XSS risk) and has no PKCE flow.

**Relevant files**:
- `src/services/authService.js` — token management, OAuth initiation
- `src/contexts/AuthContext.jsx` — token state, auto-refresh
- `src/hooks/useAuth.js` — auth hook
- `src/components/AuthCallback.jsx` — OAuth redirect handler
- `src/pages/Login.jsx` — login UI
- Backend: `../agent-portal-service/src/controllers/authController.js`
- Backend: `../agent-portal-service/src/routes/agentRoutes.js`

---

## Tasks

### S-01 — Fix token storage (localStorage → memory/sessionStorage)
**Status**: ❌ Missing
**FRD Reference**: Section 5 — "Session token in memory, NEVER localStorage"

**Problem**: `authService.js` writes `accessToken`, `refreshToken`, `userId`, `tenantId` directly to `localStorage`. This exposes them to any JavaScript on the page.

**Action**:
- Store `accessToken` in-memory only (React context state, not persisted)
- Store `refreshToken` in `sessionStorage` (tab-scoped) OR rely on backend HTTP-only cookie
- Remove all `localStorage.setItem/getItem` for token keys
- Update `AuthContext.jsx` to hold token only in state variable
- Update `axiosInterceptor.js` to read from context/memory rather than localStorage

**Files to change**: `authService.js`, `AuthContext.jsx`, `axiosInterceptor.js`

---

### S-02 — Implement PKCE for Genesys OAuth
**Status**: ❌ Missing
**FRD Reference**: Section 5 — "Authorization Code with PKCE (RFC 7636)"

**Action**: Create `src/lib/pkce.ts`:
```typescript
export function generateCodeVerifier(): string {
  // 43-128 char URL-safe random string (crypto.getRandomValues)
}
export async function generateCodeChallenge(verifier: string): Promise<string> {
  // SHA-256 hash of verifier, base64url encoded
}
```

**OAuth flow change in `authService.js`**:
1. Generate `codeVerifier` before redirect
2. Store `codeVerifier` in `sessionStorage` (temp, ephemeral)
3. Compute `codeChallenge = SHA256(codeVerifier)` base64url
4. Append `code_challenge` + `code_challenge_method=S256` to auth URL
5. In callback, send `code_verifier` to backend token exchange
6. Clear `codeVerifier` from sessionStorage after use

**Files to create**: `src/lib/pkce.ts`
**Files to change**: `src/services/authService.js`

---

### S-03 — Backend: validate code_verifier in token exchange
**Status**: ❌ Missing
**FRD Reference**: Section 5 — PKCE RFC 7636 server-side validation

**Action** in `authController.js`:
- Accept `code_verifier` in callback POST body
- Pass it to Genesys token exchange request
- Return error if missing (once PKCE is enforced end-to-end)

**Files to change**: `../agent-portal-service/src/controllers/authController.js`

---

### S-04 — Add session expiry warning UI
**Status**: ❌ Missing
**FRD Reference**: Section 5 — "Display warning 5 minutes before token expiry"

**Action**:
- In `AuthContext.jsx`, when refresh timer fires with < 5 min remaining, emit a warning state flag
- Show a dismissible banner/toast: "Your session expires in 5 minutes. Click to extend."
- On click → trigger token refresh immediately

**Files to change**: `src/contexts/AuthContext.jsx`
**Files to create**: No new file needed — add to existing toast logic

---

### S-05 — Input sanitization
**Status**: ❌ Missing
**FRD Reference**: Section 11 — "DOMPurify for user-generated content"

**Action**:
- Install `dompurify` package
- Create `src/lib/security.ts` with `sanitize(html: string)` wrapper
- Apply to any field that renders user-supplied content (conversation messages, names)

**Files to create**: `src/lib/security.ts`
**Package**: `npm install dompurify @types/dompurify`

---

### S-06 — Backend: rate limiting on auth endpoints
**Status**: ❌ Missing
**FRD Reference**: Section 11 — "Rate limiting on auth endpoints"

**Action** in `agent-portal-service`:
- Install `express-rate-limit`
- Apply `rateLimit({ windowMs: 15*60*1000, max: 10 })` to login/callback routes
- Apply `rateLimit({ windowMs: 60*1000, max: 5 })` to refresh endpoint

**Files to change**: `../agent-portal-service/src/routes/agentRoutes.js`

---

### S-07 — Verify logout clears all session data
**Status**: ⚠️ Partial
**FRD Reference**: Section 5 — "Logout clears all tokens, redirects to login"

**Action**:
- Confirm `logout()` in `authService.js` clears: memory token, sessionStorage, cookie (if backend sets one)
- Ensure `AuthContext` resets all state to null on logout
- Ensure axios interceptor removes Authorization header after logout

**Files to change**: `src/services/authService.js`, `src/contexts/AuthContext.jsx`

---

## Acceptance Criteria

- [ ] `localStorage` contains no tokens after login
- [ ] Genesys OAuth URL includes `code_challenge` parameter
- [ ] App refreshes token in background 5 min before expiry
- [ ] Session expiry warning banner visible in UI
- [ ] Logout removes all auth data from client
- [ ] Auth endpoints return 429 after burst threshold
