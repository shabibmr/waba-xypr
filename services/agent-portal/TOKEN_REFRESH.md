# Token Auto-Refresh Implementation

Automatic JWT token refresh mechanism for seamless user authentication without interruptions.

## Overview

The system implements a dual-token strategy:
- **Access Token**: Short-lived (1 hour) - Used for API requests
- **Refresh Token**: Long-lived (7 days) - Used to obtain new access tokens

## Architecture

### Backend (agent-portal-service)

**Token Generation:**
- Access tokens expire in 1 hour
- Refresh tokens expire in 7 days
- Both tokens are JWT signed with the server secret
- Tokens include user ID, tenant ID, and token type

**Session Management:**
- Sessions stored in `genesys_user_sessions` table
- Tracks both access and refresh tokens
- Sessions can be invalidated (logout)
- Expired sessions are automatically cleaned up

**Endpoints:**
```
POST /api/agents/auth/refresh
  Body: { refreshToken: string }
  Response: { accessToken: string, refreshToken: string, expiresIn: number }

POST /api/agents/auth/logout
  Invalidates current session

POST /api/agents/auth/logout-all
  Invalidates all sessions for the user
```

### Frontend (agent-portal)

**Auto-Refresh Strategy:**
1. **Timer-based**: Token refreshed 5 minutes before expiry
2. **Interceptor-based**: Automatic refresh on 401 errors

**Components:**
- `authService.js`: Token storage and refresh logic
- `AuthContext.jsx`: Auto-refresh timer management
- `axiosInterceptor.js`: HTTP interceptor for 401 handling

## How It Works

### 1. Initial Login

```
User → Genesys OAuth → Backend
  ↓
Backend generates:
  - Access Token (1h)
  - Refresh Token (7d)
  ↓
Frontend stores both tokens
  ↓
Setup auto-refresh timer
```

### 2. Auto-Refresh Timer

```javascript
// Calculate refresh time (5 minutes before expiry)
const expiryTime = authService.getTokenExpiryTime(accessToken);
const refreshIn = expiryTime - 300; // 5 minutes buffer

// Set timer
setTimeout(async () => {
  await authService.refreshAccessToken();
  setupRefreshTimer(); // Setup next refresh
}, refreshIn * 1000);
```

**Example Timeline:**
```
00:00 - Login (token expires at 01:00)
00:55 - Auto-refresh triggered (5 min before expiry)
00:55 - New token issued (expires at 01:55)
01:50 - Auto-refresh triggered again
```

### 3. Interceptor-based Refresh (Fallback)

If a request fails with 401 (e.g., due to network issues causing missed refresh):

```
API Request → 401 Error
  ↓
Interceptor catches error
  ↓
Attempt token refresh
  ↓
Success: Retry original request
Failure: Logout user
```

**Request Queueing:**
- If multiple requests fail simultaneously, only one refresh is triggered
- Other requests are queued and replayed after refresh completes

## Token Structure

### Access Token Payload
```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "role": "agent",
  "type": "access",
  "iat": 1234567890,
  "exp": 1234571490
}
```

### Refresh Token Payload
```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "type": "refresh",
  "iat": 1234567890,
  "exp": 1235172690
}
```

## Security Features

### Token Validation
- Signature verification using JWT secret
- Type checking (access vs refresh)
- Expiry time validation
- Session active status check

### Session Management
- Tokens stored in httpOnly localStorage (frontend)
- Sessions tracked in database (backend)
- Invalid sessions rejected
- Refresh tokens rotated on each refresh

### Logout Protection
- Logout invalidates session in database
- Logout all devices invalidates all user sessions
- Expired sessions auto-cleaned from database

## Error Handling

### Frontend
```javascript
try {
  await authService.refreshAccessToken();
} catch (error) {
  // Refresh failed - logout user
  authService.clearAuth();
  navigate('/login');
}
```

### Backend
```javascript
// Invalid refresh token
if (!session || !session.is_active) {
  return res.status(401).json({ error: 'Session not found or expired' });
}
```

## Configuration

### Backend Environment Variables
```bash
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d  # Refresh token expiry (not used for access tokens)
```

### Frontend Constants
```javascript
// authService.js
ACCESS_TOKEN_EXPIRY = '1h'
REFRESH_TOKEN_EXPIRY = '7d'
REFRESH_BUFFER = 300 // 5 minutes (in seconds)
```

## Testing Token Refresh

### Manual Testing

1. **Login and wait for auto-refresh:**
   ```bash
   # Login
   # Wait 55 minutes
   # Check console: "Auto-refreshing token..."
   # Verify new token in localStorage
   ```

2. **Test interceptor refresh:**
   ```bash
   # Login
   # Manually expire access token in localStorage
   # Make API request
   # Verify 401 triggers refresh
   ```

3. **Test refresh failure:**
   ```bash
   # Login
   # Delete refresh token from localStorage
   # Wait for auto-refresh attempt
   # Verify user is logged out
   ```

### Automated Testing

```javascript
// Test token decode
const decoded = authService.decodeToken(accessToken);
expect(decoded.type).toBe('access');

// Test expiry check
const isExpired = authService.isTokenExpired(accessToken);
expect(isExpired).toBe(false);

// Test refresh
const newToken = await authService.refreshAccessToken();
expect(newToken).toBeDefined();
```

## Troubleshooting

### Token not refreshing automatically
- Check browser console for timer setup
- Verify token has valid expiry time
- Check if refresh token exists in localStorage

### 401 errors not triggering refresh
- Verify axios interceptor is setup
- Check if request is to excluded endpoint (login/callback)
- Verify refresh token is valid

### Session expired immediately after refresh
- Check server time vs client time (clock skew)
- Verify JWT_SECRET matches between deployments
- Check database session records

## Best Practices

1. **Never store tokens in plain cookies** - Use httpOnly or localStorage
2. **Always use HTTPS in production** - Prevent token interception
3. **Rotate refresh tokens** - Generate new refresh token on each refresh
4. **Implement token blacklist** - For additional security (Task #4)
5. **Monitor failed refreshes** - Alert on suspicious patterns
6. **Set appropriate expiry times** - Balance security vs UX

## Future Enhancements

- [ ] Redis-based token blacklist (Task #4)
- [ ] Multi-device session management
- [ ] Push-based token revocation
- [ ] Refresh token family tracking (detect token reuse)
- [ ] Configurable token expiry per tenant
- [ ] Remember me functionality (30-day tokens)
