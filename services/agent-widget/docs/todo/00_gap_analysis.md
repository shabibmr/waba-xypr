# Gap Analysis: Agent Widget — FRD vs Current Implementation

**FRD Version:** 1.4 (Consolidated)
**Analysis Date:** 2026-02-12
**Codebase:** `services/agent-widget`, `services/agent-portal-service`

---

## 1. Executive Summary

The current `agent-widget` backend **duplicates** functionality that already exists in `agent-portal-service`. The right architecture is for the React widget frontend to call `agent-portal-service` directly — not maintain a separate backend in `agent-widget`.

`agent-portal-service` covers ~80% of everything the widget needs. The remaining 20% is two things:

1. **`index.js` is broken** — routes, body parser, CORS, and error handler are never registered. The service cannot respond to HTTP requests today.
2. **`status_update` socket event is missing** — WhatsApp delivery receipts (`sent`/`delivered`/`read`) are never forwarded to connected sockets.

---

## 2. agent-portal-service Coverage vs Agent-Widget Needs

| Agent-Widget Need | agent-portal-service Endpoint | Status |
|---|---|---|
| Resolve context for `conversationId` | `GET /api/conversations/:id` → state-manager | ✅ Covered |
| Message history | `GET /api/conversations/:id/messages` → state-manager | ✅ Covered |
| Send text message (via RabbitMQ pipeline) | `POST /api/messages/send` → RabbitMQ | ✅ Covered (and architecturally correct) |
| Send template | `POST /api/messages/send/template` → whatsapp-api | ✅ Covered |
| Upload media → MinIO | `POST /api/messages/upload` → MinIO | ✅ Covered |
| Socket.IO for real-time messages | `socketService.js` — Redis adapter, tenant rooms | ✅ Server exists |
| `inbound_message` socket event | `new_message` event via `eventListener` | ✅ Covered (name differs) |
| `status_update` socket event (delivered/read) | Not emitted | ❌ **Missing** |
| Auth token validation | Full JWT middleware + Redis blacklist | ✅ Fully implemented |
| Multi-tenant isolation | `req.tenantId` from JWT on all routes | ✅ Covered |

> **Note on socket rooms:** agent-portal-service uses `tenant:{tenantId}` rooms (all conversations for a tenant broadcast to all connected agents on that tenant). The FRD specifies per-conversation rooms. For MVP the tenant room is fine — agents only see messages for conversations assigned to them via the UI filter. Per-conversation rooms can be added later.

---

## 3. Critical Bugs in agent-portal-service (Must Fix First)

### BUG-1: `src/index.js` — Routes and Middleware Never Registered

**File:** `services/agent-portal-service/src/index.js`

The file imports all 7 route modules and creates the Express app, but never calls:
- `app.use(express.json())` — body parser
- `app.use(cors(...))` — CORS headers
- `app.use('/api/...', routes)` — any route
- `app.use(errorHandler)` — global error handler

**Effect:** Server starts, Socket.IO works, but every REST endpoint returns 404.

**Fix required (see task list `11_portal_fixes.md`).**

### BUG-2: `eventListener.js` — `status_update` Events Not Handled

**File:** `services/agent-portal-service/src/services/eventListener.js`

The RabbitMQ consumer handles `new_message` and `conversation_update` event types, but not `status_update` (WhatsApp delivery receipts). Agents never see sent/delivered/read ticks update in real time.

**Fix required (see `11_portal_fixes.md`).**

---

## 4. Revised Architecture

### Current (Wrong — two backends doing the same thing)
```
widget.html (vanilla JS)
    │ Fetch API  →  agent-widget backend (port 3012)
    │                   │ Axios HTTP → state-manager
    │                   └─ Axios HTTP → whatsapp-api (BYPASSES RabbitMQ pipeline!)
    └── No WebSocket
```

### Target (Correct — widget calls agent-portal-service directly)
```
React Widget (agent-widget, served from port 3012 as static files)
    │ REST  →  GET  /api/conversations/:id
    │ REST  →  GET  /api/conversations/:id/messages
    │ REST  →  POST /api/messages/send
    │ WS    →  Socket.IO → tenant:{tenantId} room
    ▼
agent-portal-service (port 3015)
    │
    ├── state-manager  (conversation data)
    ├── whatsapp-api   (template send)
    ├── RabbitMQ       (inbound-whatsapp-messages for text send)
    └── Redis          (Socket.IO adapter, auth blacklist, cache)
```

### Agent-Widget Service Role (Simplified)
`services/agent-widget` should:
1. Serve the React static build (index.html + JS bundle)
2. Provide a thin `/api/v1/widget/config` endpoint that tells the frontend where agent-portal-service is
3. Nothing else — all business logic moves to agent-portal-service

---

## 5. What IS Working (Unchanged)

| Feature | Status |
|---------|--------|
| Express server on port 3012, serves static HTML | ✅ Working |
| `GET /health` health check | ✅ Working |
| `GET /widget/api/conversation/:id` — conversation fetch | ✅ Working (but duplicated) |
| `GET /widget/api/conversation/:id/history` — message history | ✅ Working (but duplicated) |
| Template + quick-reply send | ✅ Working (but bypasses RabbitMQ pipeline) |
| Analytics endpoint | ✅ Working |
| Multi-tenant header forwarding | ✅ Working |
| Docker multi-stage build | ✅ Working |

---

## 6. Gap Summary (Revised)

### Critical — Must fix before widget works at all
| Gap | Where to Fix |
|-----|-------------|
| `index.js` doesn't mount routes | agent-portal-service `11_portal_fixes.md` T11.1 |
| Missing `express.json()` + CORS + errorHandler | agent-portal-service `11_portal_fixes.md` T11.1 |

### High — Required for core widget functionality
| Gap | Where to Fix |
|-----|-------------|
| React frontend (currently vanilla JS) | agent-widget `04_react_frontend.md` |
| `status_update` socket event missing | agent-portal-service `11_portal_fixes.md` T11.2 |
| Agent-widget frontend calls wrong service (itself instead of agent-portal-service) | agent-widget `04_react_frontend.md` T4.2 |
| CORS on agent-portal-service doesn't allow widget origin | agent-portal-service `11_portal_fixes.md` T11.3 |

### Medium — Feature complete
| Gap | Where to Fix |
|-----|-------------|
| Genesys SDK host detection | agent-widget `06_host_detection.md` |
| Media upload UI (backend exists in agent-portal-service) | agent-widget `08_media.md` (frontend only) |
| Offline banner + reconnect | agent-widget `07_error_handling.md` |

### Low / Post-MVP
| Gap | Notes |
|-----|-------|
| Per-conversation socket rooms | agent-portal-service uses tenant rooms; sufficient for MVP |
| Auth validation (JWT in widget) | Skipped for MVP; agent-portal-service auth is ready when needed |
| Rate limiting, Helmet, sanitization | `09_security.md` |
| Future features | `10_future_enhancements.md` |

---

## 7. Dependency Order (Revised)

```
11_portal_fixes (fix index.js + status_update event)  ← DO THIS FIRST
    └── 04_react_frontend (React app calling agent-portal-service)
              └── 05_messaging (send + optimistic UI + status ticks)
              └── 06_host_detection (Genesys vs Portal)
              └── 07_error_handling (offline banner, retry)
              └── 08_media (frontend upload UI — backend already exists)
```

Tasks `01_foundation`, `02_auth`, `03_websockets`, `09_security` from the original analysis are **substantially handled by agent-portal-service** and do not need to be rebuilt in agent-widget.
