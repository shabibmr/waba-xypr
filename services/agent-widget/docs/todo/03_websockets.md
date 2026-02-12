# Task 03 — Real-Time WebSocket Integration (Socket.IO)

**Priority:** HIGH — core FRD requirement for live message display
**Depends on:** 01_foundation, 02_auth (for token in handshake)
**Blocks:** 04_react_frontend (subscribes to socket events), 05_messaging (status updates)

---

## Gap Summary

| FRD Requirement | Current State | Status |
|----------------|---------------|--------|
| Socket.IO server in namespace `/tenant/{tenantId}/conv/{conversationId}` | No WebSocket server at all | ❌ Missing |
| Event `inbound_message` → `{ text, mediaUrl? }` | No events | ❌ Missing |
| Event `status_update` → `{ messageId, status: sent\|delivered\|read }` | No events | ❌ Missing |
| Auth handshake `{ token }` on connect | No WS server | ❌ Missing |
| Auto-reconnect with backoff (1s, 2s, 5s) | No WS client | ❌ Missing |
| WebSocket endpoint: `wss://api.xypr.com/socket.io` | Not configured | ❌ Missing |
| Frontend subscribes and updates UI on socket events | Polling / manual refresh only | ❌ Missing |

---

## Tasks

### T3.1 — Install Socket.IO on Backend

```bash
npm install socket.io
```

---

### T3.2 — Integrate Socket.IO into Express Server

**File:** `src/server.js`

```javascript
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
// ... existing middleware ...

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  path: '/socket.io',
});

// Attach io instance for use in controllers/services
app.set('io', io);

// Initialize socket handlers
require('./sockets/widgetSocket')(io);

// Change: httpServer.listen instead of app.listen
httpServer.listen(config.port, () => {
  console.log(`Agent Widget service running on port ${config.port}`);
});
```

---

### T3.3 — Create Socket Handler Module

**New file:** `src/sockets/widgetSocket.js`

```javascript
const authenticate = require('../middleware/authenticate');

module.exports = function setupWidgetSocket(io) {
  // Namespace per tenant+conversation
  // Pattern: /tenant/:tenantId/conv/:conversationId
  // Socket.IO doesn't support dynamic namespaces natively for path params,
  // so use a single namespace with rooms instead:

  io.use(async (socket, next) => {
    // Auth handshake
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    // Validate token (reuse authenticate logic)
    try {
      const agent = await validateToken(token); // calls auth-service
      socket.agent = agent;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { tenantId, conversationId } = socket.handshake.query;

    if (!tenantId || !conversationId) {
      socket.disconnect(true);
      return;
    }

    // Join the room for this conversation
    const room = `tenant:${tenantId}:conv:${conversationId}`;
    socket.join(room);

    console.log(`Socket connected: room=${room}, socketId=${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: room=${room}, reason=${reason}`);
    });
  });
};
```

---

### T3.4 — Emit Events from Incoming Messages

**File:** `src/services/widget.service.js` (or a new `src/services/socketEmitter.js`)

When the agent-portal-service (or a RabbitMQ consumer) processes an inbound WhatsApp message, it needs to emit to the relevant socket room.

Two approaches:
1. **Direct emit** — agent-widget backend receives message via RabbitMQ and emits to socket room
2. **Relay** — agent-portal-service calls an internal HTTP endpoint on agent-widget to trigger emit

**Recommended for MVP: add an internal emit endpoint**

**New file:** `src/routes/internal.routes.js`

```javascript
// POST /internal/emit
// Body: { tenantId, conversationId, event, payload }
// Called by agent-portal-service or other internal services
router.post('/internal/emit', (req, res) => {
  const { tenantId, conversationId, event, payload } = req.body;
  const io = req.app.get('io');
  const room = `tenant:${tenantId}:conv:${conversationId}`;
  io.to(room).emit(event, payload);
  res.json({ ok: true });
});
```

Protect this route with an internal API key check (not exposed publicly).

---

### T3.5 — Status Update Events

When a WhatsApp status update (sent/delivered/read) arrives via `whatsapp-webhook-service`, emit:

```javascript
io.to(room).emit('status_update', {
  messageId: update.messageId,
  status: update.status // 'sent' | 'delivered' | 'read'
});
```

Wire this via the same internal emit endpoint (T3.4) or RabbitMQ consumer.

---

### T3.6 — Frontend Socket.IO Client (widget.html)

Install Socket.IO client CDN or via npm (when React migration done).

**widget.html — add to `<head>`:**
```html
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
```

**JavaScript:**
```javascript
let socket;

function connectWebSocket(tenantId, conversationId, token) {
  socket = io(API_BASE_URL, {
    auth: { token },
    query: { tenantId, conversationId },
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    hideOfflineBanner();
  });

  socket.on('disconnect', (reason) => {
    showOfflineBanner(`Disconnected: ${reason}. Reconnecting...`);
  });

  socket.on('inbound_message', (data) => {
    // data: { text, mediaUrl?, messageId, timestamp }
    appendMessage({ direction: 'inbound', text: data.text, mediaUrl: data.mediaUrl, timestamp: data.timestamp });
  });

  socket.on('status_update', (data) => {
    // data: { messageId, status }
    updateMessageStatus(data.messageId, data.status);
  });
}
```

Call `connectWebSocket()` after context is resolved:
```javascript
async function initWidget() {
  const ctx = await fetchContext(conversationId);
  if (!ctx.valid) { showError('Invalid conversation'); return; }
  tenantId = ctx.tenantId;
  waId = ctx.wa_id;
  connectWebSocket(tenantId, conversationId, authToken);
  loadMessageHistory();
}
```

---

### T3.7 — Auto-Reconnect Backoff (FRD spec: 1s, 2s, 5s)

Socket.IO's built-in reconnection handles this. Ensure configuration:
```javascript
socket = io(url, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,    // 1s
  reconnectionDelayMax: 5000, // max 5s
  randomizationFactor: 0.5,
});
```

For the manual backoff in `sendMessage` retries (FRD: 100ms, 200ms, 400ms), implement in the messaging task (05).

---

### T3.8 — Offline Detection Banner

**widget.html / React component:**

Add a banner div hidden by default:
```html
<div id="offline-banner" style="display:none; background:#ff4444; color:white; padding:8px; text-align:center;">
  Connection lost. Reconnecting...
</div>
```

```javascript
function showOfflineBanner(msg) {
  const el = document.getElementById('offline-banner');
  el.textContent = msg;
  el.style.display = 'block';
}
function hideOfflineBanner() {
  document.getElementById('offline-banner').style.display = 'none';
}
```

---

## Acceptance Criteria

- [ ] `socket.io` server starts with Express app on port 3012
- [ ] Client can connect with `{ auth: { token }, query: { tenantId, conversationId } }`
- [ ] Client joins correct room and receives `inbound_message` events
- [ ] Client receives `status_update` events
- [ ] Disconnect triggers offline banner; reconnect hides it
- [ ] `POST /internal/emit` allows other services to push events to rooms
- [ ] Auth middleware blocks unauthenticated socket connections
