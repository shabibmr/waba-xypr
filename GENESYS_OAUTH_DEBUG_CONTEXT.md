# Genesys OAuth Debugging - Context for New Agent

## Current Status Summary

### ✅ What's Working
1. **OAuth Authorization Flow**
   - Client ID: `d01d9876-d715-410b-b3ab-4990b1d6e382`
   - Region: `aps1.pure.cloud`
   - Redirect URI: `http://localhost:3000/api/agents/auth/callback`
   - OAuth scopes added: `users:readonly organization:readonly`

2. **Token Exchange**
   - Successfully exchanges authorization code for access token
   - Token exchange endpoint working correctly

3. **User Info Fetch**
   - Successfully retrieves user data from `/api/v2/users/me`
   - User: Nissar Sulaiman (nissar.s@visnet.in)
   - User ID: `278bcb23-8576-443b-bc93-21b2605c0fc3`

4. **Organization Info Fetch**
   - Successfully retrieves organization from `/api/v2/organizations/me`
   - Organization: "Vis Networks"
   - Org ID: `a4a71219-25cb-4445-b80d-2295318561f5`

5. **Services Running**
   - auth-service: ✅ Running (port 3004)
   - agent-portal-service: ✅ Running (port 3015)
   - api-gateway: ✅ Running (port 3000)

### 🔴 Critical Blocking Issue

**tenant-service is crash-looping**

**Error:**
```
Error: Cannot find module '../../../shared/constants'
Require stack:
- /app/services/tenant-service/src/services/tenantService.js
```

**Impact:**
- OAuth flow cannot complete
- Cannot lookup tenant by Genesys organization ID
- Login fails at tenant lookup step

**What We Know:**
1. The `shared/constants` folder EXISTS in the Docker image at `/app/shared/constants/`
2. The folder contains: `index.js`, `keys.js`, `queues.js`, `services.js`
3. Other services (auth-service) use the same require path and work fine
4. Rebuilt tenant-service with `--no-cache` but issue persists
5. The require path `../../../shared/constants` should resolve correctly from `/app/services/tenant-service/src/services/tenantService.js`

---

## Files Modified

### 1. [auth-service/src/index.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/auth-service/src/index.js)
**Changes:**
- Added missing `GENESYS_CONFIG` object definition
- Added comprehensive logging throughout OAuth flow
- Enhanced error logging with full context

### 2. [agent-portal-service/src/controllers/authController.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/agent-portal-service/src/controllers/authController.js)
**Changes:**
- Added OAuth scope parameter: `users:readonly organization:readonly`
- Added separate API call to fetch organization from `/api/v2/organizations/me`
- Fixed popup closing issue - now always sends close response on tenant lookup errors
- Added detailed logging for organization fetch

---

## Environment Variables

### .env File
```bash
GENESYS_CLIENT_ID=d01d9876-d715-410b-b3ab-4990b1d6e382
GENESYS_CLIENT_SECRET=xfkMxlI0RBU4TGvot_xhsedguARjkodQ1OxAKPNZjHU
GENESYS_REGION=aps1.pure.cloud
GENESYS_AGENT_REDIRECT_URI=http://localhost:3000/api/agents/auth/callback
```

### Container Verification
All services have correct environment variables set via docker-compose.remote.yml

---

## OAuth Flow Sequence

```
1. User clicks "Sign in with Genesys Cloud"
2. Frontend opens popup → /api/agents/auth/login
3. agent-portal-service redirects to Genesys login
   - WITH scopes: users:readonly organization:readonly
4. User authenticates with Genesys
5. Genesys redirects to /api/agents/auth/callback?code=...
6. agent-portal-service exchanges code for access_token ✅
7. Fetch user info from /api/v2/users/me ✅
8. Fetch organization from /api/v2/organizations/me ✅
9. Lookup tenant by org ID from tenant-service ❌ FAILS HERE
   - Error: Cannot connect to tenant-service (crash-looping)
10. Should: Find/create user, issue JWT, close popup with success
```

---

## Next Steps to Fix

### Priority 1: Fix tenant-service crash
**Investigate:**
1. Why does tenant-service fail to require `shared/constants` when auth-service succeeds?
2. Compare Dockerfiles between working (auth-service) and broken (tenant-service)
3. Check if there's a difference in how the shared folder is copied
4. Verify node_modules and package.json in tenant-service
5. Consider using absolute paths or NODE_PATH environment variable

**Potential Solutions:**
- Use absolute require paths
- Add shared folder to NODE_PATH
- Create symlink in node_modules
- Check if package.json has different configuration
- Verify build context in docker-compose

### Priority 2: Test Complete Flow
Once tenant-service is fixed:
1. Ensure tenant exists for org ID `a4a71219-25cb-4445-b80d-2295318561f5`
2. Test full login flow end-to-end
3. Verify JWT token generation
4. Verify popup closes with success message

---

## Key Files to Review

| File | Purpose |
|------|---------|
| [services/tenant-service/Dockerfile](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/Dockerfile) | Docker build configuration |
| [services/tenant-service/src/services/tenantService.js](file:///Users/admin/code/WABA/v1/waba-xypr/services/tenant-service/src/services/tenantService.js) | File requiring shared/constants |
| [services/auth-service/Dockerfile](file:///Users/admin/code/WABA/v1/waba-xypr/services/auth-service/Dockerfile) | Working service for comparison |
| [shared/constants/index.js](file:///Users/admin/code/WABA/v1/waba-xypr/shared/constants/index.js) | Module being required |

---

## Logs to Check

```bash
# Tenant service crash logs
docker logs whatsapp-tenant-service --tail 50

# Agent portal service (OAuth flow)
docker logs whatsapp-agent-portal-service --tail 100

# Container status
docker ps --filter "name=whatsapp"
```

---

## Testing Commands

```bash
# Rebuild tenant-service
docker-compose -f docker-compose.remote.yml build --no-cache tenant-service

# Restart tenant-service
docker-compose -f docker-compose.remote.yml up -d tenant-service

# Check if shared folder exists in image
docker run --rm --entrypoint ls waba-xypr-tenant-service -laR /app/shared/

# Test require path
docker exec whatsapp-tenant-service node -e "console.log(require.resolve('../../../shared/constants'))"
```
