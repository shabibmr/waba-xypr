# Auth Controller Refactoring Plan

## Current State Analysis

### authController.js Responsibilities (TOO MANY!)
1. ✓ HTTP request/response handling
2. ✗ Genesys OAuth token exchange
3. ✗ Genesys user info fetching
4. ✗ Genesys organization info fetching
5. ✗ Tenant provisioning API calls
6. ✗ JWT token generation
7. ✗ JWT token validation
8. ✗ Session creation/management
9. ✗ Token blacklisting
10. ✗ User auto-provisioning
11. ✗ WhatsApp config fetching
12. ✗ Detailed logging at every step

### Lines of Code by Function
- `handleCallback`: ~265 lines (MASSIVE - should be <50)
- `demoLogin`: ~75 lines
- `getProfile`: ~42 lines
- `logoutAll`: ~45 lines
- `logout`: ~25 lines
- `refreshToken`: ~33 lines
- `initiateLogin`: ~19 lines

---

## Proposed Architecture

### 1. GenesysOAuthService (`services/auth/genesysOAuth.service.js`)
**Responsibility**: All Genesys Cloud API interactions

```javascript
class GenesysOAuthService {
  // Exchange OAuth code for access token
  async exchangeCodeForToken(code, redirectUri)

  // Get user info from Genesys
  async getUserInfo(accessToken)

  // Get organization info from Genesys
  async getOrganizationInfo(accessToken)

  // Combined: get user + org in one call
  async getUserAndOrganization(accessToken)
}
```

**Benefits:**
- Encapsulates all Genesys API complexity
- Easy to mock for testing
- Reusable across controllers
- Centralized error handling for Genesys API

**Extracted from:** `handleCallback` (lines 58-156)

---

### 2. TenantProvisioningService (`services/auth/tenantProvisioning.service.js`)
**Responsibility**: Tenant auto-provisioning logic

```javascript
class TenantProvisioningService {
  // Find or create tenant by Genesys org ID
  async provisionTenant(genesysOrgId, genesysOrgName, region)

  // Check if tenant is new and needs onboarding
  async getTenantOnboardingStatus(tenantId)
}
```

**Benefits:**
- Single place for tenant provisioning logic
- Can be used by other services (webhooks, admin tools)
- Easier to add additional provisioning steps

**Extracted from:** `handleCallback` (lines 169-203)

---

### 3. JWTService (`services/auth/jwt.service.js`)
**Responsibility**: JWT token generation and validation

```javascript
class JWTService {
  // Generate access token
  generateAccessToken(payload, expiresIn = 3600)

  // Generate refresh token
  generateRefreshToken(payload)

  // Validate and decode token
  validateToken(token, expectedType)

  // Generate both tokens at once
  generateTokenPair(userId, tenantId, role)
}
```

**Benefits:**
- Centralized token configuration
- Easy to switch JWT libraries or add encryption
- Consistent token structure across the app
- Type validation built-in

**Extracted from:** `handleCallback` (lines 219-232), `refreshToken` (lines 314-328), `demoLogin` (lines 488-499)

---

### 4. SessionService (`services/auth/session.service.js`)
**Responsibility**: User session lifecycle management

```javascript
class SessionService {
  // Create new session
  async createSession(userId, accessToken, refreshToken, metadata)

  // Invalidate single session
  async invalidateSession(userId, accessToken)

  // Invalidate all user sessions
  async invalidateAllSessions(userId)

  // Refresh session tokens
  async refreshSession(refreshToken)

  // Get active sessions for user
  async getActiveSessions(userId)
}
```

**Benefits:**
- Abstracts database session operations
- Integrates with token blacklist automatically
- Can add session analytics/monitoring easily
- Handles token expiry logic

**Extracted from:** `handleCallback` (lines 237-246), `logout` (lines 348-361), `logoutAll` (lines 379-414)

---

### 5. UserProvisioningService (`services/auth/userProvisioning.service.js`)
**Responsibility**: User auto-provisioning and profile management

```javascript
class UserProvisioningService {
  // Find or create user from Genesys OAuth data
  async provisionUser(genesysUser, tenantId)

  // Update last login timestamp
  async updateLastLogin(userId)

  // Get user profile with tenant/WhatsApp info
  async getUserProfile(userId)
}
```

**Benefits:**
- Separates user operations from auth flow
- Can be reused for user sync operations
- Cleaner separation from session management

**Extracted from:** `handleCallback` (lines 206-217), `getProfile` (lines 420-460)

---

## Refactored Controller Structure

### authController.js (Target: ~150 lines)

```javascript
// Thin orchestration only!

async function handleCallback(req, res, next) {
  try {
    const { code } = req.query;
    validateAuthCode(code);

    // 1. Exchange code for token
    const accessToken = await genesysOAuthService.exchangeCodeForToken(code);

    // 2. Get user and org info
    const { user, organization } = await genesysOAuthService.getUserAndOrganization(accessToken);

    // 3. Provision tenant
    const tenant = await tenantProvisioningService.provisionTenant(
      organization.id,
      organization.name,
      config.genesys.region
    );

    // 4. Provision user
    const provisionedUser = await userProvisioningService.provisionUser(user, tenant.tenantId);
    await userProvisioningService.updateLastLogin(provisionedUser.user_id);

    // 5. Generate tokens
    const tokens = jwtService.generateTokenPair(
      provisionedUser.user_id,
      provisionedUser.tenant_id,
      provisionedUser.role
    );

    // 6. Create session
    await sessionService.createSession(
      provisionedUser.user_id,
      tokens.accessToken,
      tokens.refreshToken,
      { ip: req.ip, userAgent: req.get('user-agent') }
    );

    // 7. Send response
    sendOAuthSuccessResponse(res, tokens, tenant, organization, provisionedUser);
  } catch (error) {
    sendOAuthErrorResponse(res, error);
  }
}
```

**Line count:** ~40 lines (down from ~265!)

---

## Migration Strategy

### Phase 1: Create Services (No Breaking Changes)
1. Create `services/auth/` directory
2. Implement `GenesysOAuthService`
3. Implement `JWTService`
4. Implement `TenantProvisioningService`
5. Implement `SessionService`
6. Implement `UserProvisioningService`
7. Add unit tests for each service

**Risk:** Low - No existing code changed

---

### Phase 2: Migrate Controller (Incremental)
1. Update `handleCallback` to use services
2. Update `refreshToken` to use services
3. Update `logout`/`logoutAll` to use services
4. Update `getProfile` to use services
5. Update `demoLogin` to use services

**Risk:** Medium - Requires careful testing

---

### Phase 3: Cleanup
1. Remove duplicated code
2. Add integration tests
3. Update documentation
4. Remove old commented code

**Risk:** Low

---

## Testing Strategy

### Unit Tests (New)
```
services/auth/
  ├── genesysOAuth.service.test.js      # Mock axios
  ├── tenantProvisioning.service.test.js # Mock tenant service API
  ├── jwt.service.test.js                # No mocks needed
  ├── session.service.test.js            # Mock database
  └── userProvisioning.service.test.js   # Mock database
```

### Integration Tests (Update Existing)
- Test full OAuth flow end-to-end
- Test token refresh flow
- Test logout/logoutAll flows
- Test error scenarios

---

## File Structure After Refactoring

```
services/agent-portal-service/
├── src/
│   ├── controllers/
│   │   └── authController.js           # 150 lines (down from 551)
│   ├── services/
│   │   ├── auth/
│   │   │   ├── genesysOAuth.service.js      # ~80 lines
│   │   │   ├── tenantProvisioning.service.js # ~60 lines
│   │   │   ├── jwt.service.js                # ~70 lines
│   │   │   ├── session.service.js            # ~120 lines
│   │   │   └── userProvisioning.service.js   # ~90 lines
│   │   ├── tokenBlacklist.js           # Existing
│   │   └── ...
│   └── models/
│       └── Agent.js                    # Keep as-is (data layer)
└── tests/
    └── unit/
        └── services/
            └── auth/
                ├── genesysOAuth.service.test.js
                ├── jwt.service.test.js
                └── ...
```

---

## Backwards Compatibility

✅ **Fully backwards compatible**
- All existing API endpoints remain the same
- Request/response formats unchanged
- Environment variables unchanged
- Database schema unchanged

---

## Benefits Summary

### Code Quality
- ✅ Single Responsibility Principle
- ✅ DRY (Don't Repeat Yourself)
- ✅ Separation of Concerns
- ✅ Dependency Injection ready

### Maintainability
- ✅ Easier to understand (smaller files)
- ✅ Easier to test (isolated units)
- ✅ Easier to debug (clear boundaries)
- ✅ Easier to extend (add features to services)

### Reusability
- ✅ Services can be used by other controllers
- ✅ Services can be used by background jobs
- ✅ Services can be used by CLI tools

### Testing
- ✅ Unit tests for business logic
- ✅ Integration tests for workflows
- ✅ Easier to mock dependencies

---

## Potential Concerns & Mitigations

### Concern 1: "Too many files"
**Mitigation:** Each file has a clear purpose and ~60-120 lines. Better than one 551-line file.

### Concern 2: "Over-engineering"
**Mitigation:** This is not premature - the complexity already exists. We're just organizing it better.

### Concern 3: "Time investment"
**Mitigation:** Can be done incrementally (Phase 1 → Phase 2 → Phase 3). Each phase is independently testable.

### Concern 4: "Breaking existing code"
**Mitigation:** Services are additive. Old code continues working until we explicitly migrate it.

---

## Alternative Approaches Considered

### Alternative 1: Extract only Genesys OAuth
**Pros:** Minimal change
**Cons:** Controller still too complex

### Alternative 2: Keep everything in controller
**Pros:** No refactoring needed
**Cons:** Continues to violate SOLID principles, hard to test

### Alternative 3: Use existing auth-service
**Pros:** Centralized auth across all services
**Cons:** Creates network dependency, increases latency for every request

**Recommendation:** Proceed with proposed plan (hybrid approach - extract services locally)

---

## Open Questions for Discussion

1. **Logging strategy**: Should services log internally, or should controller log after each service call?
   - Recommendation: Services log errors, controller logs workflow steps

2. **Error handling**: Should services throw domain-specific errors, or generic errors?
   - Recommendation: Services throw AppError with specific codes

3. **Configuration**: Should services receive config via constructor or import config directly?
   - Recommendation: Import directly (like existing code), can refactor to DI later if needed

4. **Token blacklist integration**: Should SessionService own token blacklisting?
   - Recommendation: Yes - SessionService should handle both DB session and Redis blacklist

5. **Model layer**: Should services call Agent model directly, or create a repository layer?
   - Recommendation: Call Agent model directly for now (avoid over-abstraction)

---

## Success Criteria

After refactoring, we should have:
- ✅ authController.js < 200 lines
- ✅ Each service < 150 lines
- ✅ 80%+ unit test coverage for services
- ✅ All existing integration tests passing
- ✅ No API contract changes
- ✅ Logging maintained or improved
- ✅ Performance unchanged (no added latency)

---

## Timeline Estimate

- **Phase 1** (Create Services): 4-6 hours
- **Phase 2** (Migrate Controller): 3-4 hours
- **Phase 3** (Cleanup & Testing): 2-3 hours
- **Total**: 9-13 hours

---

## Next Steps

1. Review this plan and provide feedback
2. Decide on answers to "Open Questions"
3. Create GitHub issue/task for tracking
4. Begin Phase 1 implementation
5. Code review after each phase

---

**Questions? Concerns? Suggestions?**
