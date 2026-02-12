# Task File 08: Real-time Updates (Socket.IO)

**Priority**: 🟡 MEDIUM
**Depends on**: `02_state_management.md` (React Query cache invalidation), `07_ui_components.md` (notification badge)
**Blocks**: `09_agent_widget.md` (typing indicators, live message feed)
**Estimated effort**: 1 week

---

## Context

The FRD requires real-time updates for conversations, messages, and dashboard metrics via Socket.IO. The `socketService.js` exists in the frontend and `socketService.js` + `eventListener.js` exist in the backend, but the frontend is not properly wired to listen for events and invalidate React Query cache.

**FRD Reference**: Section 8 — "Socket.IO real-time updates"

**Relevant files**:
- `src/services/socketService.js` — Socket.IO client service
- `../agent-portal-service/src/services/socketService.js` — backend Socket.IO server
- `../agent-portal-service/src/services/eventListener.js` — RabbitMQ → Socket.IO bridge
- `../agent-portal-service/src/services/rabbitmq.service.js` — RabbitMQ consumer
- `src/contexts/AuthContext.jsx` — socket should init after auth

---

## Tasks

### RT-01 — Backend: Verify Socket.IO room structure
**Status**: ⚠️ Partial
**FRD Reference**: Section 8 — "Socket rooms per tenant and conversation"

**Action** in `../agent-portal-service/src/services/socketService.js`:
- Ensure authenticated users join room `tenant:{tenantId}` on connect
- Ensure users join `conversation:{conversationId}` when viewing a conversation
- Events emitted to tenant room:
  - `conversation:new` — new conversation started
  - `conversation:updated` — status changed
  - `conversation:assigned` — assigned to agent
- Events emitted to conversation room:
  - `message:new` — new message in conversation
  - `message:delivered` — delivery status update
  - `typing:start` / `typing:stop` — typing indicators

**Files to change**: `../agent-portal-service/src/services/socketService.js`

---

### RT-02 — Backend: Wire RabbitMQ events to Socket.IO
**Status**: ⚠️ Partial
**FRD Reference**: Section 8 — "RabbitMQ → Socket.IO bridge"

**Action** in `../agent-portal-service/src/services/eventListener.js`:
- Subscribe to `INBOUND_WHATSAPP_MESSAGES` queue
- On inbound message: emit `message:new` to `conversation:{id}` room
- On new conversation: emit `conversation:new` to `tenant:{id}` room
- Subscribe to `WHATSAPP_STATUS_UPDATES` queue
- On delivery update: emit `message:delivered` to `conversation:{id}` room

Verify `rabbitmq.service.js` is started in `src/index.js`.

**Files to change**: `../agent-portal-service/src/services/eventListener.js`

---

### RT-03 — Frontend: Initialize Socket after login
**Status**: ⚠️ Partial (socketService exists but not consistently initialized)
**FRD Reference**: Section 8 — "Connect socket on auth, disconnect on logout"

**Action** in `src/contexts/AuthContext.jsx`:
- After successful login / token restore: `socketService.connect(token)`
- On logout: `socketService.disconnect()`
- Store socket instance in context so components can access it

**Files to change**: `src/contexts/AuthContext.jsx`, `src/services/socketService.js`

---

### RT-04 — Frontend: Create `useSocket` hook
**Status**: ❌ Missing

**Action**: Create `src/hooks/useSocket.ts`:
```typescript
export function useSocket() {
  // Returns: socket, connected, on(event, handler), emit(event, data)
}

export function useSocketEvent(event: string, handler: (data: unknown) => void) {
  // Subscribes to a socket event, auto-cleans up on unmount
}
```

**Files to create**: `src/hooks/useSocket.ts`

---

### RT-05 — Frontend: Real-time conversation list updates
**Status**: ❌ Missing
**FRD Reference**: Section 8 — "Live conversation status in list"

**Action** in conversation list area:
- Use `useSocketEvent('conversation:new', ...)` to invalidate `queryKeys.conversations.list`
- Use `useSocketEvent('conversation:updated', ...)` to update specific conversation in cache
- Show "New conversation" toast notification with link
- Update unread count badge in Sidebar automatically

**Files to change**: `src/components/ConversationComponents.jsx` (or `src/hooks/useConversations.ts`)

---

### RT-06 — Frontend: Real-time message updates in conversation
**Status**: ❌ Missing
**FRD Reference**: Section 8 — "New messages appear without manual refresh"

**Action** in `Workspace.jsx` / conversation view:
- When a conversation is open, join its socket room
- Use `useSocketEvent('message:new', ...)` to append new message to React Query cache
- Auto-scroll to bottom on new inbound message
- On component unmount, leave the room

**Files to change**: `src/pages/Workspace.jsx` (or `src/hooks/useConversations.ts`)

---

### RT-07 — Frontend: Delivery status updates
**Status**: ❌ Missing
**FRD Reference**: Section 8 — "Real-time delivery receipts"

**Action**:
- Use `useSocketEvent('message:delivered', ...)` to update message delivery status in cache
- Show tick marks: sent (✓), delivered (✓✓), read (✓✓ blue) like WhatsApp

**Files to change**: `src/components/ConversationComponents.jsx`

---

### RT-08 — Frontend: Typing indicators
**Status**: ❌ Missing
**FRD Reference**: Section 8 — "Typing indicators"

**Action**:
- Backend emits `typing:start` / `typing:stop` when an agent starts composing (from agent-widget)
- Frontend shows "Agent is typing..." or "Customer is typing..." indicator above message input
- Auto-clear after 3 seconds (in case `typing:stop` is missed)

**Files to change**: `src/components/ConversationComponents.jsx`

---

### RT-09 — Frontend: Dashboard real-time counter updates
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "Dashboard metrics update in near real-time"

**Action**:
- Use `useSocketEvent('conversation:new', ...)` to increment active conversations counter
- Use `useSocketEvent('conversation:updated', ...)` to adjust active/closed counts
- Use React Query's 30-second refetch as fallback (already in DA-06)

**Files to change**: `src/hooks/useAnalytics.ts`

---

### RT-10 — Frontend: Connection status indicator
**Status**: ❌ Missing

**Action**:
- Show a small indicator in the Sidebar or header showing socket connection status:
  - Green dot: connected
  - Orange dot: reconnecting
  - Red dot: disconnected (with "Reconnect" button)

**Files to change**: `src/components/Sidebar.jsx` or `src/components/layout/Header.jsx`

---

## Acceptance Criteria

- [ ] Socket connects automatically after login and disconnects on logout
- [ ] New inbound messages appear in the conversation without page refresh
- [ ] Conversation list updates when a new conversation starts
- [ ] Delivery ticks update in real-time (sent → delivered → read)
- [ ] Active conversations counter on dashboard updates when conversations open/close
- [ ] Typing indicator shows when the other party is composing
- [ ] Socket connection status shown in UI
