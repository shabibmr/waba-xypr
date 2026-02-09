# Service Integration Verification Guide

Manual verification steps to test integration between agent-portal-service, tenant-service, and auth-service.

## Prerequisites

Ensure all services are running:
```bash
./manage.sh start
```

Check service health:
```bash
# Agent Portal Service
curl http://localhost:3015/health

# Tenant Service
curl http://localhost:3007/health

# Auth Service
curl http://localhost:3004/health
```

## Test 1: Tenant Auto-Provisioning

### 1.1 Create New Tenant via Genesys Org

```bash
curl -X POST http://localhost:3007/api/tenants/provision/genesys \
  -H "Content-Type: application/json" \
  -d '{
    "genesysOrgId": "test-org-123",
    "genesysOrgName": "Acme Corporation",
    "genesysRegion": "mypurecloud.com"
  }'
```

**Expected Result:**
- HTTP 200
- Response contains `tenant_id` and `tenant_name`
- Tenant is created in database

**Save the `tenant_id` for next tests!**

### 1.2 Provision Same Org Again (Should Reuse)

```bash
curl -X POST http://localhost:3007/api/tenants/provision/genesys \
  -H "Content-Type: application/json" \
  -d '{
    "genesysOrgId": "test-org-123",
    "genesysOrgName": "Acme Corporation",
    "genesysRegion": "mypurecloud.com"
  }'
```

**Expected Result:**
- HTTP 200
- Same `tenant_id` as before (tenant reused, not duplicated)

### 1.3 Verify Multi-Tenant Isolation

```bash
curl -X POST http://localhost:3007/api/tenants/provision/genesys \
  -H "Content-Type: application/json" \
  -d '{
    "genesysOrgId": "test-org-456",
    "genesysOrgName": "Different Company",
    "genesysRegion": "mypurecloud.com"
  }'
```

**Expected Result:**
- HTTP 200
- **Different** `tenant_id` (separate tenant created)

## Test 2: Tenant CRUD Operations

### 2.1 Get Tenant by ID

Replace `{tenant_id}` with actual tenant ID:

```bash
curl http://localhost:3007/api/tenants/{tenant_id}
```

**Expected Result:**
- HTTP 200
- Tenant details returned

### 2.2 Get Tenant by Genesys Org ID

```bash
curl http://localhost:3007/api/tenants/by-genesys-org/test-org-123
```

**Expected Result:**
- HTTP 200
- Tenant details for Acme Corporation

### 2.3 Update Tenant

```bash
curl -X PATCH http://localhost:3007/api/tenants/{tenant_id} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation Updated",
    "plan": "premium"
  }'
```

**Expected Result:**
- HTTP 200
- Updated tenant details

### 2.4 List All Tenants

```bash
curl http://localhost:3007/api/tenants/
```

**Expected Result:**
- HTTP 200
- Array of all tenants

## Test 3: Genesys Credentials Management

### 3.1 Set Genesys Credentials

```bash
curl -X PUT http://localhost:3007/api/tenants/{tenant_id}/genesys/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "abc123",
    "clientSecret": "secret123",
    "region": "mypurecloud.com",
    "integrationId": "integration123"
  }'
```

**Expected Result:**
- HTTP 200
- Credentials stored

### 3.2 Get Genesys Credentials (Masked)

```bash
curl http://localhost:3007/api/tenants/{tenant_id}/genesys/credentials
```

**Expected Result:**
- HTTP 200
- `clientSecret` is masked (e.g., `***t123`)
- Other fields visible

## Test 4: Organization Profile (via Agent Portal Service)

**Note:** These endpoints require authentication (JWT token from Genesys OAuth).

### 4.1 Verify Endpoint Exists

```bash
curl -X PUT http://localhost:3015/api/organization/profile \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "Test Org"
  }'
```

**Expected Result:**
- HTTP 401 (Unauthorized - no token provided)
- This confirms endpoint exists and requires auth

### 4.2 Test with Mock Token (Optional)

If you have a valid JWT token:

```bash
curl -X PUT http://localhost:3015/api/organization/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {your_jwt_token}" \
  -d '{
    "organizationName": "Updated Organization Name",
    "industry": "technology",
    "companySize": "51-200",
    "country": "United States",
    "timezone": "America/New_York"
  }'
```

**Expected Result:**
- HTTP 200
- Profile updated
- Tenant-service updated

## Test 5: End-to-End OAuth Flow

### Manual Test via Browser

1. **Start Services:**
   ```bash
   ./manage.sh start
   ```

2. **Open Agent Portal:**
   ```
   http://localhost:3014/login
   ```

3. **Click "Sign in with Genesys Cloud"**
   - Should redirect to Genesys OAuth
   - Login with Genesys credentials
   - Should redirect back to agent portal

4. **Verify Tenant Auto-Provisioning:**
   ```bash
   # Check if tenant was created
   curl http://localhost:3007/api/tenants/ | jq

   # Look for tenant with your Genesys org name
   ```

5. **Check User Profile:**
   - Navigate to `/profile` in agent portal
   - Verify organization info is displayed

## Test 6: Auth Service Integration

### 6.1 Check Auth Service Health

```bash
curl http://localhost:3004/health
```

**Expected Result:**
- HTTP 200

### 6.2 Verify Architecture

**Current Architecture:**
- **Agent Portal Service** handles Genesys OAuth directly
- **Auth Service** handles generic JWT operations
- **Tenant Service** stores organization data

**This is the expected architecture for Phase 1.**

Future phases may centralize OAuth in auth-service, but current setup is correct.

## Test 7: Integration Flow Verification

### Complete Integration Test

1. **Provision Tenant**
   ```bash
   TENANT_RESPONSE=$(curl -s -X POST http://localhost:3007/api/tenants/provision/genesys \
     -H "Content-Type: application/json" \
     -d '{
       "genesysOrgId": "integration-test-001",
       "genesysOrgName": "Integration Test Org",
       "genesysRegion": "mypurecloud.com"
     }')

   echo $TENANT_RESPONSE | jq
   TENANT_ID=$(echo $TENANT_RESPONSE | jq -r '.tenant_id')
   echo "Tenant ID: $TENANT_ID"
   ```

2. **Update Tenant**
   ```bash
   curl -X PATCH http://localhost:3007/api/tenants/$TENANT_ID \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Integration Test Org Updated",
       "plan": "premium"
     }' | jq
   ```

3. **Set Genesys Credentials**
   ```bash
   curl -X PUT http://localhost:3007/api/tenants/$TENANT_ID/genesys/credentials \
     -H "Content-Type: application/json" \
     -d '{
       "clientId": "test-client",
       "clientSecret": "test-secret",
       "region": "mypurecloud.com",
       "integrationId": "test-integration"
     }' | jq
   ```

4. **Verify Credentials (Masked)**
   ```bash
   curl http://localhost:3007/api/tenants/$TENANT_ID/genesys/credentials | jq
   ```

5. **Cleanup**
   ```bash
   curl -X DELETE http://localhost:3007/api/tenants/$TENANT_ID
   ```

## Test Results Checklist

- [ ] Tenant auto-provisioning creates new tenant
- [ ] Same Genesys org reuses existing tenant
- [ ] Different Genesys org creates separate tenant
- [ ] Tenant can be retrieved by ID
- [ ] Tenant can be retrieved by Genesys org ID
- [ ] Tenant profile can be updated
- [ ] Genesys credentials can be stored
- [ ] Genesys credentials are masked when retrieved
- [ ] Organization profile endpoint exists (returns 401 without auth)
- [ ] Auth service is running
- [ ] All services respond to health checks

## Troubleshooting

### Service Not Running

```bash
# Check logs
docker compose logs [service-name]

# Restart service
docker compose restart [service-name]

# Full restart
./manage.sh restart
```

### Database Connection Issues

```bash
# Check PostgreSQL
docker compose logs whatsapp-postgres

# Connect to database
docker exec -it whatsapp-postgres psql -U postgres -d whatsapp_genesys

# Check tenants table
SELECT * FROM tenants;
```

### Redis Connection Issues

```bash
# Check Redis
docker compose logs whatsapp-redis

# Connect to Redis
docker exec -it whatsapp-redis redis-cli

# Check cached data
KEYS tenant:*
```

## Expected Integration Points

### Agent Portal Service → Tenant Service

**When:** User logs in via Genesys OAuth for first time

**Flow:**
1. User authenticates with Genesys
2. Agent Portal Service gets Genesys org info
3. Calls `POST /api/tenants/provision/genesys`
4. Tenant Service creates/returns tenant
5. Agent Portal Service creates user with tenant_id

**Endpoints Used:**
- `POST /api/tenants/provision/genesys`
- `PUT /api/tenants/{tenantId}`
- `GET /api/tenants/{tenantId}`

### Agent Portal Service → Auth Service

**Current:** Not directly integrated for OAuth

**Auth Service Role:**
- Provides generic JWT utilities
- May handle internal service-to-service auth
- **Not used for Genesys OAuth** (handled by agent-portal-service)

**This is the correct architecture for Phase 1.**

## Conclusion

If all tests pass:
✅ **Service integration is working correctly!**

The agent-portal-service, tenant-service, and auth-service are properly integrated and communicate as expected.
