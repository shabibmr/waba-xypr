# Dev Login: Real User Restoration (Database-Based)

## ✅ Implementation Complete

Your dev login now **restores your ACTUAL last login from the database** instead of creating a demo user.

---

## What Changed

### Before (Demo User)
```
Click "Dev Login"
  ↓
Creates demo-user-001
  ↓
Fake credentials
```

### After (Real User Restore)
```
Click "Dev Login"
  ↓
Queries database for last logged-in user
  ↓
Restores YOUR actual account + tokens
```

---

## How It Works

### Two-Tier Approach

**Tier 1: localStorage Cache (Fast Path)**
1. Click "Dev Login" button
2. Checks `localStorage.dev_last_session`
3. If valid token exists → instant login (no network call)
4. Redirects to `/workspace`

**Tier 2: Database Restore (Fallback)**
1. If no localStorage cache or expired
2. Calls `POST /api/agents/auth/restore-last`
3. Backend queries database:
   ```sql
   SELECT user_id, genesys_email, name, role, tenant_id, last_login_at
   FROM genesys_users
   WHERE is_active = true AND last_login_at IS NOT NULL
   ORDER BY last_login_at DESC
   LIMIT 1;
   ```
4. Retrieves existing active session or generates new tokens
5. Returns your real user data
6. Saves to localStorage for next time

---

## Database Schema Used

### Tables Queried

**genesys_users** (User accounts)
```sql
user_id UUID PRIMARY KEY
tenant_id VARCHAR(50)
genesys_user_id VARCHAR(255) UNIQUE
genesys_email VARCHAR(255)
name VARCHAR(255)
role VARCHAR(50)  -- admin, supervisor, agent
last_login_at TIMESTAMP  -- ← Key field!
is_active BOOLEAN
```

**genesys_user_sessions** (Active sessions)
```sql
session_id UUID PRIMARY KEY
user_id UUID FOREIGN KEY
access_token TEXT
refresh_token TEXT
expires_at TIMESTAMP
created_at TIMESTAMP
ip_address INET
user_agent TEXT
```

---

## Files Modified

### Backend

| File | Change |
|------|--------|
| `models/Agent.js` | Added `getLastLoggedInUser()` and `getActiveSession()` methods |
| `controllers/authController.js` | Added `restoreLastLogin()` endpoint function |
| `routes/agentRoutes.js` | Added route: `POST /api/agents/auth/restore-last` |

### Frontend

| File | Change |
|------|--------|
| `services/authService.js` | Modified `devLogin()` to call restore endpoint |
| `pages/Login.jsx` | Updated help text: "Restores your last login from database" |

### Documentation

| File | Status |
|------|--------|
| `QUICK_START_DEV_LOGIN.md` | ✅ Updated with database restore flow |
| `DEV_LOGIN_SETUP.md` | ⚠️ May need update (still mentions demo user) |

---

## API Endpoint

### POST /api/agents/auth/restore-last

**Request:** (No body required)
```bash
curl -X POST http://localhost:3000/api/agents/auth/restore-last
```

**Response (Success):**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "refresh...",
  "agent": {
    "user_id": "a1b2c3d4-5e6f-7890-abcd-ef1234567890",
    "name": "Your Real Name",
    "email": "you@company.com",
    "role": "admin",
    "tenant_id": "t_abc123def456"
  },
  "organization": {
    "id": "your-org-id",
    "name": "Your Organization"
  },
  "isRestored": true
}
```

**Response (No Previous Login):**
```json
{
  "error": "No previous login found in database. Please use OAuth login first or use demo login."
}
```

---

## Usage

### 1. Initial Setup (One Time)
```bash
# You MUST do one OAuth login first to populate database
# Visit http://localhost:3014/login
# Click "Sign in with Genesys Cloud"
# Complete OAuth flow
```

### 2. Dev Login (Forever After)
```bash
# Every subsequent login:
# Visit http://localhost:3014/login
# Click "Dev Login (Skip OAuth)"
# ✅ Restores your real account instantly!
```

---

## What Gets Restored

| Field | Source | Example |
|-------|--------|---------|
| **User ID** | Database | `a1b2c3d4-5e6f-7890-abcd-ef1234567890` |
| **Email** | Your Genesys email | `john.doe@company.com` |
| **Name** | Your real name | `John Doe` |
| **Tenant** | Your organization tenant | `t_abc123def456` |
| **Role** | Your assigned role | `admin` / `supervisor` / `agent` |
| **Access Token** | Existing or new JWT | Valid for session duration |
| **Refresh Token** | Existing or new | Valid for 7 days |

---

## Troubleshooting

### Error: "No previous login found"

**Cause:** You've never logged in via OAuth before.

**Solution:**
```bash
# Option 1: Do one OAuth login first
# Visit http://localhost:3014/login
# Click "Sign in with Genesys Cloud"

# Option 2: Check database manually
docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys -c \
  "SELECT user_id, genesys_email, last_login_at FROM genesys_users ORDER BY last_login_at DESC;"

# Option 3: Use demo login (if you still need it)
# Call POST /api/agents/auth/demo directly
```

### localStorage Not Persisting

```javascript
// Browser console:
localStorage.getItem('dev_last_session')
// Should return JSON string

// Clear if corrupted:
localStorage.removeItem('dev_last_session')
```

### Wrong User Restored

```sql
-- Check who will be restored:
SELECT user_id, genesys_email, name, last_login_at
FROM genesys_users
WHERE is_active = true AND last_login_at IS NOT NULL
ORDER BY last_login_at DESC
LIMIT 1;

-- If wrong user, do OAuth login with correct account
-- That will update last_login_at
```

---

## Security Considerations

✅ **Safer than demo login:**
- Uses real user accounts from database
- Respects existing permissions and roles
- No hardcoded credentials

⚠️ **Still development-only:**
- Never enable `VITE_ENABLE_DEV_LOGIN=true` in production
- Anyone with localhost access can restore any user's session
- Use only on secured development machines

🔒 **Token security:**
- Refresh tokens valid for 7 days
- Access tokens expire per `JWT_EXPIRES_IN` setting
- Old sessions cleaned up on logout

---

## Testing

```bash
# 1. Restart services with new code
./manage.sh restart agent-portal agent-portal-service

# 2. Verify endpoint exists
curl -X POST http://localhost:3000/api/agents/auth/restore-last

# Expected if no login: 404 "No previous login found"

# 3. Do OAuth login (if needed)
# Visit http://localhost:3014/login
# Click "Sign in with Genesys Cloud"
# Complete OAuth flow

# 4. Clear localStorage to force database query
# Browser console:
localStorage.removeItem('dev_last_session')

# 5. Click "Dev Login (Skip OAuth)"
# Should restore your real account!

# 6. Check browser console logs:
# [DevLogin] Restoring last login from database
# [DevLogin] Restored user: you@company.com | Last login restored: true
```

---

## Comparison: Demo vs Restore

| Feature | Demo Login | Restore Last Login (NEW) |
|---------|------------|--------------------------|
| **User** | Fake `demo-user-001` | Your real account |
| **Email** | `demo@example.com` | Your Genesys email |
| **Tenant** | `demo-tenant-001` | Your real tenant |
| **Tokens** | Always new | Reuses existing or generates |
| **Requirements** | None | Must OAuth login once first |
| **Use Case** | Testing without real account | Skip OAuth after initial setup |

---

## Next Steps

✅ **You're ready to use it!**

```bash
# If not already done:
./manage.sh restart agent-portal agent-portal-service

# Then:
# 1. Visit http://localhost:3014/login
# 2. Click "Dev Login (Skip OAuth)"
# 3. Profit! 🎉
```

**Note:** You MUST have logged in via OAuth at least once. If you haven't, the endpoint will return 404.

---

**Status:** ✅ Fully implemented and ready
**Date:** 2024-03-26
**Breaking Changes:** None (backward compatible, demo login still exists)
