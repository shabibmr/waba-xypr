# Auth Service - Implementation Plan

## Goal

Enhance the authentication service to support multi-tenant authentication, external identity providers (Genesys OAuth), advanced token management, RBAC, and comprehensive audit capabilities for the WABA-Genesys integration platform.

## Phased Implementation

### Phase 1: Multi-tenant Authentication (Priority: HIGH)
**Duration**: 2 weeks

#### 1.1 Tenant-aware User Management
- **Files**:
  - `src/models/User.js` - Add tenant_id foreign key
  - `src/models/Tenant.js` - Tenant model reference
  - `src/middleware/tenantResolver.js` - Tenant context middleware
  - `src/services/userService.js` - Tenant-scoped user operations

- **Implementation**:
  - Add tenant_id column to users table
  - Implement tenant-scoped queries (WHERE tenant_id = ?)
  - Create tenant isolation in authentication flows
  - Add user provisioning with tenant assignment

#### 1.2 Organization-based Access Control
- **Files**:
  - `src/middleware/orgAuth.js` - Organization authorization
  - `src/services/orgService.js` - Organization management

- **Implementation**:
  - Support hierarchical organizations
  - Implement cross-organization access controls
  - Add organization admin roles

---

### Phase 2: External Identity Providers (Priority: HIGH)
**Duration**: 3 weeks

#### 2.1 Genesys OAuth Integration
- **Files**:
  - `src/strategies/genesysOAuth.js` - Passport.js Genesys strategy
  - `src/controllers/genesysAuth.controller.js` - OAuth flow handlers
  - `src/routes/genesysAuth.routes.js` - OAuth endpoints

- **Implementation**:
  - Implement OAuth 2.0 authorization code flow
  - Store Genesys access/refresh tokens per agent
  - Add token refresh mechanism
  - Sync agent profiles from Genesys

#### 2.2 Multi-factor Authentication (MFA)
- **Files**:
  - `src/services/mfaService.js` - MFA logic (TOTP, SMS)
  - `src/controllers/mfa.controller.js` - MFA endpoints

- **Implementation**:
  - Support TOTP (Time-based OTP) using speakeasy
  - Add SMS-based MFA integration
  - Implement backup codes
  - Add MFA enforcement per tenant

#### 2.3 Single Sign-On (SSO)
- **Files**:
  - `src/strategies/samlStrategy.js` - SAML integration
  - `src/controllers/sso.controller.js` - SSO handlers

- **Implementation**:
  - Implement SAML 2.0 support
  - Support OIDC (OpenID Connect)
  - Add SSO configuration per tenant

---

### Phase 3: Advanced Token Management (Priority: HIGH)
**Duration**: 1.5 weeks

#### 3.1 Refresh Token Implementation
- **Files**:
  - `src/models/RefreshToken.js` - Refresh token model
  - `src/services/tokenService.js` - Token lifecycle management
  - `src/controllers/token.controller.js` - Token refresh endpoint

- **Implementation**:
  - Store refresh tokens in database with expiry
  - Implement sliding sessions
  - Add token rotation on refresh
  - Support multiple active devices per user

#### 3.2 Token Revocation & Blacklisting
- **Files**:
  - `src/services/tokenBlacklist.js` - Redis-based blacklist
  - `src/middleware/tokenValidator.js` - Check blacklist on validation

- **Implementation**:
  - Implement Redis-based token blacklist
  - Add revocation on logout
  - Support bulk revocation (all user sessions)
  - Cleanup expired blacklist entries

#### 3.3 Secure Token Storage
- **Files**:
  - `src/utils/encryption.js` - Token encryption utilities

- **Implementation**:
  - Encrypt refresh tokens at rest
  - Use HttpOnly cookies for web clients
  - Implement token binding to device/IP

---

### Phase 4: Role-Based Access Control (Priority: MEDIUM)
**Duration**: 2 weeks

#### 4.1 Permission System
- **Files**:
  - `src/models/Role.js` - Role model
  - `src/models/Permission.js` - Permission model
  - `src/models/UserRole.js` - User-role association
  - `src/middleware/rbac.js` - Permission checking middleware

- **Implementation**:
  - Define roles: SuperAdmin, TenantAdmin, Agent, ReadOnly
  - Create permission matrix (create, read, update, delete)
  - Implement role assignment per user
  - Add permission inheritance

#### 4.2 Service-to-Service Authentication
- **Files**:
  - `src/services/serviceAuth.js` - Service token generation
  - `src/middleware/serviceAuth.js` - Service authentication

- **Implementation**:
  - Generate service tokens with limited scope
  - Implement API key authentication for services
  - Add service identity in JWT claims
  - Support certificate-based auth for mTLS

---

### Phase 5: Session Management (Priority: MEDIUM)
**Duration**: 1 week

#### 5.1 Multi-device Sessions
- **Files**:
  - `src/models/Session.js` - Session tracking model
  - `src/services/sessionService.js` - Session management

- **Implementation**:
  - Track active sessions per user
  - Store device information and last activity
  - Support concurrent session limits per tenant
  - Add session listing endpoint for users

#### 5.2 Session Cleanup
- **Files**:
  - `src/jobs/sessionCleanup.js` - Scheduled cleanup job

- **Implementation**:
  - Implement session timeout (configurable per tenant)
  - Add inactive session cleanup
  - Support "remember me" functionality

---

### Phase 6: Audit & Compliance (Priority: MEDIUM)
**Duration**: 1.5 weeks

#### 6.1 Authentication Audit Trail
- **Files**:
  - `src/models/AuditLog.js` - Audit log model
  - `src/services/auditService.js` - Audit logging service
  - `src/middleware/auditLogger.js` - Audit middleware

- **Implementation**:
  - Log all authentication events (login, logout, MFA)
  - Track failed login attempts with IP and user agent
  - Store changed fields on user updates
  - Add audit log retention policies

#### 6.2 Compliance Reporting
- **Files**:
  - `src/controllers/compliance.controller.js` - Compliance reports
  - `src/services/complianceService.js` - Report generation

- **Implementation**:
  - Generate compliance reports (GDPR, SOC 2)
  - Add user activity reports
  - Implement data export for user requests

---

### Phase 7: Rate Limiting & Security (Priority: HIGH)
**Duration**: 1 week

#### 7.1 Login Rate Limiting
- **Files**:
  - `src/middleware/loginRateLimiter.js` - Rate limiting middleware
  - `src/services/bruteForceProtection.js` - Brute force detection

- **Implementation**:
  - Implement sliding window rate limiting (5 attempts/15min)
  - Add progressive delays on failed attempts
  - Use Redis for distributed rate limiting
  - Support IP-based and user-based limits

#### 7.2 Security Features
- **Files**:
  - `src/middleware/captcha.js` - CAPTCHA integration
  - `src/services/ipBlocker.js` - IP blocking service

- **Implementation**:
  - Integrate reCAPTCHA for suspicious login attempts
  - Implement automatic IP blocking after threshold
  - Add password strength validation
  - Support password change enforcement

---

## Dependencies

```json
{
  "passport": "^0.7.0",
  "passport-oauth2": "^1.7.0",
  "passport-saml": "^3.2.4",
  "speakeasy": "^2.0.0",
  "qrcode": "^1.5.3",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2",
  "ioredis": "^5.3.2"
}
```

**External Services**:
- Genesys Cloud OAuth endpoints
- Redis for session and blacklist storage
- PostgreSQL for user and audit data

---

## Verification Plan

### Unit Tests
- JWT generation and validation
- Password hashing and comparison
- MFA TOTP generation and verification
- RBAC permission checks

### Integration Tests
- Genesys OAuth flow end-to-end
- Token refresh and revocation
- Multi-tenant user isolation
- Session management across devices

### Security Tests
- Brute force protection verification
- Token expiry and blacklisting
- SQL injection prevention in queries
- XSS prevention in user inputs

**Manual Testing**:
1. Complete Genesys OAuth login as agent
2. Test MFA enrollment and verification
3. Verify token refresh before expiry
4. Test session management (logout all devices)
5. Verify audit logs are created

---

## Rollback Strategy
- Feature flags for Genesys OAuth and MFA
- Database migration rollback scripts
- Redis can be flushed without data loss
- Maintain backward compatibility for JWT format
