# Quick Start: Dev Login (OAuth Bypass)

Skip OAuth authentication for testing - use your last login or create a demo account.

## ⚡ Instant Setup (30 seconds)

```bash
# 1. Enable dev login
./scripts/enable-dev-login.sh

# 2. Restart services
./manage.sh restart agent-portal agent-portal-service

# 3. Open browser
# http://localhost:3014/login
# Click "Dev Login (Skip OAuth)" button
```

## 🎯 What You Get

✅ **Skip OAuth Flow**
No popup, no Genesys credentials needed

✅ **Restore Real User**
Uses your ACTUAL last login from database

✅ **Session Replay**
Cached in localStorage for instant login

✅ **Valid Tokens**
Reuses existing tokens or generates fresh ones

## 🔧 Manual Configuration

### Frontend Only (Recommended)

```bash
# services/agent-portal/.env
VITE_ENABLE_DEV_LOGIN=true
```

### Backend Bypass (Optional)

```bash
# services/agent-portal-service/.env
NODE_ENV=development
SKIP_AUTH=true  # Skips all JWT validation
```

## 📱 Usage

### Login Page
```
┌─────────────────────────────────────┐
│   Sign in with Genesys Cloud        │ ← OAuth (normal)
├─────────────────────────────────────┤
│   Dev Login (Skip OAuth)            │ ← Click this!
└─────────────────────────────────────┘
```

### First Time (After OAuth Login)
- Queries: Most recent user from `genesys_users` table
- Reuses: Existing valid session tokens
- Or generates: New tokens if session expired
- Saves: To localStorage for instant replay

### Next Time
- Fast path: Restores from localStorage cache
- Fallback: Queries database for last login
- Instant redirect to workspace

### What Gets Restored
- Your REAL user account (not demo!)
- Email: Your actual Genesys email
- Tenant: Your real tenant ID
- Role: Your assigned role (admin/supervisor/agent)
- Tokens: Either existing or freshly generated

## 🚨 Troubleshooting

### Button Not Showing?
```bash
# Check frontend .env
cat services/agent-portal/.env | grep VITE_ENABLE_DEV_LOGIN
# Should show: VITE_ENABLE_DEV_LOGIN=true

# Restart required
./manage.sh restart agent-portal
```

### "No previous login found"?
```bash
# This means you've never logged in via OAuth before
# Solution: Do one OAuth login first, then use dev login forever

# Or check database for users:
docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys -c \
  "SELECT user_id, genesys_email, last_login_at FROM genesys_users ORDER BY last_login_at DESC LIMIT 5;"

# Verify restore endpoint exists
curl -X POST http://localhost:3000/api/agents/auth/restore-last
```

### Backend Rejects Tokens?
```bash
# Option 1: Keep validation (default)
# Backend validates demo tokens normally

# Option 2: Disable validation
# Edit services/agent-portal-service/.env
SKIP_AUTH=true
```

## 🔒 Security

⚠️ **Development Only**
- Never enable in production
- Restores real user accounts with full access
- Sessions stored in browser localStorage
- **Requirement:** You must have logged in via OAuth at least once

## 📚 Full Documentation

- **Setup Guide:** [DEV_LOGIN_SETUP.md](./DEV_LOGIN_SETUP.md)
- **Architecture:** [CLAUDE.md](./CLAUDE.md#customer-portal-authentication)

## 🎨 Implementation Details

### Files Modified
- ✅ `services/agent-portal/src/pages/Login.jsx` - Dev button UI
- ✅ `services/agent-portal/src/services/authService.js` - Dev login + session persistence
- ✅ `services/agent-portal/src/contexts/AuthContext.jsx` - Context integration
- ✅ `services/agent-portal-service/src/controllers/authController.js` - `restoreLastLogin()` endpoint
- ✅ `services/agent-portal-service/src/models/Agent.js` - DB queries for last login
- ✅ `services/agent-portal-service/src/routes/agentRoutes.js` - Route: `POST /api/agents/auth/restore-last`

### Session Storage (localStorage cache)
```javascript
// localStorage.dev_last_session
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "refresh...",
  "agent": {
    "user_id": "a1b2c3d4-...",           // Real UUID
    "email": "you@company.com",          // Your real email
    "name": "Your Real Name",
    "tenant_id": "t_abc123...",          // Real tenant
    "role": "admin"                       // Your role
  },
  "genesysOrg": {
    "id": "your-org-id",
    "name": "Your Organization"
  },
  "savedAt": 1710000000000
}
```

### Database Query (backend fallback)
```sql
-- Step 1: Find most recent active user
SELECT user_id, genesys_email, name, role, tenant_id, last_login_at
FROM genesys_users
WHERE is_active = true AND last_login_at IS NOT NULL
ORDER BY last_login_at DESC
LIMIT 1;

-- Step 2: Get their active session tokens
SELECT access_token, refresh_token, expires_at
FROM genesys_user_sessions
WHERE user_id = $1 AND expires_at > NOW()
ORDER BY created_at DESC
LIMIT 1;

-- Step 3: If no valid session, generate new tokens
```

## 🔄 Disable Dev Login

```bash
# Edit services/agent-portal/.env
VITE_ENABLE_DEV_LOGIN=false

# Restart
./manage.sh restart agent-portal

# Clear saved sessions (browser console)
localStorage.removeItem('dev_last_session')
```

---

**Status:** ✅ Ready to use
**Last Updated:** 2024-03-26
