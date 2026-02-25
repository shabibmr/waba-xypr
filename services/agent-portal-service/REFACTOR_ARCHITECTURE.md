# Auth Controller Refactoring - Architecture Diagrams

## Current Architecture (BEFORE)

```
┌─────────────────────────────────────────────────────────────┐
│                    authController.js                         │
│                      (551 lines)                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         handleCallback (265 lines)                   │   │
│  │  • Exchange OAuth code                               │   │
│  │  • Call Genesys API for user info                    │   │
│  │  • Call Genesys API for org info                     │   │
│  │  • Call Tenant Service to provision                  │   │
│  │  • Call Agent.findOrCreateFromGenesys()              │   │
│  │  • Generate JWT tokens                               │   │
│  │  • Create session in DB                              │   │
│  │  • Build response HTML                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         demoLogin (75 lines)                         │   │
│  │  • Create demo user                                  │   │
│  │  • Generate JWT tokens                               │   │
│  │  • Create session                                    │   │
│  │  • Fetch WhatsApp config                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  + refreshToken, logout, logoutAll, getProfile...           │
│                                                               │
└───────────────────┬───────────────────────────────────────┘
                    │
          ┌─────────┴──────────┐
          ▼                     ▼
    ┌──────────┐         ┌──────────────┐
    │ Agent.js │         │ External APIs │
    │ (Model)  │         │ • Genesys    │
    └──────────┘         │ • Tenant Svc │
                         └──────────────┘

❌ Problems:
  • Single 551-line file
  • Mixed concerns (HTTP + Business Logic + External APIs)
  • Hard to test
  • Duplicated JWT generation code
  • No clear boundaries
```

---

## Proposed Architecture (AFTER)

```
┌──────────────────────────────────────────────────────────────────┐
│                     authController.js                             │
│                       (~150 lines)                                │
│                  THIN ORCHESTRATION LAYER                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  handleCallback (~40 lines) {                                     │
│    1. Validate request                                            │
│    2. genesysOAuthService.exchangeCodeForToken()                  │
│    3. genesysOAuthService.getUserAndOrganization()                │
│    4. tenantProvisioningService.provisionTenant()                 │
│    5. userProvisioningService.provisionUser()                     │
│    6. jwtService.generateTokenPair()                              │
│    7. sessionService.createSession()                              │
│    8. Send response                                               │
│  }                                                                 │
│                                                                    │
│  + Other thin controller methods...                               │
│                                                                    │
└────┬──────────┬──────────┬──────────┬──────────┬────────────────┘
     │          │          │          │          │
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
┌─────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
│Genesys  │ │Tenant  │ │  JWT   │ │Session │ │   User   │
│OAuth    │ │Prov.   │ │Service │ │Service │ │Prov.     │
│Service  │ │Service │ │        │ │        │ │Service   │
├─────────┤ ├────────┤ ├────────┤ ├────────┤ ├──────────┤
│• exchange│ │• prov- │ │• gen   │ │• create│ │• provision│
│  Code   │ │  ision │ │  Access│ │• inval.│ │• getProf│
│• getUser│ │  Tenant│ │• gen   │ │• refresh│ │• update │
│  Info   │ │• getOn-│ │  Refresh│ │• getAct│ │  Login  │
│• getOrg │ │  board.│ │• valid.│ │  ive   │ │         │
│  Info   │ │  Status│ │  Token │ │        │ │         │
└────┬────┘ └────┬───┘ └────────┘ └───┬────┘ └────┬─────┘
     │           │                     │           │
     │           │                     │           │
     ▼           ▼                     ▼           ▼
┌──────────────────────────────────────────────────────┐
│              Infrastructure Layer                     │
├──────────────────────────────────────────────────────┤
│ • Agent.js (Model)                                    │
│ • tokenBlacklist.js                                   │
│ • External APIs (Genesys, Tenant Service)             │
│ • Database (PostgreSQL)                               │
│ • Cache (Redis)                                       │
└──────────────────────────────────────────────────────┘

✅ Benefits:
  • Clear separation of concerns
  • Each service < 150 lines
  • Easy to unit test
  • Reusable services
  • Single Responsibility Principle
```

---

## Request Flow Comparison

### BEFORE (Current)

```
HTTP Request
    │
    ▼
┌──────────────────────────────────────┐
│     authController.handleCallback    │
│                                       │
│  1. Parse request ────────────┐      │
│  2. Validate code             │      │
│  3. Call Genesys OAuth API    │      │
│  4. Parse token response      │      │
│  5. Call Genesys /users/me    │      │
│  6. Parse user response       │      │
│  7. Call Genesys /orgs/me     │      │
│  8. Parse org response        │      │
│  9. Call Tenant Service       │      │
│  10. Parse tenant response    │      │
│  11. Call Agent.findOrCreate  │      │
│  12. Call Agent.updateLogin   │      │
│  13. Generate access token    │  ALL IN ONE
│  14. Generate refresh token   │  FUNCTION!
│  15. Call Agent.createSession │      │
│  16. Build response payload   │      │
│  17. Build HTML response      │      │
│  18. Send response            │      │
│  19. Handle errors            │      │
│  20. Log everything           │      │
└───────────────────────────────┘      │
                                       │
                              265 LINES!
```

### AFTER (Proposed)

```
HTTP Request
    │
    ▼
┌──────────────────────────────────────────────────────┐
│         authController.handleCallback                 │
│                                                        │
│  1. Validate request                                  │
│     ↓                                                  │
│  2. genesysOAuthService.exchangeCodeForToken()   ────┼──→ GenesysOAuthService
│     ↓                                                  │       • Handles all Genesys API calls
│  3. genesysOAuthService.getUserAndOrganization() ────┼──→    • Error handling
│     ↓                                                  │       • Response parsing
│  4. tenantProvisioningService.provisionTenant()  ────┼──→ TenantProvisioningService
│     ↓                                                  │       • Tenant Service API call
│  5. userProvisioningService.provisionUser()      ────┼──→ UserProvisioningService
│     ↓                                                  │       • Agent model operations
│  6. jwtService.generateTokenPair()               ────┼──→ JWTService
│     ↓                                                  │       • Token generation logic
│  7. sessionService.createSession()               ────┼──→ SessionService
│     ↓                                                  │       • DB + blacklist operations
│  8. sendOAuthSuccessResponse()                        │
└────────────────────────────────────────────────────────┘
                                                    ~40 LINES!

Each service is:
✅ Independently testable
✅ Reusable
✅ Single responsibility
✅ Easy to mock
```

---

## Data Flow

### OAuth Callback Flow (AFTER)

```
┌─────────┐
│ Browser │
└────┬────┘
     │ 1. GET /auth/callback?code=ABC123
     ▼
┌─────────────────────┐
│  authController     │
│  handleCallback()   │
└──────┬──────────────┘
       │
       │ 2. exchangeCodeForToken(code)
       ▼
┌────────────────────────┐
│ GenesysOAuthService    │ ────→ Genesys OAuth API
├────────────────────────┤       POST /oauth/token
│ • Validates response   │       Returns: access_token
│ • Handles errors       │
└──────┬─────────────────┘
       │ Returns: accessToken
       ▼
┌─────────────────────┐
│  authController     │
└──────┬──────────────┘
       │
       │ 3. getUserAndOrganization(accessToken)
       ▼
┌────────────────────────┐
│ GenesysOAuthService    │ ────→ Genesys API
├────────────────────────┤       GET /users/me
│ • Parallel API calls   │       GET /organizations/me
│ • Combines responses   │
└──────┬─────────────────┘
       │ Returns: { user, organization }
       ▼
┌─────────────────────┐
│  authController     │
└──────┬──────────────┘
       │
       │ 4. provisionTenant(orgId, orgName, region)
       ▼
┌──────────────────────────┐
│ TenantProvisioningService│ ────→ Tenant Service API
├──────────────────────────┤       POST /tenants/provision/genesys
│ • Find or create tenant  │       Returns: tenant
└──────┬───────────────────┘
       │ Returns: { tenantId, isNew, ... }
       ▼
┌─────────────────────┐
│  authController     │
└──────┬──────────────┘
       │
       │ 5. provisionUser(genesysUser, tenantId)
       │ 6. updateLastLogin(userId)
       ▼
┌──────────────────────────┐
│ UserProvisioningService  │ ────→ Agent Model (DB)
├──────────────────────────┤       findOrCreateFromGenesys()
│ • Auto-provision user    │       updateLastLogin()
└──────┬───────────────────┘
       │ Returns: user
       ▼
┌─────────────────────┐
│  authController     │
└──────┬──────────────┘
       │
       │ 7. generateTokenPair(userId, tenantId, role)
       ▼
┌──────────────────────┐
│    JWTService        │
├──────────────────────┤
│ • Generate access    │
│ • Generate refresh   │
└──────┬───────────────┘
       │ Returns: { accessToken, refreshToken, expiresIn }
       ▼
┌─────────────────────┐
│  authController     │
└──────┬──────────────┘
       │
       │ 8. createSession(userId, tokens, metadata)
       ▼
┌──────────────────────┐
│   SessionService     │ ────→ Agent Model (DB)
├──────────────────────┤       createSession()
│ • Store in database  │
└──────┬───────────────┘
       │ Returns: session
       ▼
┌─────────────────────┐
│  authController     │ ────→ Build HTML response with postMessage
└──────┬──────────────┘
       │ 9. Send response
       ▼
┌─────────┐
│ Browser │ ← window.postMessage({ type: 'GENESYS_AUTH_SUCCESS', ... })
└─────────┘
```

---

## Service Dependencies

```
┌────────────────────────────────────────────────────────────┐
│                     authController                          │
│                  (Orchestration Layer)                      │
└─┬────────┬─────────┬─────────┬─────────┬─────────────────┘
  │        │         │         │         │
  │        │         │         │         │
  ▼        ▼         ▼         ▼         ▼
┌──────┐ ┌──────┐ ┌─────┐ ┌─────────┐ ┌──────────┐
│Genesys│ │Tenant│ │ JWT │ │ Session │ │   User   │
│OAuth  │ │Prov. │ │     │ │         │ │  Prov.   │
└──┬────┘ └──┬───┘ └─────┘ └────┬────┘ └─────┬────┘
   │         │                   │            │
   │         │                   │            │
   ▼         ▼                   ▼            ▼
┌─────────────────────────────────────────────────┐
│          Infrastructure Layer                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  • axios (HTTP client)                           │
│  • jsonwebtoken (JWT)                            │
│  • config (Environment)                          │
│  • logger (Logging)                              │
│  • Agent model (Database)                        │
│  • tokenBlacklist (Redis)                        │
│                                                  │
└─────────────────────────────────────────────────┘

No circular dependencies ✅
Clear hierarchy ✅
Easy to mock ✅
```

---

## Error Handling Strategy

### BEFORE

```javascript
// Scattered throughout 265-line function
try {
  tokenResponse = await axios.post(...);
  logger.info('Token exchange successful');
} catch (tokenError) {
  logger.error('Token exchange failed', { ... });
  throw tokenError;
}

try {
  userResponse = await axios.get(...);
  logger.info('Genesys user info retrieved');
} catch (userError) {
  logger.error('Failed to fetch Genesys user info');
  throw userError;
}

// ... 8 more try-catch blocks!
```

### AFTER

```javascript
// Service handles its own errors
class GenesysOAuthService {
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(...);
      return response.data.access_token;
    } catch (error) {
      logger.error('Token exchange failed', { error });
      throw new AppError(
        'Failed to exchange OAuth code',
        502,
        ERROR_CODES.GENESYS_OAUTH_FAILED
      );
    }
  }
}

// Controller has clean error handling
async function handleCallback(req, res) {
  try {
    // ... orchestration ...
    sendOAuthSuccessResponse(res, ...);
  } catch (error) {
    sendOAuthErrorResponse(res, error);
  }
}
```

---

## Testing Strategy

### Unit Tests (Easy with Services)

```javascript
// services/auth/genesysOAuth.service.test.js
describe('GenesysOAuthService', () => {
  it('should exchange code for token', async () => {
    // Mock axios
    axios.post.mockResolvedValue({ data: { access_token: 'token123' } });

    const service = new GenesysOAuthService();
    const token = await service.exchangeCodeForToken('code123');

    expect(token).toBe('token123');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/oauth/token'),
      expect.any(URLSearchParams),
      expect.any(Object)
    );
  });

  it('should throw AppError on failure', async () => {
    axios.post.mockRejectedValue(new Error('Network error'));

    const service = new GenesysOAuthService();

    await expect(service.exchangeCodeForToken('code123'))
      .rejects
      .toThrow(AppError);
  });
});
```

### Integration Tests (Controller)

```javascript
// controllers/authController.test.js
describe('POST /auth/callback', () => {
  it('should complete OAuth flow', async () => {
    // Mock all services
    genesysOAuthService.exchangeCodeForToken.mockResolvedValue('token123');
    genesysOAuthService.getUserAndOrganization.mockResolvedValue({...});
    // ... mock other services ...

    const response = await request(app)
      .get('/auth/callback?code=ABC123')
      .expect(200);

    expect(response.text).toContain('GENESYS_AUTH_SUCCESS');
  });
});
```

---

## Code Metrics Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **authController.js lines** | 551 | ~150 | 73% reduction |
| **Largest function lines** | 265 | ~40 | 85% reduction |
| **# of external API calls in controller** | 5 | 0 | 100% encapsulated |
| **# of try-catch blocks in controller** | 10+ | 2 | 80% reduction |
| **Cyclomatic complexity** | ~45 | ~8 | 82% reduction |
| **Unit testable components** | 1 (controller) | 6 (services) | 6x increase |
| **Files under 200 lines** | 0/1 | 6/6 | 100% compliance |

---

## Questions to Discuss

1. **Service instantiation**: Singleton (like RabbitMQ) or new instance per request?
   - **Recommendation**: Singleton (stateless services)

2. **Config injection**: Pass config to constructors or import globally?
   - **Recommendation**: Import globally (consistent with current codebase)

3. **Should we extract response builders** (`sendOAuthSuccessResponse`, `sendOAuthErrorResponse`)?
   - **Recommendation**: Yes, create `utils/responseHelpers.js`

4. **Logging level**: Services log at `info` level or only `error`?
   - **Recommendation**: Services log errors, controller logs workflow steps at `info`

5. **Should SessionService integrate tokenBlacklist** or keep separate?
   - **Recommendation**: Integrate (SessionService owns full session lifecycle)

---

## Ready to proceed?

Please review and let me know:
- ✅ Approve and start implementation
- 🔄 Request changes (what would you like different?)
- ❓ Questions (what needs clarification?)
