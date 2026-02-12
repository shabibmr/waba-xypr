# 04 — Real-time WebSocket (Socket.IO)

> **FRD Reference:** Section 7 (Real-time Monitoring), Lines 2400-2700
> **Priority:** 🔴 High — MVP Phase 2

---

## Gap Summary

| Feature | FRD | Code | Gap |
|---------|-----|------|-----|
| Socket.IO initialization | ✅ | ✅ | `socketIo(server)` in `index.js` |
| JWT auth on socket connection | ✅ | ✅ | Implemented in `socketService` |
| Room-based tenant isolation | ✅ | ✅ | Implemented in `socketService` |
| Event: `new_message` | ✅ | ❌ | Not emitted anywhere |
| Event: `conversation_update` | ✅ | ❌ | Not emitted |
| Event: `agent_status_change` | ✅ | ❌ | Not emitted |
| Client reconnection handling | ✅ | ❌ | Not implemented |
| Socket middleware for auth | ✅ | 🟡 | Basic JWT check, no session validation |

---

## Tasks

### T04.1 — Enhance Socket Auth Middleware
- [x] **File:** `src/index.js` (MODIFY) or `src/middleware/socketAuth.js` (NEW)
- [x] **What:** 
  - Verify JWT from `socket.handshake.auth.token`
  - Join tenant-specific room: `socket.join(\`tenant:\${tenantId}\`)`
  - Attach user info to socket

### T04.2 — Create Socket Event Emitter Service
- [x] **File:** `src/services/socketEmitter.js` (NEW)
- [x] **What:** Singleton that holds `io` ref and exposes:
  - `emitToTenant(tenantId, event, data)`
  - `emitToUser(userId, event, data)`

### T04.3 — Emit `new_message` on Inbound
- **File:** `src/controllers/messageController.js` (MODIFY)
- **What:** After successful `publishInboundMessage`, emit socket event
- **Also:** Consider consuming from a response queue for delivery confirmation

### T04.4 — Emit `conversation_update` Events
- **File:** `src/controllers/conversationController.js` (MODIFY)
- **What:** Emit on assign, transfer, status changes

### T04.5 — Client Disconnect/Reconnection Handling
- **File:** `src/index.js` (MODIFY)
- **What:** Handle `disconnect` and `reconnect` events, track online users
