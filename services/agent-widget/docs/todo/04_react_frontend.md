# Task 04 — React Frontend Migration

**Priority:** HIGH — FRD explicitly requires React; current vanilla JS is a placeholder
**Depends on:** 01_foundation (API paths), 02_auth (token handling), 03_websockets (socket client)
**Blocks:** 05_messaging (React send flow), 06_host_detection (React hooks), 08_media (React components)

---

## Gap Summary

| FRD Requirement | Current State | Status |
|----------------|---------------|--------|
| React + Socket.IO client | Single HTML file with vanilla JS | ❌ Wrong tech |
| React hooks for init (detectMode, initWidget) | No hooks — inline `<script>` | ❌ Missing |
| Components: MessageList, InputBox, StatusIcons | None (plain DOM manipulation) | ❌ Missing |
| CSS vars for theming (Genesys Lightning vs Portal) | Single hardcoded CSS | ❌ Missing |
| ARIA roles, keyboard nav (Enter to send) | No accessibility attributes | ❌ Missing |
| Inline media previews (`<img>`, `<video>`) | Text-only display | ❌ Missing |
| Status tick icons (sent/delivered/read) | Emoji (📱/💬) only | ❌ Missing |
| Component: SecurityWrapper HOC (tenant check) | No HOC | ❌ Missing |

---

## Tasks

### T4.1 — Initialize React App

**Decision:** Keep the existing Express backend. Add a React frontend served as a static build from `src/public/`.

```bash
cd services/agent-widget
npm install react react-dom
npm install --save-dev @vitejs/plugin-react vite
```

**New file:** `vite.config.js`
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3012',
      '/socket.io': { target: 'http://localhost:3012', ws: true },
    },
  },
});
```

**New directory:** `src/client/`
- `src/client/index.html` — Vite entry HTML
- `src/client/main.jsx` — React entry point
- `src/client/App.jsx` — Root app component
- `src/client/components/` — UI components
- `src/client/hooks/` — Custom hooks
- `src/client/services/` — API + socket client
- `src/client/styles/` — CSS variables and themes

**Add build script to `package.json`:**
```json
"scripts": {
  "build:client": "vite build",
  "dev:client": "vite",
  "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
  "dev:server": "nodemon src/server.js"
}
```

---

### T4.2 — useWidgetInit Hook (Context Resolution + Mode Detection)

**New file:** `src/client/hooks/useWidgetInit.js`

```javascript
import { useState, useEffect } from 'react';
import { detectMode } from '../utils/hostDetector';
import { resolveContext } from '../services/widgetApi';

export function useWidgetInit() {
  const [state, setState] = useState({
    mode: null,
    conversationId: null,
    tenantId: null,
    waId: null,
    integrationId: null,
    pciMode: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function init() {
      try {
        const mode = detectMode();
        const params = getInitParams(mode);

        const ctx = await resolveContext(params.conversationId, params.tenantId);
        if (!ctx.valid) throw new Error('InvalidConversation');

        setState({
          mode,
          conversationId: params.conversationId,
          tenantId: ctx.tenantId,
          waId: ctx.wa_id,
          integrationId: params.integrationId,
          pciMode: ctx.pciMode || false,
          loading: false,
          error: null,
        });
      } catch (err) {
        setState(s => ({ ...s, loading: false, error: err.message }));
      }
    }
    init();
  }, []);

  return state;
}

function getInitParams(mode) {
  if (mode === 'genesys' && window.Genesys) {
    return {
      conversationId: window.Genesys.getActiveConversationId?.(),
      tenantId: new URLSearchParams(window.location.search).get('tenantId'),
      integrationId: new URLSearchParams(window.location.search).get('integrationId'),
    };
  }
  const p = new URLSearchParams(window.location.search);
  return {
    conversationId: p.get('conversationId'),
    tenantId: p.get('tenantId'),
    integrationId: p.get('integrationId'),
  };
}
```

---

### T4.3 — App Component with Theme Switching

**New file:** `src/client/App.jsx`

```jsx
import React from 'react';
import { useWidgetInit } from './hooks/useWidgetInit';
import { useSocket } from './hooks/useSocket';
import ChatUI from './components/ChatUI';
import LoadingScreen from './components/LoadingScreen';
import ErrorScreen from './components/ErrorScreen';

export default function App() {
  const init = useWidgetInit();

  // Apply theme as CSS class on body
  React.useEffect(() => {
    if (init.mode) {
      document.body.className = init.mode === 'genesys' ? 'theme-genesys' : 'theme-portal';
    }
  }, [init.mode]);

  if (init.loading) return <LoadingScreen />;
  if (init.error) return <ErrorScreen message={init.error} />;

  return (
    <SecurityWrapper tenantId={init.tenantId}>
      <ChatUI
        conversationId={init.conversationId}
        tenantId={init.tenantId}
        waId={init.waId}
        mode={init.mode}
        pciMode={init.pciMode}
      />
    </SecurityWrapper>
  );
}
```

---

### T4.4 — ChatUI Component

**New file:** `src/client/components/ChatUI.jsx`

```jsx
import React, { useState } from 'react';
import MessageList from './MessageList';
import InputBox from './InputBox';
import CustomerInfo from './CustomerInfo';
import OfflineBanner from './OfflineBanner';
import { useSocket } from '../hooks/useSocket';
import { useMessages } from '../hooks/useMessages';

export default function ChatUI({ conversationId, tenantId, waId, mode, pciMode }) {
  const { connected } = useSocket(tenantId, conversationId);
  const { messages, addMessage, updateStatus } = useMessages(conversationId, tenantId);

  return (
    <div className="chat-container">
      <OfflineBanner visible={!connected} />
      <CustomerInfo waId={waId} tenantId={tenantId} />
      <MessageList messages={messages} />
      {!pciMode && (
        <InputBox
          conversationId={conversationId}
          tenantId={tenantId}
          waId={waId}
          onMessageSent={addMessage}
        />
      )}
      {pciMode && <div className="pci-notice">Input disabled — PCI compliance mode</div>}
    </div>
  );
}
```

---

### T4.5 — MessageList Component

**New file:** `src/client/components/MessageList.jsx`

```jsx
import React, { useEffect, useRef } from 'react';
import StatusIcons from './StatusIcons';
import MediaPreview from './MediaPreview';

export default function MessageList({ messages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!messages.length) {
    return <div className="empty-state">No messages yet</div>;
  }

  return (
    <div className="message-list" role="log" aria-live="polite" aria-label="Conversation messages">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`message message--${msg.direction}`}
          role="article"
        >
          {msg.mediaUrl && <MediaPreview url={msg.mediaUrl} type={msg.mediaType} />}
          {msg.text && <p className="message__text">{msg.text}</p>}
          <div className="message__meta">
            <span className="message__time">{formatTime(msg.timestamp)}</span>
            {msg.direction === 'outbound' && <StatusIcons status={msg.status} />}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
```

---

### T4.6 — StatusIcons Component

**New file:** `src/client/components/StatusIcons.jsx`

```jsx
import React from 'react';

// WhatsApp-style tick icons
// sent = 1 gray tick, delivered = 2 gray ticks, read = 2 blue ticks
export default function StatusIcons({ status }) {
  if (!status) return null;

  const icons = {
    pending: <span className="tick tick--pending" aria-label="Pending">○</span>,
    sent: <span className="tick tick--sent" aria-label="Sent">✓</span>,
    delivered: <span className="tick tick--delivered" aria-label="Delivered">✓✓</span>,
    read: <span className="tick tick--read" aria-label="Read">✓✓</span>,
    failed: <span className="tick tick--failed" aria-label="Failed">✗</span>,
  };

  return <span className="status-icons">{icons[status] || null}</span>;
}

/* CSS:
.tick--sent, .tick--delivered { color: #8a8a8a; }
.tick--read { color: #53bdeb; }
.tick--failed { color: #ff4444; }
*/
```

---

### T4.7 — InputBox Component (with keyboard nav)

**New file:** `src/client/components/InputBox.jsx`

```jsx
import React, { useState, useRef } from 'react';
import { sendMessage } from '../services/widgetApi';

export default function InputBox({ conversationId, tenantId, waId, onMessageSent }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const optimistic = { id: Date.now().toString(), direction: 'outbound', text, status: 'pending', timestamp: new Date() };
    onMessageSent(optimistic);
    setText('');
    try {
      await sendMessage({ conversationId, tenantId, waId, text, integrationId: window.__INTEGRATION_ID__ });
    } catch (err) {
      // Mark message as failed (handled by useMessages hook via socket)
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="input-box" role="form" aria-label="Send a message">
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message…"
        aria-label="Message text"
        rows={2}
        disabled={sending}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || sending}
        aria-label="Send message"
      >
        {sending ? '…' : 'Send'}
      </button>
    </div>
  );
}
```

---

### T4.8 — CSS Theme Variables

**New file:** `src/client/styles/themes.css`

```css
/* Portal theme */
body.theme-portal {
  --color-primary: #25D366;
  --color-primary-dark: #128C7E;
  --color-bg: #f5f5f5;
  --color-msg-inbound-bg: #E8F5E9;
  --color-msg-outbound-bg: #E3F2FD;
  --color-text: #333;
  --color-tick-sent: #8a8a8a;
  --color-tick-read: #53bdeb;
}

/* Genesys Lightning theme */
body.theme-genesys {
  --color-primary: #0070d2;
  --color-primary-dark: #005fb2;
  --color-bg: #f4f6f9;
  --color-msg-inbound-bg: #f0f4ff;
  --color-msg-outbound-bg: #e8f4e8;
  --color-text: #16325c;
  --color-tick-sent: #8a8a8a;
  --color-tick-read: #0070d2;
}
```

---

### T4.9 — SecurityWrapper HOC

**New file:** `src/client/components/SecurityWrapper.jsx`

```jsx
import React from 'react';

export default function SecurityWrapper({ tenantId, children }) {
  if (!tenantId) {
    return (
      <div className="error-screen" role="alert">
        <p>Access denied: tenant context missing.</p>
      </div>
    );
  }
  return children;
}
```

---

### T4.10 — Update Dockerfile for React Build

**File:** `Dockerfile`

Add a build stage for the React client:
```dockerfile
# Stage: build client
FROM node:20-alpine AS client-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/client ./src/client
COPY vite.config.js ./
RUN npm run build:client

# Stage: production
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/server.js ./src/
COPY src/config ./src/config
COPY src/controllers ./src/controllers
COPY src/routes ./src/routes
COPY src/services ./src/services
COPY src/middleware ./src/middleware
COPY src/sockets ./src/sockets
COPY --from=client-builder /app/src/public ./src/public
EXPOSE 3012
CMD ["node", "src/server.js"]
```

---

## Acceptance Criteria

- [ ] `npm run build:client` produces static files in `src/public/`
- [ ] `widget.html` is replaced by React `index.html` + bundled JS
- [ ] App renders `LoadingScreen` → `ChatUI` (or `ErrorScreen`)
- [ ] Theme class `theme-genesys` or `theme-portal` applied to body on init
- [ ] MessageList auto-scrolls to latest message
- [ ] Enter key sends message; Shift+Enter adds newline
- [ ] StatusIcons shows correct tick color for sent/delivered/read
- [ ] ARIA roles present on message list, input, buttons
- [ ] PCI mode disables InputBox
