# Agent Widget — Task List

This directory contains detailed gap analysis and implementation tasks to bring `agent-widget` in line with [FRD v1.4](../agent-widget-frd.md).

---

## Files (in dependency order)

| File | Service | Contents | Priority |
|------|---------|----------|----------|
| [00_gap_analysis.md](./00_gap_analysis.md) | Both | Full gap analysis — revised after portal-service review | Reference |
| [**11_portal_fixes.md**](./11_portal_fixes.md) | **agent-portal-service** | **Fix broken index.js + add status_update event** | **CRITICAL** |
| [04_react_frontend.md](./04_react_frontend.md) | agent-widget | React migration; calls agent-portal-service directly | HIGH |
| [05_messaging.md](./05_messaging.md) | agent-widget | Send flow, optimistic UI, retry, status ticks | HIGH |
| [06_host_detection.md](./06_host_detection.md) | agent-widget | Genesys SDK vs Portal mode detection | MEDIUM |
| [07_error_handling.md](./07_error_handling.md) | agent-widget | Offline banner, retry logic, error boundary | MEDIUM |
| [08_media.md](./08_media.md) | agent-widget | Upload UI only — backend already exists in agent-portal-service | MEDIUM |
| [01_foundation.md](./01_foundation.md) | agent-widget | API paths, context endpoint *(mostly superseded by 11)* | LOW |
| [02_auth.md](./02_auth.md) | agent-widget | Auth middleware *(agent-portal-service already has this)* | POST-MVP |
| [03_websockets.md](./03_websockets.md) | agent-widget | Socket.IO *(agent-portal-service already has this)* | POST-MVP |
| [09_security.md](./09_security.md) | agent-widget | Helmet, rate limiting *(agent-portal-service already has this)* | POST-MVP |
| [10_future_enhancements.md](./10_future_enhancements.md) | Both | Typing, emoji, templates, AI | LOW |

> **Key finding:** `agent-portal-service` already implements the Socket.IO server, all REST APIs, RabbitMQ pipeline, auth, and multi-tenancy that the widget needs. The widget frontend should call it directly. Tasks 02, 03, and 09 are largely already done there.

---

## MVP — Minimum Tasks for Basic Working Widget

> **Auth, security, and Socket.IO are skipped in agent-widget — they already exist in agent-portal-service.** The widget calls agent-portal-service directly.

### Phase A: Fix agent-portal-service (Day 1)
> **Service: `agent-portal-service`**
> Goal: The service actually responds to HTTP requests and emits status updates

- [ ] **T11.1** — Register middleware + mount all routes in `src/index.js` *(~15 lines)*
- [ ] **T11.2** — Add `status_update` case to `eventListener.js` + `emitStatusUpdate` to `socketEmitter.js`
- [ ] **T11.3/T11.4** — Add `ALLOWED_ORIGINS` env var; ensure Socket.IO CORS allows widget origin

### Phase B: Simplify Agent-Widget Backend (Day 1)
> **Service: `agent-widget`**
> Goal: Backend reduced to a static file server + config endpoint

- [ ] **T11.5** — Strip agent-widget backend to: serve React build + `GET /api/v1/widget/config`
- [ ] Add `PORTAL_SERVICE_URL=http://localhost:3015` to `agent-widget/.env`

### Phase C: React Frontend (Days 2–5)
> **Service: `agent-widget`**
> Goal: React app that talks to agent-portal-service

- [ ] **T4.1** — Vite + React setup (`src/client/`), proxy to port 3015 in dev
- [ ] **T4.2** — `useWidgetInit` hook (fetch config → resolve context via `GET /api/conversations/:id`)
- [ ] **T4.4** — `ChatUI` component
- [ ] **T4.5** — `MessageList` + **T4.6** `StatusIcons` (sent/delivered/read ticks)
- [ ] **T4.7** — `InputBox` (Enter to send)
- [ ] **T4.8** — CSS theme variables (portal + genesys)
- [ ] **T4.10** — Update Dockerfile for React build

### Phase D: Message Flow (Days 6–7)
> **Service: `agent-widget` (frontend only)**
> Goal: Send + live updates work end-to-end

- [ ] **T5.2** — `generateMessageId()` utility
- [ ] **T5.4** — `useMessages` hook: optimistic send + socket `new_message` + `status_update`
- [ ] **T5.6** — `useSocket` hook (connects to agent-portal-service at `socketUrl` from config)
- [ ] **T5.7** — `widgetApi.js` client (calls agent-portal-service `/api/conversations/*`, `/api/messages/*`)
- [ ] **T3.8** — Offline/reconnecting banner

### Phase E: Host Detection (Day 8)
> **Service: `agent-widget` (frontend only)**

- [ ] **T6.1** — `hostDetector` utility (`detectMode` + `getInitParams`)
- [ ] **T6.6** — Wire into `useWidgetInit`

---

## Skipped for MVP

| Skipped | Reason |
|---------|--------|
| `02_auth.md` (new auth middleware in agent-widget) | agent-portal-service already has full JWT auth — wire it in later |
| `03_websockets.md` (new Socket.IO in agent-widget) | agent-portal-service already has Socket.IO |
| `09_security.md` (Helmet, rate limiting in agent-widget) | agent-portal-service handles this |
| `01_foundation.md` (most of it) | superseded by T11 — agent-portal-service is the backend |
| T5.3 retry backoff | Nice-to-have; basic error display is enough for MVP |
| T6.2 Genesys SDK events | URL param `?conversationId=` suffices |
| T6.3 postMessage bridge | Not needed for basic iframe embed |
| `08_media.md` (upload UI) | Text-only MVP; backend upload endpoint already exists |
| `07_error_handling.md` (ErrorBoundary, retry button) | Post-MVP polish |
| `10_future_enhancements.md` | Explicitly future |

---

## Quick Start for MVP Implementation

```bash
# ── Step 1: Fix agent-portal-service (T11.1) ──────────────
cd services/agent-portal-service
# Edit src/index.js — add middleware + mount routes (see 11_portal_fixes.md)
# Edit src/services/eventListener.js — add status_update case
# Edit src/services/socketEmitter.js — add emitStatusUpdate method
# Add ALLOWED_ORIGINS=http://localhost:3012 to .env
npm run dev   # verify GET /health returns 200

# ── Step 2: Simplify agent-widget backend (T11.5) ─────────
cd ../agent-widget
# Strip src/server.js to serve static + /api/v1/widget/config only
# Add PORTAL_SERVICE_URL=http://localhost:3015 to .env

# ── Step 3: React app (T4.1) ──────────────────────────────
npm install react react-dom
npm install --save-dev vite @vitejs/plugin-react concurrently
# Create src/client/ directory, vite.config.js
# Proxy /api and /socket.io to http://localhost:3015 in vite.config.js

# ── Step 4: Build and verify ──────────────────────────────
npm run build:client
npm run dev
# Open http://localhost:3012/?conversationId=<id>&tenantId=<tid>
```

---

## Task Dependency Graph (Revised)

```
T11.1 (fix index.js in agent-portal-service)
  └── T11.2 (status_update socket event)
  └── T11.3/T11.4 (CORS for widget origin)
        └── T11.5 (strip agent-widget to static server + config)
              └── T4.1 (React + Vite setup, proxy to port 3015)
                    └── T4.2 (useWidgetInit → calls /api/conversations/:id)
                          └── T4.4 (ChatUI)
                                ├── T4.5 (MessageList) + T4.6 (StatusIcons)
                                └── T4.7 (InputBox) → T5.7 (widgetApi → POST /api/messages/send)
                                      └── T5.4 (useMessages + useSocket → port 3015)
                                            └── T6.1 (hostDetector)
```

Tasks in `agent-portal-service` (T11.*) unlock everything else.
The widget frontend never calls `agent-widget` backend for business logic — only for its own `/config` endpoint on init.
