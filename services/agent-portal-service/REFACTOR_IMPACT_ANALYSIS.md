# Auth Controller Refactoring - Impact Analysis

## Executive Summary

**Impact on agent-portal (React frontend):** ⚠️ **HIGH** - Heavy dependency on auth endpoints
**Impact on agent-widget:** ✅ **NONE** - No dependencies (uses Genesys OAuth directly)

**Risk Level:** 🟡 **MEDIUM** if we maintain API contracts (recommended)
**Risk Level:** 🔴 **HIGH** if we change response formats or endpoints

---

## Service Dependencies Overview

```
┌─────────────────────────────────────────────────────────────┐
│           agent-portal (React Frontend)                      │
│                                                               │
│  ✓ Uses ALL 6 auth endpoints                                │
│  ✓ OAuth popup + window.postMessage flow                     │
│  ✓ JWT token storage in sessionStorage                       │
│  ✓ Auto token refresh (5 min before expiry)                  │
│  ✓ Axios interceptor for 401 handling                        │
│                                                               │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ HTTP API Calls
                   ▼
┌─────────────────────────────────────────────────────────────┐
│      agent-portal-service/authController.js                  │
│                                                               │
│  • GET  /api/agents/auth/login                               │
│  • GET  /api/agents/auth/callback                            │
│  • POST /api/agents/auth/refresh                             │
│  • POST /api/agents/auth/logout                              │
│  • POST /api/agents/auth/logout-all                          │
│  • GET  /api/agents/profile                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              agent-widget (Backend Service)                  │
│                                                               │
│  ✗ Does NOT use agent-portal-service auth                    │
│  ✓ Uses Genesys OAuth directly (implicit flow)              │
│  ✓ Authenticates via X-Tenant-ID header                     │
│  ✓ No JWT tokens from our system                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘

**Conclusion:** Only agent-portal frontend is affected by refactoring.
```

---

## Critical API Contracts (MUST MAINTAIN)

### 1. OAuth Callback Response - `POST /api/agents/auth/callback`

**Current Implementation:** `authController.js:272-281`

**Frontend Expectation:** HTML page with `window.postMessage` script

```html
<!DOCTYPE html>
<html>
<head><title>Authenticating...</title></head>
<body>
<script>
  (function() {
    var data = {
      "type": "GENESYS_AUTH_SUCCESS",
      "accessToken": "...",
      "refreshToken": "...",
      "expiresIn": 3600,
      "isNewTenant": false,
      "onboardingCompleted": true,
      "genesysOrg": {
        "name": "...",
        "domain": "...",
        "id": "..."
      },
      "agent": {
        "user_id": "...",
        "name": "...",
        "email": "...",
        "role": "...",
        "tenant_id": "...",
        "isNewTenant": false,
        "onboardingCompleted": true
      }
    };
    window.opener.postMessage(data, '*');
    window.close();
  })();
</script>
<p>Authentication successful. This window should close automatically.</p>
</body>
</html>
```

**Frontend Handler:** `agent-portal/src/components/AuthCallback.jsx:28-67`

```javascript
const handleMessage = (event) => {
  if (event.data.type === 'GENESYS_AUTH_SUCCESS') {
    const { accessToken, refreshToken, agent, genesysOrg, isNewTenant, onboardingCompleted } = event.data;
    // Store tokens, update auth state, redirect...
  } else if (event.data.type === 'GENESYS_AUTH_ERROR') {
    // Handle error
  }
};
window.addEventListener('message', handleMessage);
```

**⚠️ BREAKING CHANGES:**
- ❌ Returning JSON instead of HTML
- ❌ Changing message `type` field
- ❌ Renaming `agent` → `user`
- ❌ Renaming `accessToken` → `access_token`
- ❌ Changing `window.opener.postMessage` to direct redirect
- ❌ Removing `genesysOrg` object

---

### 2. Token Refresh Response - `POST /api/agents/auth/refresh`

**Current Implementation:** `authController.js:329`

**Response Format:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 3600
}
```

**Frontend Usage:** `agent-portal/src/services/authService.js:209-228`

```javascript
async refreshAccessToken(refreshToken) {
  const response = await axios.post('/api/agents/auth/refresh', { refreshToken });
  const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
  this.setToken(accessToken);
  this.setRefreshToken(newRefreshToken);
  return { accessToken, refreshToken: newRefreshToken, expiresIn };
}
```

**⚠️ BREAKING CHANGES:**
- ❌ Using snake_case: `access_token`, `refresh_token`, `expires_in`
- ❌ Changing field names
- ❌ Returning different structure

---

### 3. Profile Response - `GET /api/agents/profile`

**Current Implementation:** `authController.js:437-456`

**Response Format:**
```json
{
  "user_id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "admin",
  "tenant_id": "tenant-001",
  "created_at": "2024-01-01T00:00:00Z",
  "last_login_at": "2024-01-15T10:30:00Z",
  "organization": {
    "tenant_id": "tenant-001",
    "tenant_name": "Acme Corp",
    "whatsapp": {
      "connected": true,
      "phone_number": "+1234567890",
      "waba_id": "123456789"
    }
  }
}
```

**Frontend Usage:** `agent-portal/src/contexts/AuthContext.jsx:146-162`

```javascript
const profile = await authService.getProfile();
setUser({
  ...user,
  name: profile.name,
  email: profile.email,
  role: profile.role,
  organization: profile.organization
});
```

**⚠️ BREAKING CHANGES:**
- ❌ Flattening `organization.whatsapp` structure
- ❌ Renaming nested fields
- ❌ Removing `organization` wrapper

---

### 4. JWT Token Structure

**Current Implementation:** `authController.js:223-232`

**JWT Payload:**
```json
{
  "userId": "uuid",
  "tenantId": "tenant-001",
  "role": "admin",
  "type": "access",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Frontend Token Parsing:** `agent-portal/src/contexts/AuthContext.jsx:84-102`

```javascript
const decoded = jwtDecode(token);
const expiryTime = decoded.exp * 1000; // Convert seconds to milliseconds
const refreshTime = expiryTime - (5 * 60 * 1000); // 5 min before expiry
```

**⚠️ BREAKING CHANGES:**
- ❌ Changing `exp` to milliseconds (should be Unix timestamp in seconds)
- ❌ Removing `userId`, `tenantId`, or `role` claims
- ❌ Changing claim names (userId → user_id)

---

### 5. Error Response Format

**Current Implementation:** Mixed formats in `authController.js`

**Format 1 (String):**
```json
{
  "error": "No authorization code"
}
```

**Format 2 (Object):**
```json
{
  "error": {
    "message": "Invalid token",
    "code": "AUTH_001"
  }
}
```

**Frontend Error Handling:** `agent-portal/src/services/authService.js:145-160`

```javascript
catch (error) {
  const message = error.response?.data?.error?.message
    || error.response?.data?.error
    || error.message;
  throw new Error(message);
}
```

**⚠️ BREAKING CHANGES:**
- ❌ Moving error to `response.data.message` (not `response.data.error`)
- ❌ Changing to snake_case `error_message`

---

## Axios Interceptor Dependencies

**File:** `agent-portal/src/services/axiosInterceptor.js`

**Auto Token Refresh on 401:**

```javascript
axiosInstance.interceptors.response.use(
  response => response,
  async (error) => {
    if (error.response?.status === 401) {
      const originalRequest = error.config;

      // Skip retry for auth endpoints
      if (originalRequest.url.includes('/auth/login') ||
          originalRequest.url.includes('/auth/callback') ||
          originalRequest.url.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      // Try to refresh token
      const refreshToken = authService.getRefreshToken();
      if (refreshToken && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const { accessToken } = await authService.refreshAccessToken(refreshToken);
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          // Logout on refresh failure
          authService.logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }
    return Promise.reject(error);
  }
);
```

**Dependencies on Backend:**
- Backend MUST return 401 for expired/invalid tokens
- Backend MUST accept `POST /api/agents/auth/refresh` with `{ refreshToken }`
- Refresh endpoint MUST return new `accessToken` and `refreshToken`

---

## Session Storage Keys

**Frontend Storage:** `sessionStorage` (NOT localStorage)

**Keys Used:**
```javascript
// Token storage
sessionStorage.setItem('agent_access_token', accessToken);
sessionStorage.setItem('agent_refresh_token', refreshToken);

// User data
sessionStorage.setItem('agent_info', JSON.stringify(agent));

// OAuth PKCE
sessionStorage.setItem('pkce_code_verifier', codeVerifier);

// Organization data
sessionStorage.setItem('genesys_org', JSON.stringify(genesysOrg));
```

**Backend Session Table:**
- Backend stores sessions in `genesys_user_sessions` table
- Contains: `user_id`, `access_token`, `refresh_token`, `expires_at`, `ip_address`, `user_agent`
- Used for logout/logout-all functionality

**⚠️ IMPORTANT:**
- Frontend does NOT send session ID (uses JWT tokens only)
- Backend session is for tracking, NOT for stateful auth
- Token blacklist (`tokenBlacklist.js`) is used for logout

---

## Authentication State Management

**AuthContext Flow:**

```javascript
// 1. Initialize from sessionStorage
useEffect(() => {
  const token = sessionStorage.getItem('agent_access_token');
  const userInfo = JSON.parse(sessionStorage.getItem('agent_info') || '{}');

  if (token && isTokenValid(token)) {
    setUser(userInfo);
    setToken(token);
    setIsAuthenticated(true);
    scheduleTokenRefresh(token);
  }
}, []);

// 2. Auto-refresh before expiry
const scheduleTokenRefresh = (token) => {
  const decoded = jwtDecode(token);
  const expiryTime = decoded.exp * 1000;
  const refreshTime = expiryTime - (5 * 60 * 1000); // 5 min buffer
  const timeout = refreshTime - Date.now();

  if (timeout > 0) {
    setTimeout(async () => {
      try {
        await refreshAccessToken();
      } catch (error) {
        logout();
      }
    }, timeout);
  }
};

// 3. Logout clears everything
const logout = async () => {
  await authService.logout();
  sessionStorage.removeItem('agent_access_token');
  sessionStorage.removeItem('agent_refresh_token');
  sessionStorage.removeItem('agent_info');
  sessionStorage.removeItem('genesys_org');
  setUser(null);
  setToken(null);
  setIsAuthenticated(false);
};
```

**Backend Expectations:**
- JWT must include `exp` claim (Unix timestamp in seconds)
- Token refresh must return both new access and refresh tokens
- Logout must invalidate token in blacklist

---

## Refactoring Safety Checklist

### ✅ SAFE Changes (Will NOT Break Frontend)

- ✅ Extract services (GenesysOAuthService, JWTService, etc.)
- ✅ Add unit tests for services
- ✅ Improve error handling internally
- ✅ Add logging/monitoring
- ✅ Optimize database queries
- ✅ Refactor internal helper functions
- ✅ Add TypeScript types (if converting to TS)
- ✅ Extract response builder functions
- ✅ Improve code organization
- ✅ Add new optional response fields (frontend ignores unknown fields)

### ⚠️ RISKY Changes (Require Frontend Updates)

- ⚠️ Change endpoint URLs (`/api/agents/auth/*` → `/api/v1/auth/*`)
- ⚠️ Add required request headers
- ⚠️ Change token expiry format
- ⚠️ Add required request body fields
- ⚠️ Change session cookie behavior
- ⚠️ Modify CORS policy

### ❌ BREAKING Changes (WILL Break Frontend)

- ❌ Change response field names (`accessToken` → `access_token`)
- ❌ Remove response fields (e.g., `genesysOrg`)
- ❌ Change OAuth callback to return JSON instead of HTML
- ❌ Modify `window.postMessage` event structure
- ❌ Change JWT payload structure
- ❌ Flatten nested objects in responses
- ❌ Change error response format
- ❌ Change HTTP status codes (e.g., 401 → 403 for expired tokens)

---

## Recommended Refactoring Approach

### Phase 1: Internal Refactoring (Zero Frontend Impact) ✅

**Extract services internally while maintaining exact API contract:**

```javascript
// OLD: authController.js
async function handleCallback(req, res, next) {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'No authorization code' });
    }

    // ... 265 lines of code ...

    res.send(`<!DOCTYPE html>...`); // Exact same HTML response
  } catch (error) {
    // ... error handling ...
  }
}

// NEW: authController.js (refactored)
async function handleCallback(req, res, next) {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'No authorization code' }); // UNCHANGED
    }

    // 1. Use services internally
    const accessToken = await genesysOAuthService.exchangeCodeForToken(code, config.genesys.redirectUri);
    const { user, organization } = await genesysOAuthService.getUserAndOrganization(accessToken, config.genesys.region);
    const tenant = await tenantProvisioningService.provisionTenant(organization.id, organization.name, config.genesys.region);
    const provisionedUser = await userProvisioningService.provisionUser(user, tenant.tenantId);
    const tokens = jwtService.generateTokenPair(provisionedUser.user_id, provisionedUser.tenant_id, provisionedUser.role);
    await sessionService.createSession(provisionedUser.user_id, tokens.accessToken, tokens.refreshToken, { ip: req.ip, userAgent: req.get('user-agent') });

    // 2. Build EXACT SAME response format
    const payload = {
      type: 'GENESYS_AUTH_SUCCESS', // UNCHANGED
      accessToken: tokens.accessToken, // UNCHANGED (camelCase)
      refreshToken: tokens.refreshToken, // UNCHANGED
      expiresIn: tokens.expiresIn, // UNCHANGED
      isNewTenant: tenant.isNew || false, // UNCHANGED
      onboardingCompleted: tenant.onboardingCompleted || false, // UNCHANGED
      genesysOrg: { // UNCHANGED
        name: organization.name,
        domain: organization.domain,
        id: organization.id
      },
      agent: { // UNCHANGED (not "user")
        user_id: provisionedUser.user_id,
        name: provisionedUser.name,
        email: provisionedUser.genesys_email,
        role: provisionedUser.role,
        tenant_id: provisionedUser.tenant_id,
        isNewTenant: tenant.isNew || false,
        onboardingCompleted: tenant.onboardingCompleted || false
      }
    };

    // 3. Send EXACT SAME HTML response
    res.send(`<!DOCTYPE html><html><head><title>Authenticating...</title></head><body>
<script>
  (function() {
    var data = ${JSON.stringify(payload)};
    window.opener.postMessage(data, '*');
    window.close();
  })();
</script>
<p>Authentication successful. This window should close automatically.</p>
</body></html>`); // UNCHANGED
  } catch (error) {
    // ... UNCHANGED error handling ...
  }
}
```

**Result:**
- ✅ Controller is ~40 lines instead of 265
- ✅ Business logic in testable services
- ✅ Zero frontend changes needed
- ✅ API contract 100% preserved

---

### Phase 2: Add Versioning (Optional, Future)

If you ever need to change the API:

1. Keep `POST /api/agents/auth/callback` working (v1)
2. Add `POST /api/v2/auth/callback` with new format
3. Update frontend to use v2 when ready
4. Deprecate v1 after migration period

---

## Testing Requirements

### Unit Tests (Services)

```javascript
describe('GenesysOAuthService', () => {
  it('should return access token on successful exchange', async () => {
    // Mock axios
    // Assert response format
  });
});

describe('JWTService', () => {
  it('should generate token with correct payload structure', () => {
    const token = jwtService.generateAccessToken({ userId: '123', tenantId: 'tenant-001', role: 'admin' });
    const decoded = jwt.decode(token);
    expect(decoded).toHaveProperty('userId');
    expect(decoded).toHaveProperty('tenantId');
    expect(decoded).toHaveProperty('role');
    expect(decoded).toHaveProperty('type', 'access');
    expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
  });
});
```

### Integration Tests (API Contract)

```javascript
describe('POST /api/agents/auth/callback', () => {
  it('should return HTML with window.postMessage script', async () => {
    const response = await request(app)
      .get('/api/agents/auth/callback?code=ABC123')
      .expect(200)
      .expect('Content-Type', /html/);

    expect(response.text).toContain('window.opener.postMessage');
    expect(response.text).toContain('GENESYS_AUTH_SUCCESS');

    // Parse JSON from script
    const match = response.text.match(/var data = ({.*?});/s);
    const data = JSON.parse(match[1]);

    expect(data).toMatchObject({
      type: 'GENESYS_AUTH_SUCCESS',
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: expect.any(Number),
      agent: expect.objectContaining({
        user_id: expect.any(String),
        tenant_id: expect.any(String),
        role: expect.any(String)
      }),
      genesysOrg: expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String)
      })
    });
  });
});

describe('POST /api/agents/auth/refresh', () => {
  it('should return new tokens with correct field names', async () => {
    const response = await request(app)
      .post('/api/agents/auth/refresh')
      .send({ refreshToken: validRefreshToken })
      .expect(200);

    expect(response.body).toMatchObject({
      accessToken: expect.any(String),  // NOT access_token
      refreshToken: expect.any(String), // NOT refresh_token
      expiresIn: expect.any(Number)     // NOT expires_in
    });
  });
});
```

### Frontend Contract Tests

```javascript
// agent-portal/src/tests/authService.test.js
describe('authService API contract', () => {
  it('should handle OAuth callback message', () => {
    const message = {
      data: {
        type: 'GENESYS_AUTH_SUCCESS',
        accessToken: 'token123',
        refreshToken: 'refresh123',
        agent: { user_id: '1', name: 'Test', tenant_id: 't1', role: 'admin' },
        genesysOrg: { id: 'org1', name: 'Test Org' }
      }
    };

    // This should not throw
    expect(() => handleAuthMessage(message)).not.toThrow();
  });
});
```

---

## Migration Checklist

Before deploying refactored auth controller:

- [ ] All 6 endpoints return identical response formats
- [ ] OAuth callback returns HTML with postMessage (not JSON)
- [ ] JWT tokens have same payload structure
- [ ] Token expiry is in seconds (not milliseconds)
- [ ] Response field names are camelCase (not snake_case)
- [ ] Error responses maintain `{ error: ... }` format
- [ ] Integration tests pass for all auth endpoints
- [ ] Frontend auth flow works end-to-end in staging
- [ ] Token refresh auto-triggers 5 min before expiry
- [ ] Logout invalidates token in blacklist
- [ ] 401 responses trigger automatic token refresh

---

## Rollback Plan

If refactoring causes issues:

1. **Immediate:** Revert to previous `authController.js` (keep in git history)
2. **Database:** Sessions table unchanged, no migration needed
3. **Frontend:** No changes needed (API contract maintained)
4. **Monitoring:** Watch for increased 401 errors, failed logins

---

## Summary

**✅ SAFE TO REFACTOR** if you:
- Maintain exact API response formats
- Keep endpoint URLs unchanged
- Preserve OAuth popup + postMessage flow
- Maintain JWT payload structure
- Test thoroughly before deploying

**❌ DO NOT:**
- Change response field names (accessToken → access_token)
- Return JSON from OAuth callback (must be HTML)
- Modify window.postMessage event structure
- Change JWT expiry format (must be Unix seconds)
- Remove or rename response fields

**📋 Files to Monitor During Refactoring:**

Backend:
- `services/agent-portal-service/src/controllers/authController.js`
- `services/agent-portal-service/src/routes/agentRoutes.js`
- `services/agent-portal-service/src/middleware/authenticate.js`

Frontend (DO NOT MODIFY):
- `services/agent-portal/src/services/authService.js`
- `services/agent-portal/src/contexts/AuthContext.jsx`
- `services/agent-portal/src/services/axiosInterceptor.js`
- `services/agent-portal/src/components/AuthCallback.jsx`

**Agent-widget:** ✅ No impact whatsoever

---

**Ready to refactor?** Follow the recommended approach in Phase 1 and you'll have zero frontend impact! 🎯
