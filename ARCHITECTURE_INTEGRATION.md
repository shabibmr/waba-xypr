# Service Integration Architecture

Overview of how agent-portal-service, tenant-service, and auth-service integrate in Phase 1.

## Service Roles

### Agent Portal Service (Port 3015)

**Purpose:** Backend API for the Customer Portal

**Responsibilities:**
- Genesys OAuth authentication
- User auto-provisioning
- Session management (JWT + Redis blacklist)
- Organization profile management
- Proxies requests to tenant-service

**Integration Points:**
- → **Tenant Service**: Auto-provision tenants, update profiles
- → **Redis**: Token blacklist, session caching
- → **PostgreSQL**: User and session storage

### Tenant Service (Port 3007)

**Purpose:** Multi-tenant configuration management

**Responsibilities:**
- Tenant CRUD operations
- Genesys organization mapping
- WhatsApp Business configuration
- Genesys credentials storage
- API key management

**Integration Points:**
- ← **Agent Portal Service**: Receives tenant provisioning requests
- → **PostgreSQL**: Tenant data storage
- → **Redis**: Tenant data caching

### Auth Service (Port 3004)

**Purpose:** Generic authentication utilities

**Current Role (Phase 1):**
- JWT token generation/validation utilities
- Basic user authentication framework
- **NOT used for Genesys OAuth** (handled by agent-portal-service)

**Future Role (Post Phase 1):**
- May centralize all OAuth flows
- Service-to-service authentication
- Multi-factor authentication

**Why Not Used Now:**
- Agent-portal-service handles Genesys OAuth directly for simplicity
- Reduces inter-service dependencies in Phase 1
- Easier to debug and develop

## Integration Flows

### Flow 1: First-Time User Login

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. Click "Login with Genesys"
       ▼
┌─────────────────────────┐
│ Agent Portal Service    │
│ (port 3015)             │
└──────┬──────────────────┘
       │ 2. Redirect to Genesys OAuth
       ▼
┌─────────────────────────┐
│  Genesys Cloud OAuth    │
└──────┬──────────────────┘
       │ 3. User authenticates
       │ 4. Callback with auth code
       ▼
┌─────────────────────────┐
│ Agent Portal Service    │
│                         │
│ 5. Exchange code for    │
│    access token         │
│ 6. Get user info        │
│ 7. Get org info         │
└──────┬──────────────────┘
       │ 8. Provision tenant
       │    POST /api/tenants/provision/genesys
       ▼
┌─────────────────────────┐
│   Tenant Service        │
│   (port 3007)           │
│                         │
│ 9. Check if tenant      │
│    exists for           │
│    genesysOrgId         │
│ 10. Create if new       │
│ 11. Return tenant_id    │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Agent Portal Service    │
│                         │
│ 12. Create/find user    │
│     in PostgreSQL       │
│ 13. Generate JWT        │
│ 14. Create session      │
└──────┬──────────────────┘
       │ 15. Return JWT to browser
       ▼
┌─────────────┐
│   Browser   │
└─────────────┘
```

### Flow 2: Update Organization Profile

```
┌─────────────┐
│   Browser   │
│  (logged in)│
└──────┬──────┘
       │ 1. PUT /api/organization/profile
       │    + JWT token
       ▼
┌─────────────────────────┐
│ Agent Portal Service    │
│                         │
│ 2. Validate JWT         │
│ 3. Check blacklist      │
│ 4. Extract tenant_id    │
└──────┬──────────────────┘
       │ 5. PUT /api/tenants/{tenant_id}
       ▼
┌─────────────────────────┐
│   Tenant Service        │
│                         │
│ 6. Update tenant        │
│ 7. Clear Redis cache    │
│ 8. Return updated data  │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Agent Portal Service    │
│ 9. Return success       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────┐
│   Browser   │
└─────────────┘
```

### Flow 3: Token Refresh

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. Token expires soon (auto-refresh)
       │    POST /api/agents/auth/refresh
       │    + Refresh token
       ▼
┌─────────────────────────┐
│ Agent Portal Service    │
│                         │
│ 2. Verify refresh token │
│ 3. Check session in DB  │
│ 4. Generate new tokens  │
│ 5. Update session       │
│ 6. Return new tokens    │
└──────┬──────────────────┘
       │
       ▼
┌─────────────┐
│   Browser   │
└─────────────┘
```

### Flow 4: Logout (Token Blacklist)

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. POST /api/agents/auth/logout
       │    + JWT token
       ▼
┌─────────────────────────┐
│ Agent Portal Service    │
└──────┬──────────────────┘
       │ 2. Add token to Redis blacklist
       ▼
┌─────────────────────────┐
│       Redis             │
│  blacklist:token:{jwt}  │
└─────────────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Agent Portal Service    │
│ 3. Mark session         │
│    inactive in DB       │
└──────┬──────────────────┘
       │ 4. Return success
       ▼
┌─────────────┐
│   Browser   │
└─────────────┘
```

## Data Models

### PostgreSQL (agent-portal-service)

**genesys_users:**
```sql
- user_id (UUID, PK)
- tenant_id (UUID, FK → tenants)
- genesys_user_id (text, unique)
- genesys_email (text)
- name (text)
- role (text: admin, supervisor, agent)
- is_active (boolean)
- created_at, last_login_at
```

**genesys_user_sessions:**
```sql
- session_id (UUID, PK)
- user_id (UUID, FK → genesys_users)
- access_token (text)
- refresh_token (text)
- expires_at (timestamp)
- is_active (boolean)
- ip_address, user_agent
- created_at, updated_at
```

### PostgreSQL (tenant-service)

**tenants:**
```sql
- tenant_id (text, PK)
- name (text)
- subdomain (text, unique)
- plan (text)
- status (text)
- genesys_org_id (text, unique)
- genesys_org_name (text)
- genesys_region (text)
- rate_limit (integer)
- created_at, updated_at
```

**tenant_credentials:**
```sql
- credential_id (UUID, PK)
- tenant_id (text, FK → tenants)
- credential_type (text: 'genesys', 'whatsapp')
- credentials (jsonb)
- is_active (boolean)
- created_at
```

**tenant_whatsapp_config:**
```sql
- config_id (UUID, PK)
- tenant_id (text, FK → tenants)
- waba_id (text)
- phone_number_id (text)
- display_phone_number (text)
- access_token (text, encrypted)
- created_at, updated_at
```

### Redis Keys

**Token Blacklist (agent-portal-service):**
```
blacklist:token:{jwt_token} = '1'
TTL: matches token expiry
```

**Tenant Cache (tenant-service):**
```
tenant:{tenant_id} = {tenant JSON}
TTL: 1 hour
```

**Genesys Credentials Cache (tenant-service):**
```
genesys:creds:{tenant_id} = {credentials JSON}
TTL: 1 hour
```

## API Endpoints

### Agent Portal Service

**Authentication:**
```
GET  /api/agents/auth/login              - Initiate Genesys OAuth
GET  /api/agents/auth/callback           - OAuth callback
POST /api/agents/auth/refresh            - Refresh access token
POST /api/agents/auth/logout             - Logout (blacklist token)
POST /api/agents/auth/logout-all         - Logout all devices
GET  /api/agents/profile                 - Get user profile
```

**Organization:**
```
GET  /api/organization/profile           - Get org profile
PUT  /api/organization/profile           - Update org profile
POST /api/organization/complete-onboarding - Complete setup
GET  /api/organization/users             - List org users
POST /api/organization/sync-users        - Sync from Genesys
```

### Tenant Service

**Tenants:**
```
POST   /api/tenants/                     - Create tenant
GET    /api/tenants/                     - List all tenants
GET    /api/tenants/:tenantId            - Get tenant by ID
PATCH  /api/tenants/:tenantId            - Update tenant
DELETE /api/tenants/:tenantId            - Delete tenant
```

**Genesys Integration:**
```
GET  /api/tenants/by-genesys-org/:genesysOrgId - Get by Genesys org
POST /api/tenants/provision/genesys            - Auto-provision tenant
PUT  /api/tenants/:tenantId/genesys/credentials - Set Genesys creds
GET  /api/tenants/:tenantId/genesys/credentials - Get Genesys creds (masked)
```

## Security Considerations

### Multi-Tenant Isolation

**Database Level:**
- All queries include `WHERE tenant_id = $1`
- Foreign keys enforce relationships
- Row-level security policies (recommended for production)

**Application Level:**
- JWT contains `tenantId` claim
- Middleware extracts and validates tenant_id
- All service calls include tenant context

**Redis Level:**
- Keys prefixed with `tenant:{tenant_id}:`
- Prevents cross-tenant data access

### Token Security

**Access Tokens:**
- Short-lived: 1 hour
- Contains: userId, tenantId, role
- Blacklisted on logout

**Refresh Tokens:**
- Long-lived: 7 days
- Rotated on each refresh
- Stored in database
- Invalidated on logout

**Session Security:**
- Tracks IP address and user agent
- Can be invalidated remotely
- Cleanup of expired sessions

## Performance Optimizations

### Caching Strategy

**Redis Caching:**
- Tenant data: 1 hour TTL
- Genesys credentials: 1 hour TTL
- Token blacklist: TTL matches token expiry

**PostgreSQL Connection Pooling:**
- Connection pool per service
- Max connections: 20 (configurable)

### Rate Limiting

**Per-Tenant:**
- Configured in tenants table
- Enforced by tenant middleware
- Default: 1000 requests/minute

## Monitoring & Observability

### Health Checks

All services expose `/health`:
```json
{
  "status": "healthy",
  "service": "agent-portal-service",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Logging

**Structured Logging (Winston):**
```javascript
logger.info('Tenant provisioned', {
  tenantId: 'acme-123',
  genesysOrgId: 'org-456',
  source: 'auto-provision'
});
```

**Key Events Logged:**
- User login/logout
- Tenant provisioning
- Token refresh
- Profile updates
- Integration errors

## Future Enhancements

### Phase 2+ Improvements

1. **Centralized OAuth in Auth Service**
   - Move Genesys OAuth to auth-service
   - Support multiple OAuth providers
   - Unified token management

2. **Enhanced Multi-Tenancy**
   - Tenant-specific customization
   - White-label support
   - Custom domains

3. **Advanced Security**
   - MFA integration
   - IP whitelisting per tenant
   - Audit trail for sensitive operations

4. **Performance**
   - Redis Sentinel for HA
   - PostgreSQL read replicas
   - CDN for static assets

## Conclusion

The current integration architecture is:
- ✅ **Functional**: All required features work
- ✅ **Secure**: Multi-tenant isolation enforced
- ✅ **Scalable**: Can handle moderate load
- ✅ **Maintainable**: Clear separation of concerns

**Architecture Decision**: Agent-portal-service handles Genesys OAuth directly rather than through auth-service. This is intentional for Phase 1 to reduce complexity and inter-service dependencies.
