# Dev Login Setup Guide

This guide explains how to bypass OAuth authentication in the agent-portal for development and testing.

## Features

### 1. **Dev Login Button**
- Visible only when `VITE_ENABLE_DEV_LOGIN=true`
- Appears on the login page below the Genesys OAuth button
- Bypasses OAuth flow entirely

### 2. **Session Replay**
- Automatically saves your last successful login (OAuth or dev)
- Replays the same session on next dev login (if token not expired)
- Sessions expire after 7 days in localStorage

### 3. **Demo Account Fallback**
- If no saved session exists, creates a demo account automatically
- Demo account: `demo-user-001` in tenant `demo-tenant-001`
- Full access to all portal features

### 4. **Backend Auth Bypass** (Optional)
- Set `SKIP_AUTH=true` in agent-portal-service for complete backend bypass
- Useful when backend credentials are missing

---

## Quick Start

### Frontend (agent-portal)

1. **Copy the example env file:**
   ```bash
   cd services/agent-portal
   cp .env.example .env
   ```

2. **Enable dev login:**
   ```bash
   # Edit services/agent-portal/.env
   VITE_ENABLE_DEV_LOGIN=true
   ```

3. **Restart the service:**
   ```bash
   # From project root
   ./manage.sh restart agent-portal
   ```

4. **Login:**
   - Navigate to http://localhost:3014/login
   - Click **"Dev Login (Skip OAuth)"** button
   - Redirects directly to `/workspace`

---

### Backend (agent-portal-service) - Optional

Only needed if you want to skip JWT validation entirely:

1. **Copy the example env file:**
   ```bash
   cd services/agent-portal-service
   cp .env.example .env
   ```

2. **Enable auth bypass:**
   ```bash
   # Edit services/agent-portal-service/.env
   NODE_ENV=development
   SKIP_AUTH=true
   ```

3. **Restart the service:**
   ```bash
   ./manage.sh restart agent-portal-service
   ```

---

## How It Works

### Frontend Flow

```
Login Page
  ↓
Click "Dev Login"
  ↓
AuthService.devLogin()
  ↓
Check localStorage for saved session
  ├─ Found & valid → Restore tokens
  └─ Not found → POST /api/agents/auth/demo
       ↓
       Create demo user + tokens
       ↓
       Save to localStorage for next time
  ↓
Redirect to /workspace
```

### Session Persistence

**What's saved:**
```javascript
{
  accessToken: "eyJhbGc...",
  refreshToken: "refresh...",
  agent: {
    user_id: "demo-user-001",
    name: "Demo User",
    email: "demo@example.com",
    tenant_id: "demo-tenant-001",
    role: "admin"
  },
  genesysOrg: { id: "demo-org", name: "Demo Org" },
  savedAt: 1234567890000
}
```

**Where:** `localStorage.dev_last_session`

**Expiry:** 7 days (auto-cleared if older)

---

## Environment Variables Reference

### Frontend (services/agent-portal/.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_ENABLE_DEV_LOGIN` | No | `false` | Shows dev login button |
| `VITE_API_GATEWAY` | Yes | `http://localhost:3000` | API gateway URL |
| `VITE_AGENT_WIDGET_URL` | No | `ws://localhost:3012` | Widget WebSocket |
| `VITE_AGENT_PORTAL_SERVICE_URL` | No | `ws://localhost:3015` | Portal WebSocket |

### Backend (services/agent-portal-service/.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `production` | Must be `development` for SKIP_AUTH |
| `SKIP_AUTH` | No | `false` | Bypasses JWT validation (dev only) |
| `JWT_SECRET` | Yes | - | Sign/verify tokens |
| `JWT_EXPIRES_IN` | No | `7d` | Token lifetime |

---

## Testing Scenarios

### Scenario 1: First Dev Login (No Saved Session)
```bash
# Clear localStorage
localStorage.removeItem('dev_last_session')

# Click "Dev Login"
# → Creates demo-user-001
# → Saves to localStorage
# → Redirects to /workspace
```

### Scenario 2: Replay Last Session
```bash
# After successful OAuth login
# → Session automatically saved

# Next time, click "Dev Login"
# → Restores same user/tokens
# → No network call needed
# → Instant login
```

### Scenario 3: Expired Saved Session
```bash
# Saved session older than 7 days
# OR token expired

# Click "Dev Login"
# → Ignores expired session
# → Creates new demo user
# → Saves new session
```

### Scenario 4: Complete Backend Bypass
```bash
# services/agent-portal-service/.env
NODE_ENV=development
SKIP_AUTH=true

# All API calls succeed without JWT
# Uses X-Tenant-ID header or defaults to 'default'
```

---

## Troubleshooting

### Button Not Showing

**Check:**
```bash
# services/agent-portal/.env
VITE_ENABLE_DEV_LOGIN=true

# Restart required after .env changes
./manage.sh restart agent-portal
```

### Demo Login Fails

**Check backend logs:**
```bash
docker compose logs -f agent-portal-service

# Expected endpoint:
POST /api/agents/auth/demo → 200 OK
```

**Common issues:**
- Database connection failed (PostgreSQL down)
- Demo endpoint not implemented (check authController.js)

### Backend Rejects Dev Tokens

**Two options:**

1. **Keep JWT validation** (default):
   - Backend validates demo tokens normally
   - Requires `JWT_SECRET` to match

2. **Disable validation** (faster):
   ```bash
   # services/agent-portal-service/.env
   NODE_ENV=development
   SKIP_AUTH=true
   ```

### Session Not Persisting

**Check browser console:**
```javascript
localStorage.getItem('dev_last_session')
// Should return JSON string

// Manually clear:
localStorage.removeItem('dev_last_session')
```

---

## Security Notes

⚠️ **NEVER enable in production:**
- `VITE_ENABLE_DEV_LOGIN` exposes dev login UI
- `SKIP_AUTH` completely disables authentication
- Demo accounts have full admin access

✅ **Safe for development:**
- All features are localhost-only by default
- Saved sessions use sessionStorage/localStorage (not sent to server)
- PKCE verifiers cleared after use

---

## Advanced Usage

### Custom Dev User

Edit backend demo endpoint to customize user:

```javascript
// services/agent-portal-service/src/controllers/authController.js
async demoLogin(req, res) {
  const mockUser = {
    user_id: 'custom-dev-user',
    email: 'custom@dev.local',
    name: 'Custom Developer',
    tenant_id: 'custom-tenant',
    role: 'admin'
  };
  // ... rest of implementation
}
```

### Multiple Saved Sessions

Currently supports one saved session. To support multiple:

```javascript
// services/agent-portal/src/services/authService.js
saveLastSession(session, key = 'default') {
  localStorage.setItem(`dev_session_${key}`, JSON.stringify(session));
}
```

---

## Related Files

| File | Purpose |
|------|---------|
| `services/agent-portal/src/pages/Login.jsx` | Dev login UI button |
| `services/agent-portal/src/services/authService.js` | Dev login logic, session persistence |
| `services/agent-portal/src/contexts/AuthContext.jsx` | Dev login context integration |
| `services/agent-portal-service/src/controllers/authController.js` | Demo endpoint (`POST /api/agents/auth/demo`) |
| `services/agent-portal-service/src/middleware/authenticate.js` | SKIP_AUTH bypass logic |

---

## Rollback

To disable dev login completely:

```bash
# Frontend
cd services/agent-portal
echo "VITE_ENABLE_DEV_LOGIN=false" >> .env
./manage.sh restart agent-portal

# Backend (restore auth)
cd services/agent-portal-service
# Remove or comment:
# NODE_ENV=development
# SKIP_AUTH=true
./manage.sh restart agent-portal-service

# Clear saved sessions
# Open browser console:
localStorage.removeItem('dev_last_session')
```
