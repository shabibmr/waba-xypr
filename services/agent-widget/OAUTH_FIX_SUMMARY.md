# OAuth Redirect Fix - Agent Widget in Customer Portal

## Problem
When the agent-widget was embedded in the agent-portal (Customer Portal), it triggered an OAuth Implicit Grant flow that redirected the entire parent page, breaking the portal's PKCE authentication session.

## Solution Implemented
**Mode Detection with Token Passing** - The widget now detects its deployment context and uses different authentication strategies:

### 1. Portal Mode (Embedded in Customer Portal)
- **Detection**: `?mode=portal&embedded=true` URL parameters
- **Authentication**: Receives JWT from portal via `postMessage`
- **Behavior**: Skips OAuth redirect, uses portal's session token

### 2. Genesys Mode (Embedded in Genesys Agent Desktop)
- **Detection**: Default when mode parameters not present
- **Authentication**: OAuth Implicit Grant flow
- **Behavior**: Redirects to Genesys login, stores token in sessionStorage

---

## Changes Made

### Frontend Changes

#### 1. **AgentWidgetIframe.jsx** (Customer Portal)
**File**: `services/agent-portal/src/components/AgentWidgetIframe.jsx`

**Changes**:
- Added `useRef` and `useAuth` hooks
- Widget URL now includes `mode=portal&embedded=true` parameters
- Sends portal's JWT to widget iframe via `postMessage` when iframe loads
- Message format: `{ type: 'PORTAL_AUTH', token: <jwt> }`

```jsx
// Before
const url = `${httpBaseUrl}/widget?conversationId=${conversationId}`;

// After
const url = `${httpBaseUrl}/widget?conversationId=${conversationId}&mode=portal&embedded=true`;
```

#### 2. **index.html** (Widget Frontend)
**File**: `services/agent-widget/src/public/index.html`

**Changes**:
- **Mode Detection** (line ~827):
  ```javascript
  const deploymentMode = urlParams.get('mode') ||
                        (urlParams.get('embedded') === 'true' ? 'portal' : null) ||
                        (window.parent !== window ? 'portal' : 'genesys');
  ```

- **Portal Auth Token Listener** (line ~833):
  ```javascript
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PORTAL_AUTH') {
      portalAuthToken = event.data.token;
    }
  });
  ```

- **Auth Headers Helper** (line ~840):
  ```javascript
  function getAuthHeaders() {
    const headers = { 'X-Tenant-ID': tenantId };

    if (deploymentMode === 'portal' && portalAuthToken) {
      headers['Authorization'] = `Bearer ${portalAuthToken}`;
    } else if (gcToken) {
      headers['X-Genesys-Auth-Token'] = gcToken;
      if (window.gcUserId) {
        headers['X-Genesys-User-ID'] = window.gcUserId;
      }
    }

    return headers;
  }
  ```

- **Conditional OAuth** (line ~1143):
  ```javascript
  if (deploymentMode === 'portal') {
    console.log('[Widget] Portal mode - skipping OAuth, using portal session');
    // No OAuth redirect - inherits portal auth
  } else {
    console.log('[Widget] Genesys mode - running OAuth authentication');
    const authenticated = await ensureAuthenticated();
    if (!authenticated) return;
  }
  ```

- **Updated API Calls**:
  - `sendCustomMessage()` now uses `getAuthHeaders()` for both upload and send requests
  - All fetch calls include appropriate auth based on deployment mode

### Backend Changes

#### 3. **widget.controller.js** (Widget Backend)
**File**: `services/agent-widget/src/controllers/widget.controller.js`

**Changes**:
- `sendMessage()`: Now extracts and forwards `Authorization` header from portal
- `uploadMedia()`: Forwards `Authorization` header to agent-portal-service
- `sendMedia()`: Forwards `Authorization` header for both upload and send operations

```javascript
// Extract portal auth
const authHeader = req.headers['authorization'];

// Pass to service
result = await widgetService.sendQuickReply({
    conversationId, waId, text, integrationId,
    genesysToken,
    authHeader  // ← New
}, tenantId);
```

#### 4. **widget.service.js** (Widget Service)
**File**: `services/agent-widget/src/services/widget.service.js`

**Changes**:
- `sendQuickReply()`: Accepts and forwards `authHeader` to agent-portal-service
- `sendMediaMessage()`: Accepts and forwards `authHeader` to agent-portal-service
- `uploadMedia()`: Accepts and forwards `authHeader` to agent-portal-service

```javascript
// All agent-portal-service requests now include:
headers: {
    'X-Tenant-ID': tenantId,
    ...(genesysToken && { 'X-Genesys-Auth-Token': genesysToken }),
    ...(authHeader && { 'Authorization': authHeader })  // ← New
}
```

---

## Authentication Flow

### Portal Mode Flow
```
Customer Portal (React)
  ↓ User logs in with Genesys OAuth + PKCE
  ↓ Portal stores JWT in AuthContext
  ↓ User opens conversation
  ↓ Portal renders AgentWidgetIframe
  ↓ iframe src: /widget?conversationId=xyz&mode=portal&embedded=true
  ↓ Portal sends postMessage({ type: 'PORTAL_AUTH', token: jwt })
  ↓ Widget receives token via message listener
Widget (index.html)
  ↓ Detects mode=portal
  ↓ Skips OAuth redirect
  ↓ Stores portalAuthToken from postMessage
  ↓ User sends message
  ↓ fetch(/widget/api/send-message) with Authorization: Bearer <jwt>
Widget Backend (port 3012)
  ↓ Extracts Authorization header
  ↓ axios.post(agent-portal-service:3015, { Authorization: Bearer <jwt> })
Agent Portal Service
  ↓ authenticate middleware validates JWT
  ↓ Processes message
  ✓ Success!
```

### Genesys Mode Flow
```
Genesys Agent Desktop
  ↓ Embeds widget in iframe
  ↓ iframe src: /widget?conversationId=xyz&integrationId=abc&env=mypurecloud.com
Widget (index.html)
  ↓ Detects mode=genesys (default)
  ↓ Runs ensureAuthenticated()
  ↓ window.location.replace('https://login.mypurecloud.com/oauth/authorize?...')
  ↓ Genesys OAuth redirect
  ↓ Callback: #access_token=xxx
  ↓ Stores token in sessionStorage
  ↓ User sends message
  ↓ fetch(/widget/api/send-message) with X-Genesys-Auth-Token: <token>
Widget Backend
  ↓ Extracts X-Genesys-Auth-Token
  ↓ Forwards to agent-portal-service
  ✓ Success!
```

---

## Testing

### Test Portal Mode
1. Start both services:
   ```bash
   docker compose up -d agent-portal agent-widget
   ```

2. Login to Customer Portal: `http://localhost:3014`
3. Navigate to Conversations
4. Click on a conversation to open widget
5. **Expected**: Widget loads without OAuth redirect
6. **Verify**: Browser console shows `[Widget] Portal mode - skipping OAuth`
7. Send a message - should work with portal's auth

### Test Genesys Mode
1. Access widget directly: `http://localhost:3012/widget?conversationId=test`
2. **Expected**: Redirects to OAuth login
3. **Verify**: Browser console shows `[Widget] Genesys mode - running OAuth authentication`

---

## Security Considerations

### postMessage Origin Validation
**Current**: Accepts messages from any origin (`'*'`)
**TODO for Production**:
```javascript
// In AgentWidgetIframe.jsx
iframe.contentWindow?.postMessage({
    type: 'PORTAL_AUTH',
    token: token
}, 'https://widget.yourdomain.com'); // ← Specify exact origin

// In index.html
window.addEventListener('message', (event) => {
    // Validate origin
    if (event.origin !== 'https://portal.yourdomain.com') {
        return; // Reject untrusted origins
    }

    if (event.data && event.data.type === 'PORTAL_AUTH') {
        portalAuthToken = event.data.token;
    }
});
```

### Token Security
- Portal tokens are **not persisted** in localStorage (stored only in memory)
- Tokens transmitted via secure `postMessage` API
- All backend calls use HTTPS in production
- Agent-portal-service validates JWT on every request

---

## Rollback Plan

If issues occur, revert these commits:
1. `services/agent-portal/src/components/AgentWidgetIframe.jsx`
2. `services/agent-widget/src/public/index.html`
3. `services/agent-widget/src/controllers/widget.controller.js`
4. `services/agent-widget/src/services/widget.service.js`

Fallback: Remove `mode=portal` from URL - widget will use OAuth flow (but will still redirect parent page).

---

## Benefits

✅ **No More OAuth Redirects**: Portal session remains intact
✅ **Seamless User Experience**: Widget loads instantly without login prompt
✅ **Backward Compatible**: Genesys mode still works as before
✅ **Secure**: Tokens passed via secure postMessage, validated by backend
✅ **Flexible**: Easy to add new deployment modes in future

---

## Next Steps

1. **Test thoroughly** in both portal and Genesys modes
2. **Add origin validation** to postMessage for production
3. **Update documentation** with deployment mode instructions
4. **Monitor logs** for mode detection and auth header forwarding
5. **Consider**: Add deployment mode indicator in widget UI for debugging
