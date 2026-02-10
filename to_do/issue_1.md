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

### Root Cause Analysis
1.  **Popup Stalling**: Caused by strict Helmet security headers (`CSP`, `COOP`, `CORP`) blocking `window.opener` access and inline scripts.
2.  **Authentication Failure**: 
    - Initially caused by `authService` blocking messages from different origins (`api-gateway`).
    - Persisted due to **Docker Build Target Mismatch**. `agent-portal` was running the `production` build (Nginx on port 80) instead of `development` (Vite on port 3014). This caused:
        - Port mismatch (mapped 3014:3014 -> traffic hitting Nginx on 3014 failed/refused or served stale content).
        - Browser caching of old JS files (no HMR/Vite).
        - Lack of debug capability (code changes like `alert` not appearing).

### Fixes Applied
1.  **Security**: Configured `security.js` to allow `unsafe-inline` scripts and disabled `crossOriginOpenerPolicy` and `originAgentCluster` for the auth callback.
2.  **Auth Logic**: Updated `authService.js` to validate origin against `API_BASE_URL`.
3.  **Deployment**: Updated `docker-compose.remote.yml` for `agent-portal`:
    - Set `target: development` to run Vite.
    - Added volume mounts for live code updates.
    - Mapped ports correctly for Vite.
4.  **WebSocket**: Fixed `VITE_AGENT_WIDGET_URL` to point to `agent-portal-service:3015`.

### Status
**FIXED**
- Application successfully logs in via Genesys.
- Login popup closes automatically.
- User is redirected to Workspace.
- WebSocket connects and real-time features are active.
