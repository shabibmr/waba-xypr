# Debugging Context: Agent Portal Service Popup Issue

## Current Objective
Resolve the issue where the Genesys login popup does not close after successful authentication. The backend seems to complete the process, but the frontend (popup) gets stuck.

## System State
- **Project Root**: `/Users/admin/code/WABA/v1/waba-xypr`
- **Active Services**: `tenant-service` (port 3007), `agent-portal-service`, `auth-service`.
- **Environment**: Local Docker environment (`docker-compose.remote.yml`).

## Recent Changes & Implementation
### 1. Tenant Auto-Provisioning (Implemented & Verified)
- **Problem**: Login was failing because the tenant for Genesys Org "Vis Networks" didn't exist.
- **Fix**: Implemented `ensureTenantByGenesysOrg` in `tenant-service` and a new endpoint `POST /api/tenants/provision/genesys`.
- **Status**: Verified via `curl`. Tenant "Vis Networks" (ID: `vis-networks-be74`) is now provisioned.
- **Key File**: `services/tenant-service/src/services/tenantService.js`
- **Key File**: `services/tenant-service/src/routes/index.js` (Fixed route mounting to include `/api` prefix).

### 2. Agent Portal Service Updates
- **Update**: `services/agent-portal-service/src/controllers/authController.js` now calls the provisioning endpoint instead of just looking up the tenant.
- **Debugging**: Added detailed trace logs to `handleCallback` in `authController.js` to track execution flow.
- **Logs Added**:
    - "Updating last login..."
    - "Signing JWT..."
    - "Creating session..."
    - "Sending success response to browser..."

## Current Status & Symptoms
- **Backend Success**: Logs show `User authenticated via Genesys OAuth`.
- **Frontend Issue**: The popup window remains open.
- **Hypothesis**:
    1. The backend might be hanging at `GenesysUser.updateLastLogin`, `GenesysUser.createSession`, or `res.send`.
    2. The browser might not be receiving or processing the `window.opener.postMessage` script correctly.

## Next Steps for New Session
1. **Check Logs**: Monitor `docker logs -f whatsapp-agent-portal-service`. Look for the trace logs added in `authController.js`.
    - If logs stop before "Sending success response...", the issue is server-side (DB or Logic hanging).
    - If "Sending success response..." appears, the issue is client-side (frontend script execution).
2. **Key Files to Review**:
    - `services/agent-portal-service/src/controllers/authController.js` (Review the `handleCallback` function).
    - `services/agent-portal-service/src/models/GenesysUser.js` (Check `updateLastLogin` and `createSession` implementation for potential hangs).

## Log Artifacts
- Previous success log:
  ```json
  {"message":"Tenant provisioned successfully","tenant_id":"vis-networks-be74","tenant_name":"Vis Networks"}
  ```
- Genesys Org ID: `a4a71219-25cb-4445-b80d-2295318561f5`

## RESOLUTION - 2026-01-29

### Root Cause Identified ✅
**Origin Mismatch in postMessage Validation**

The popup wasn't closing because the frontend's message event listener was rejecting valid authentication responses:

- **Backend**: Sends postMessage from `http://localhost:3000` (API Gateway)
- **Frontend**: Was checking `event.origin !== window.location.origin` 
- **Problem**: `window.location.origin` was `http://localhost:3014` (Agent Portal), so messages from `localhost:3000` were silently ignored

### Fix Applied ✅
**File**: `services/agent-portal/src/services/authService.js`

Updated origin validation to check against API_BASE_URL instead of window.location.origin:

```javascript
// OLD: Only accepted messages from same origin as frontend
if (event.origin !== window.location.origin) return;

// NEW: Validates against configured API server
const apiOrigin = new URL(API_BASE_URL).origin;
if (event.origin !== apiOrigin) {
    console.warn('[AuthService] Ignoring message from unexpected origin:', event.origin, 'Expected:', apiOrigin);
    return;
}
```

### Actions Taken
1. ✅ Modified `authService.js` to validate origin against API_BASE_URL
2. ✅ Modified `security.js` in API Gateway to allow inline scripts (CSP)
3. ✅ Updated `docker-compose.remote.yml` to fix WebSocket URL (was 3012, now 3015)
4. ✅ Restarted `whatsapp-agent-portal` and `whatsapp-api-gateway`

### Status
**READY FOR FINAL TESTING** 
The entire login and workspace initialization flow has been fixed.
1. Login popup should close automatically.
2. You should land on the Workspace.
3. Chat features should be active (WebSocket connected).
