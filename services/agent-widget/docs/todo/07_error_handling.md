# Task 07 — Error Handling, Retry, Offline Detection

**Priority:** MEDIUM — improves reliability; FRD explicitly specifies retry behavior
**Depends on:** 01_foundation (error shapes), 03_websockets (reconnect), 05_messaging (send retry)
**Blocks:** Nothing

---

## Gap Summary

| FRD Requirement | Current State | Status |
|----------------|---------------|--------|
| Failed send → Retry button in UI | No retry button | ❌ Missing |
| WebSocket disconnect → auto-reconnect (1s, 2s, 5s backoff) | No WebSocket at all | ❌ Missing (handled in 03) |
| Offline: Banner UI | No offline detection | ❌ Missing |
| Duplicate messages: use unique `messageId` | No deduplication | ❌ Missing (handled in 05) |
| Retry send: 3 attempts, exponential backoff (100ms, 200ms, 400ms) | No retry at all | ❌ Missing |
| Structured error codes in all responses | Generic `{ error: 'Internal...' }` | ❌ Missing (started in 01) |
| Upload: progress bar via XMLHttpRequest | No file upload | ❌ Missing (see 08) |

---

## Tasks

### T7.1 — Backend: Structured Error Handler

**File:** `src/server.js` — replace global error handler

```javascript
// src/middleware/errorHandler.js
module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');

  // Log structured error
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'agent-widget',
    level: 'error',
    path: req.path,
    method: req.method,
    status,
    message,
    code,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  }));

  // Never expose stack in production
  res.status(status).json({
    error: {
      message: status === 500 && process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : message,
      code,
    },
  });
};
```

**Register in server.js** (must be last middleware):
```javascript
const errorHandler = require('./middleware/errorHandler');
// ... all routes ...
app.use(errorHandler);
```

---

### T7.2 — Backend: Upstream Error Wrapping

**File:** `src/services/widget.service.js`

When calling state-manager or whatsapp-api-service, wrap errors with context:

```javascript
async _callService(serviceLabel, fn) {
  try {
    return await fn();
  } catch (err) {
    const status = err.response?.status;
    const upstream = err.response?.data?.error?.message || err.message;

    if (status === 404) {
      const notFound = new Error(`${serviceLabel}: resource not found`);
      notFound.status = 404;
      notFound.code = 'NOT_FOUND';
      throw notFound;
    }

    const wrapped = new Error(`${serviceLabel} error: ${upstream}`);
    wrapped.status = 502;
    wrapped.code = 'UPSTREAM_ERROR';
    throw wrapped;
  }
}
```

Apply `_callService` wrapper around all Axios calls.

---

### T7.3 — Frontend: OfflineBanner Component

**New file:** `src/client/components/OfflineBanner.jsx`

```jsx
import React from 'react';

export default function OfflineBanner({ visible }) {
  if (!visible) return null;

  return (
    <div
      className="offline-banner"
      role="alert"
      aria-live="assertive"
      style={{
        background: '#ff4444',
        color: '#fff',
        padding: '8px 16px',
        textAlign: 'center',
        fontSize: '13px',
      }}
    >
      Connection lost — reconnecting…
    </div>
  );
}
```

---

### T7.4 — Frontend: Failed Message UI

**File:** `src/client/components/MessageList.jsx` — already partly defined in T5.5.

Expand to show error indicator and retry:

```jsx
{msg.status === 'failed' && (
  <span className="message__error" role="alert">
    ✗ Failed
    <button
      className="btn-retry"
      onClick={() => onRetry(msg)}
      aria-label={`Retry sending: ${msg.text}`}
    >
      Retry
    </button>
  </span>
)}
```

**CSS:**
```css
.message__error { color: #ff4444; font-size: 12px; }
.btn-retry {
  margin-left: 8px;
  padding: 2px 8px;
  background: none;
  border: 1px solid #ff4444;
  border-radius: 4px;
  color: #ff4444;
  cursor: pointer;
  font-size: 12px;
}
.btn-retry:hover { background: #ff4444; color: white; }
```

---

### T7.5 — Frontend: Retry Logic in InputBox

**File:** `src/client/components/InputBox.jsx` (from T4.7) — add retry support:

```javascript
const BACKOFFS = [100, 200, 400];

async function sendWithRetry(payload, attempt = 0) {
  try {
    return await sendMessage(payload);
  } catch (err) {
    if (attempt < BACKOFFS.length) {
      await sleep(BACKOFFS[attempt]);
      return sendWithRetry(payload, attempt + 1);
    }
    throw err;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

On final failure, call `markFailed(optimistic.id)`.

---

### T7.6 — Frontend: Error Boundary

**New file:** `src/client/components/ErrorBoundary.jsx`

```jsx
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[Widget] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen" role="alert">
          <p>Something went wrong. Please refresh the widget.</p>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Wrap App in main.jsx:**
```jsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

### T7.7 — Network Connectivity Detection

**File:** `src/client/App.jsx` or a dedicated hook

```javascript
useEffect(() => {
  const goOnline = () => setOnline(true);
  const goOffline = () => setOnline(false);
  window.addEventListener('online', goOnline);
  window.addEventListener('offline', goOffline);
  return () => {
    window.removeEventListener('online', goOnline);
    window.removeEventListener('offline', goOffline);
  };
}, []);
```

Show `<OfflineBanner />` when either:
- Network is offline (`!navigator.onLine`)
- WebSocket is disconnected

---

## Acceptance Criteria

- [ ] All backend 5xx errors return `{ error: { message, code } }` format
- [ ] 404 upstream errors return 404 to client (not 500)
- [ ] Frontend shows offline banner when WebSocket disconnects
- [ ] Offline banner hides when reconnection succeeds
- [ ] Failed messages display "✗ Failed" + Retry button
- [ ] Retry button re-attempts send with same payload
- [ ] After 3 failed retries, message stays in failed state
- [ ] ErrorBoundary catches React render errors and shows fallback UI
- [ ] Browser offline event triggers offline banner
