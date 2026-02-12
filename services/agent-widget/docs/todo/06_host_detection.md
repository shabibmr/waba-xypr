# Task 06 — Host Detection: Genesys vs Portal Mode

**Priority:** MEDIUM — required for Genesys iframe embedding (primary use case)
**Depends on:** 04_react_frontend (React hooks infrastructure)
**Blocks:** Nothing (but enables full Genesys integration)

---

## Gap Summary

| FRD Requirement | Current State | Status |
|----------------|---------------|--------|
| Detect host: if `window.Genesys` exists → genesys mode | URL param only, no SDK detection | ❌ Missing |
| Genesys mode: `conversationId = Genesys.getActiveConversationId()` | Uses URL param always | ❌ Missing |
| Portal mode: parse URL params | Done via URL params | ✅ Partial |
| Apply Genesys Lightning theme in genesys mode | Single theme only | ❌ Missing |
| SSO token from Genesys SDK context | URL param `?token=` only | ❌ Missing |
| Fallback: no SDK → use portal mode | No fallback logic | ❌ Missing |
| iframe sandbox: `allow-scripts` | Not configured at embed level (depends on Genesys config) | ⚠️ External |
| `postMessage` for cross-origin if needed | No postMessage handling | ❌ Missing |

---

## Tasks

### T6.1 — hostDetector Utility

**New file:** `src/client/utils/hostDetector.js`

```javascript
/**
 * Detects whether the widget is running inside Genesys Cloud
 * or the Customer Portal, based on SDK presence and URL params.
 */
export function detectMode() {
  // Check for Genesys Cloud CX SDK
  if (typeof window !== 'undefined' && window.Genesys && typeof window.Genesys === 'function') {
    return 'genesys';
  }

  // Check URL param override
  const mode = new URLSearchParams(window.location.search).get('mode');
  if (mode === 'genesys' || mode === 'portal') return mode;

  // Default to portal
  return 'portal';
}

/**
 * Get initialization parameters based on mode.
 * @returns {{ conversationId, tenantId, integrationId, token }}
 */
export function getInitParams(mode) {
  const urlParams = new URLSearchParams(window.location.search);

  if (mode === 'genesys') {
    return {
      conversationId: getGenesysConversationId(),
      tenantId: urlParams.get('tenantId'),
      integrationId: urlParams.get('integrationId'),
      token: getGenesysToken(),
    };
  }

  // Portal mode
  return {
    conversationId: urlParams.get('conversationId'),
    tenantId: urlParams.get('tenantId'),
    integrationId: urlParams.get('integrationId'),
    token: urlParams.get('token') || getCookieToken(),
  };
}

function getGenesysConversationId() {
  try {
    // Primary method for Genesys Cloud agent desktop SDK
    if (window.Genesys && typeof window.Genesys.getActiveConversationId === 'function') {
      return window.Genesys.getActiveConversationId();
    }
    // Fallback: URL param
    return new URLSearchParams(window.location.search).get('conversationId');
  } catch {
    return new URLSearchParams(window.location.search).get('conversationId');
  }
}

function getGenesysToken() {
  try {
    if (window.Genesys && typeof window.Genesys.getToken === 'function') {
      return window.Genesys.getToken();
    }
  } catch {}
  return new URLSearchParams(window.location.search).get('token') || '';
}

function getCookieToken() {
  const match = document.cookie.match(/(?:^|;\s*)session_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}
```

---

### T6.2 — Genesys SDK Event Listeners

**New file:** `src/client/hooks/useGenesys.js`

```javascript
import { useEffect, useState } from 'react';

/**
 * Hook for Genesys Cloud SDK integration.
 * Listens for conversation changes if running in Genesys mode.
 */
export function useGenesys(enabled) {
  const [activeConversationId, setActiveConversationId] = useState(null);

  useEffect(() => {
    if (!enabled || !window.Genesys) return;

    // Listen for active conversation changes in Genesys
    const onConversationChanged = (event) => {
      const id = event?.detail?.conversationId || event?.conversationId;
      if (id) setActiveConversationId(id);
    };

    try {
      // Genesys CX SDK event subscription (adjust event name per SDK version)
      window.Genesys('subscribe', 'Conversations.changed', onConversationChanged);
    } catch (err) {
      console.warn('[Widget] Genesys SDK subscription failed:', err.message);
    }

    return () => {
      try {
        window.Genesys('unsubscribe', 'Conversations.changed', onConversationChanged);
      } catch {}
    };
  }, [enabled]);

  return { activeConversationId };
}
```

---

### T6.3 — postMessage Cross-Origin Support

**New file:** `src/client/utils/postMessageBridge.js`

```javascript
/**
 * Handles cross-origin communication via window.postMessage.
 * Used when the widget is embedded in an iframe with cross-origin restrictions.
 */
export function initPostMessageBridge(handlers) {
  const allowedOrigins = [
    'https://apps.mypurecloud.com',
    'https://apps.mypurecloud.de',
    'https://apps.mypurecloud.jp',
    window.location.origin,
  ];

  function onMessage(event) {
    if (!allowedOrigins.includes(event.origin)) return;

    const { type, payload } = event.data || {};
    if (!type || !handlers[type]) return;

    handlers[type](payload);
  }

  window.addEventListener('message', onMessage);

  return () => window.removeEventListener('message', onMessage);
}

/**
 * Send a message to the parent frame.
 */
export function sendToParent(type, payload) {
  if (window.parent !== window) {
    window.parent.postMessage({ type, payload }, '*');
  }
}
```

**Usage example in App.jsx:**
```javascript
useEffect(() => {
  const cleanup = initPostMessageBridge({
    'WIDGET_INIT': ({ conversationId, tenantId }) => {
      // Parent frame overrides context
    },
    'WIDGET_TOKEN_REFRESH': ({ token }) => {
      // Handle token refresh from parent
    },
  });
  return cleanup;
}, []);
```

---

### T6.4 — Mode-Aware Widget Title / Branding

**File:** `src/client/App.jsx`

```jsx
const TITLES = {
  genesys: 'WhatsApp — Genesys',
  portal: 'WhatsApp Chat',
};

useEffect(() => {
  document.title = TITLES[init.mode] || 'WhatsApp Widget';
}, [init.mode]);
```

---

### T6.5 — Error UI for Missing SDK Context

**File:** `src/client/components/ErrorScreen.jsx`

```jsx
export default function ErrorScreen({ message }) {
  const isGenesysError = message === 'InvalidConversation' && detectMode() === 'genesys';
  return (
    <div className="error-screen" role="alert">
      {isGenesysError ? (
        <p>No active Genesys conversation. Please select an active interaction.</p>
      ) : (
        <p>Error: {message}</p>
      )}
    </div>
  );
}
```

---

### T6.6 — Update useWidgetInit to Use hostDetector

**File:** `src/client/hooks/useWidgetInit.js` (created in T4.2)

Replace the inline detection logic with the `hostDetector` module:

```javascript
import { detectMode, getInitParams } from '../utils/hostDetector';

// In useEffect:
const mode = detectMode();
const params = getInitParams(mode);
// params.token is now correctly sourced per mode
```

---

## Acceptance Criteria

- [ ] Widget loads in `genesys` mode when `window.Genesys` is present
- [ ] Widget loads in `portal` mode when no Genesys SDK and no mode param
- [ ] `mode=genesys` URL param forces Genesys mode even without SDK
- [ ] Genesys mode applies `theme-genesys` CSS class
- [ ] Portal mode applies `theme-portal` CSS class
- [ ] `window.Genesys.getActiveConversationId()` called in Genesys mode
- [ ] Falls back to URL param `?conversationId=` if SDK call fails
- [ ] `postMessage` events from Genesys origin (`mypurecloud.com`) are accepted
- [ ] Error screen shows "No active Genesys conversation" in Genesys mode context error
