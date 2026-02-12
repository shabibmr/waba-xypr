# Task 11 — Fix agent-portal-service (Prerequisite for Widget)

**Priority:** CRITICAL — nothing works until these are fixed
**Service:** `services/agent-portal-service` (changes go there, not here)
**Depends on:** Nothing
**Blocks:** Everything — all widget tasks assume agent-portal-service is functional

---

## Why This Is Here

`agent-portal-service` already implements the backend the widget needs: REST APIs for conversations/messages, Socket.IO for real-time updates, RabbitMQ pipeline for sending. The widget does NOT need its own backend — it should call agent-portal-service directly.

But agent-portal-service has two blocking bugs that must be fixed first.

---

## T11.1 — Fix `src/index.js`: Register Middleware and Routes

**File:** `services/agent-portal-service/src/index.js`

**Problem:** All 7 route files are imported but never mounted. `express.json()`, CORS, and the error handler are also never registered. Every HTTP request returns 404.

**Fix — replace the entire file:**

```javascript
const express = require('express');
const cors = require('cors');
const http = require('http');
const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const socketService = require('./services/socketService');
const eventListener = require('./services/eventListener');

const agentRoutes = require('./routes/agentRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const server = http.createServer(app);

// ── Middleware ────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.ALLOWED_ORIGINS || '')
      .split(',').map(o => o.trim()).filter(Boolean);
    // Always allow same-origin and Genesys Cloud
    if (!origin || allowed.includes(origin) || /mypurecloud\.com$/.test(origin)) {
      return cb(null, true);
    }
    cb(new Error('CORS not allowed'), false);
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'agent-portal-service' }));

app.use('/api/agents', agentRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── Error Handler (must be last) ─────────────────────────
app.use(errorHandler);

// ── Socket.IO + Event Listener ────────────────────────────
socketService.init(server).then(() => {
  eventListener.start().catch(err =>
    logger.error('Failed to start Event Listener', err)
  );
}).catch(err => {
  logger.error('Failed to init socket service', err);
});

// ── Start ─────────────────────────────────────────────────
const PORT = config.port;
server.listen(PORT, () => {
  logger.info('Agent Portal Service started', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV,
  });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received: closing server');
  server.close(() => process.exit(0));
});

module.exports = { app, server };
```

**Add `ALLOWED_ORIGINS` to `.env`:**
```
ALLOWED_ORIGINS=http://localhost:3012,http://localhost:3014,http://localhost:3000
```

---

## T11.2 — Add `status_update` to Event Listener

**File:** `services/agent-portal-service/src/services/eventListener.js`

**Problem:** The RabbitMQ consumer only handles `new_message` and `conversation_update`. WhatsApp delivery receipts (`sent`/`delivered`/`read`) are never forwarded to the socket, so agents never see tick updates.

**Read the current file first, then add the missing case.**

The `handleMessage` method needs a `status_update` branch:

```javascript
// In handleMessage(payload):
case 'status_update':
  // payload: { tenantId, messageId, waId, status: 'sent'|'delivered'|'read', timestamp }
  socketEmitter.emitStatusUpdate(payload.tenantId, {
    messageId: payload.messageId,
    status: payload.status,
    timestamp: payload.timestamp,
  });
  break;
```

**File:** `services/agent-portal-service/src/services/socketEmitter.js`

Add the missing method:

```javascript
emitStatusUpdate(tenantId, data) {
  // data: { messageId, status, timestamp }
  socketService.toTenant(tenantId, 'status_update', data);
}
```

**What publishes to this queue?**
- `whatsapp-webhook-service` receives delivery receipts from Meta and should publish `{ type: 'status_update', tenantId, messageId, status }` to the `waba.agent-portal.events` queue.
- Verify this is wired in `services/whatsapp-webhook-service` — if not, add it there too.

---

## T11.3 — CORS: Allow Agent-Widget Origin

Already covered in T11.1 via `ALLOWED_ORIGINS` env var. Ensure `.env` includes:

```
ALLOWED_ORIGINS=http://localhost:3012,http://localhost:3014,http://localhost:3000
```

For production, add the actual deployed widget URL.

---

## T11.4 — Verify Socket.IO CORS Config

**File:** `services/agent-portal-service/src/services/socketService.js`

Ensure the Socket.IO `cors` option also allows the widget origin:

```javascript
// In socketService.init():
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      const allowed = (process.env.ALLOWED_ORIGINS || '')
        .split(',').map(o => o.trim()).filter(Boolean);
      if (!origin || allowed.includes(origin) || /mypurecloud\.com$/.test(origin)) {
        return cb(null, true);
      }
      cb(new Error('Socket CORS not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
});
```

Socket.IO has its own CORS config separate from Express — both must allow the widget origin.

---

## T11.5 — Simplify Agent-Widget Backend

**File:** `services/agent-widget/src/server.js`
**File:** `services/agent-widget/src/routes/widget.routes.js`

Once agent-portal-service is fixed, strip the agent-widget backend down to:

1. Serve the React static build from `src/public/`
2. `GET /health` — health check
3. `GET /api/v1/widget/config` — returns the agent-portal-service URL to the frontend

```javascript
// GET /api/v1/widget/config
app.get('/api/v1/widget/config', (req, res) => {
  res.json({
    apiUrl: process.env.PORTAL_SERVICE_URL || 'http://localhost:3015',
    socketUrl: process.env.PORTAL_SERVICE_URL || 'http://localhost:3015',
    features: {
      messageHistory: true,
      templates: true,
      mediaUpload: true,
    },
  });
});
```

The React frontend calls `/api/v1/widget/config` on init, then uses `apiUrl` for all subsequent REST and Socket.IO calls — pointing at agent-portal-service.

Add to `agent-widget/.env`:
```
PORTAL_SERVICE_URL=http://localhost:3015
```

---

## Acceptance Criteria

- [ ] `GET http://localhost:3015/health` returns `{ status: 'healthy' }`
- [ ] `GET http://localhost:3015/api/conversations` with valid JWT returns conversation list (not 404)
- [ ] `POST http://localhost:3015/api/messages/send` with `{ to, text }` publishes to RabbitMQ
- [ ] Socket.IO client connecting to `http://localhost:3015` with `tenantId` query param joins tenant room
- [ ] WhatsApp delivery receipt triggers `status_update` socket event on tenant room
- [ ] `GET http://localhost:3012/api/v1/widget/config` returns `{ apiUrl: 'http://localhost:3015', ... }`
- [ ] React widget can reach agent-portal-service from the browser (CORS headers present)
