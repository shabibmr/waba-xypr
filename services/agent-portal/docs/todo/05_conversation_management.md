# Task File 05: Conversation Management

**Priority**: 🟡 MEDIUM
**Depends on**: `02_state_management.md` (useConversations hook), `07_ui_components.md` (reusable components)
**Blocks**: `09_agent_widget.md` (widget embed is part of conversation detail)
**Estimated effort**: 2 weeks

---

## Context

The FRD specifies a full conversation management interface with pagination, search, status filters, sort, a detail drawer, audit trail, delivery logs, and CSV export. Currently, `Workspace.jsx` / `ConversationComponents.jsx` shows a basic list without any of these features.

**FRD Reference**: Section 6.3 — Conversation Management

**Relevant files**:
- `src/pages/Workspace.jsx` — main workspace layout
- `src/components/ConversationComponents.jsx` — ConversationList + MessageThread
- `src/services/conversationService.js` — API calls
- `../agent-portal-service/src/controllers/conversationController.js` — backend
- `../agent-portal-service/src/routes/conversationRoutes.js` — routes

---

## Tasks

### CM-01 — Backend: Conversation list pagination + filters
**Status**: ⚠️ Partial (basic list exists, no filters/pagination)
**FRD Reference**: Section 6.3 — "Paginated list, 20/page"

**Action** in `conversationController.js` (`getConversations`):
- Accept query params: `status`, `search`, `sortBy`, `sortOrder`, `page`, `limit` (default 20)
- Query with `WHERE status = $status` and `WHERE wa_id ILIKE %search% OR contact_name ILIKE %search%`
- Return `{ conversations: [...], total, page, limit, hasMore }`

**Endpoint**: `GET /api/conversations?status=active&search=john&page=1&limit=20`
**Files to change**: `../agent-portal-service/src/controllers/conversationController.js`

---

### CM-02 — Backend: `GET /api/conversations/:id` with full detail
**Status**: ⚠️ Partial (basic object returned, missing metadata)
**FRD Reference**: Section 6.3 — Conversation detail drawer

**Action**: Enrich response with:
- `events` array: status changes, agent assignments with timestamps (audit trail)
- `messageCount`, `firstMessageAt`, `lastMessageAt`
- `assignedAgent` name/email if assigned

**Files to change**: `../agent-portal-service/src/controllers/conversationController.js`

---

### CM-03 — Backend: `GET /api/conversations/:id/delivery-logs`
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "Delivery logs table"

**Action**:
- Return per-message delivery status:
  ```json
  [
    { "messageId": "...", "direction": "outbound", "status": "delivered", "sentAt": "...", "deliveredAt": "...", "readAt": null }
  ]
  ```

**Endpoint**: `GET /api/conversations/:id/delivery-logs`
**Files to change**: `../agent-portal-service/src/controllers/conversationController.js`

---

### CM-04 — Backend: `GET /api/conversations/export`
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "CSV export"

**Action**:
- Accepts same filters as the list endpoint
- Streams CSV response with headers: `Content-Disposition: attachment; filename=conversations.csv`
- Columns: `id, contact, wa_id, status, createdAt, lastMessageAt, messageCount, assignedAgent`

**Endpoint**: `GET /api/conversations/export?status=closed&format=csv`
**Files to change**: `../agent-portal-service/src/controllers/conversationController.js`

---

### CM-05 — Frontend: Search input
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "Search by name or phone"

**Action** in `ConversationComponents.jsx` / `Workspace.jsx`:
- Add search input at top of conversation list
- Debounce 300ms before triggering query
- Pass `search` parameter to `useConversationList({ search, ... })`
- Show "No results for X" empty state

**Files to change**: `src/components/ConversationComponents.jsx`

---

### CM-06 — Frontend: Status filter tabs
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "Filter by status: all/active/closed/error"

**Action**:
- Add tab-style filter buttons above conversation list: All | Active | Closed | Error
- Active tab highlighted
- Tab change updates `useConversationList({ status })` query
- Show count badge per tab (if backend returns counts)

**Files to change**: `src/components/ConversationComponents.jsx`

---

### CM-07 — Frontend: Pagination controls
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "Paginate 20 per page"

**Action**:
- Add Previous / Next buttons at bottom of conversation list
- Show "Page X of Y" or "Showing 1-20 of 145"
- Use page state in `useConversationList({ page })` query

**Files to change**: `src/components/ConversationComponents.jsx`

---

### CM-08 — Frontend: Sort selector
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "Sort by lastActivity or createdAt"

**Action**:
- Add dropdown selector: "Sort: Last Activity | Created Date | Unread"
- Pass `sortBy` parameter to query

**Files to change**: `src/components/ConversationComponents.jsx`

---

### CM-09 — Frontend: Conversation Detail Drawer
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "Detail drawer with audit trail, delivery logs, widget embed"

**Action**: Create `src/components/ConversationDetailDrawer.jsx`:
- Slides in from right when conversation is selected (600px wide)
- Header: contact name, wa_id, status badge, Close button
- Tabs:
  1. **Messages** (current `MessageThread` — embed here)
  2. **Audit Trail** (event timeline with timestamps)
  3. **Delivery Logs** (table of message delivery statuses)
  4. **Widget** (iframe embed — see `09_agent_widget.md`)

**Files to create**: `src/components/ConversationDetailDrawer.jsx`
**Files to change**: `src/pages/Workspace.jsx` (render drawer instead of inline panel)

---

### CM-10 — Frontend: Audit trail display
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "Audit trail: status changes, agent assignments"

**Action** in `ConversationDetailDrawer.jsx`:
- Fetch `GET /api/conversations/:id` (events array from CM-02)
- Render timeline list:
  - Icon per event type (connected, disconnected, assigned, transferred)
  - Timestamp + description
  - Actor (agent name or "System")

**Files to change**: `src/components/ConversationDetailDrawer.jsx` (once created)

---

### CM-11 — Frontend: Delivery logs table
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "Delivery logs with message status"

**Action** in `ConversationDetailDrawer.jsx`:
- Fetch `GET /api/conversations/:id/delivery-logs`
- Render table: Message preview | Direction | Status | Sent | Delivered | Read
- Status as colored badge (sent/delivered/read/failed)

**Files to change**: `src/components/ConversationDetailDrawer.jsx`

---

### CM-12 — Frontend: Export to CSV button
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "Export conversations to CSV"

**Action**:
- Add "Export CSV" button in conversation list header
- On click → call `GET /api/conversations/export` with current filters
- Trigger browser download of returned CSV

**Files to change**: `src/components/ConversationComponents.jsx`

---

## Acceptance Criteria

- [ ] Search filters conversations by name/phone in real-time (debounced)
- [ ] Status tabs (All/Active/Closed/Error) filter the list correctly
- [ ] Pagination shows correct page and navigates correctly
- [ ] Conversation detail drawer opens on conversation click with 3 tabs
- [ ] Audit trail shows event history with timestamps
- [ ] Delivery logs show per-message status
- [ ] Export CSV button downloads valid file with all visible conversations
