# Task File 09: Agent Widget Integration

**Priority**: 🟢 LOWER
**Depends on**: `05_conversation_management.md` (drawer), `08_realtime.md` (live messages)
**Blocks**: Nothing (final feature)
**Estimated effort**: 3 weeks

---

## Context

The FRD specifies embedding the Agent Widget (separate service on port 3012) inside the conversation detail drawer. The portal should show a read-only version of the widget for supervisors/admins, and allow agents to interact. Currently `AgentWidget.jsx` and `AgentWidgetIframe.jsx` are stubs that show notifications and a modal wrapper but have no actual widget functionality.

Note: The full agent-widget functionality (real-time messaging, template selector, media) is in a **separate service** (`services/agent-widget/`). These tasks focus on the **portal's integration** of that widget.

**FRD Reference**: Section 6.3.3 — Widget embed in conversation drawer

**Relevant files**:
- `src/components/AgentWidget.jsx` — stub (notification display)
- `src/components/AgentWidgetIframe.jsx` — stub (modal wrapper)
- `../agent-widget/` — separate service (port 3012)

---

## Tasks

### AW-01 — Frontend: Embed agent-widget via iframe in Conversation Drawer
**Status**: ❌ Missing
**FRD Reference**: Section 6.3.3

**Action** in `ConversationDetailDrawer.jsx` (created in CM-09):
- Widget tab renders an `<iframe>` pointing to `{AGENT_WIDGET_URL}/widget?conversationId={id}&mode=portal`
- The agent-widget service must support `mode=portal` query param to enable read-only or restricted mode
- Apply `sandbox="allow-scripts allow-same-origin"` attribute
- Handle iframe load errors gracefully (show fallback message)

**Files to change**: `src/components/ConversationDetailDrawer.jsx`

---

### AW-02 — Frontend: PostMessage API for widget communication
**Status**: ❌ Missing
**FRD Reference**: Section 6.3.3 — "Cross-frame communication"

**Action**: Create `src/lib/widgetBridge.ts`:
```typescript
// Listen for messages from the embedded widget iframe
window.addEventListener('message', (event) => {
  if (event.origin !== AGENT_WIDGET_ORIGIN) return;
  // Handle: { type: 'message:sent', payload }, { type: 'typing:start' }, etc.
});

// Send messages TO the widget iframe
export function sendToWidget(iframe: HTMLIFrameElement, type: string, payload: unknown) {
  iframe.contentWindow?.postMessage({ type, payload }, AGENT_WIDGET_ORIGIN);
}
```

**Files to create**: `src/lib/widgetBridge.ts`

---

### AW-03 — Agent-widget service: Support `mode=portal` parameter
**Status**: ❌ Missing (depends on agent-widget service changes)

**Action** in `../agent-widget/src/server.js` or `../agent-widget/src/client/`:
- Accept `?mode=portal` URL parameter
- In portal mode:
  - Read-only for supervisors (viewing but not sending)
  - Full send capability for assigned agents
  - Hide internal agent-only UI elements
- Pass `mode` in widget init config

**Files to change**: `../agent-widget/src/server.js`, `../agent-widget/src/public/index.html` (or client app)

---

### AW-04 — Frontend: Message composition improvements in Workspace
**Status**: ⚠️ Partial (basic text send exists)
**FRD Reference**: Section 6.3 — "Message formatting, media attachment"

**Action** in `ConversationComponents.jsx` (MessageThread section):
- Add file attachment button (currently UI-only, no upload)
- Wire attachment button → `POST /api/messages/upload` (backend exists)
- Show file preview before send
- Display sent images/documents in message thread with preview

**Files to change**: `src/components/ConversationComponents.jsx`, `src/services/messageService.js`

---

### AW-05 — Frontend: WhatsApp Template Message Selector
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "Template message selector"

**Action**:
- Add "Templates" button in message composition area
- Opens a modal showing available WhatsApp templates
- Templates fetched from `GET /api/messages/templates` (backend needed)
- Select template → fills message area with template content + variables
- Variable fields shown as editable inline inputs

**Files to change**: `src/components/ConversationComponents.jsx`
**New backend endpoint needed**: `GET /api/messages/templates`

---

### AW-06 — Backend: `GET /api/messages/templates`
**Status**: ❌ Missing

**Action** in `messageController.js`:
- Calls Meta Graph API: `GET /{whatsapp-business-account-id}/message_templates`
- Returns approved templates with name, category, language, components

**Endpoint**: `GET /api/messages/templates`
**Files to change**: `../agent-portal-service/src/controllers/messageController.js`

---

### AW-07 — Frontend: Quick Replies
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "Quick reply buttons"

**Action**:
- Add configurable quick replies to message composition area
- Predefined responses stored in tenant settings (e.g. "Hello, how can I help?", "One moment please")
- Click quick reply → fills text area, can be edited before send

**Files to change**: `src/components/ConversationComponents.jsx`

---

### AW-08 — Frontend: Customer Profile Panel
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "Customer profile panel"

**Action** in `ConversationDetailDrawer.jsx`:
- Right panel or section showing:
  - Contact name (editable if unknown)
  - WhatsApp ID (wa_id)
  - Conversation count (how many sessions)
  - First seen / Last seen dates
  - Custom notes field (saved to backend)

**Files to change**: `src/components/ConversationDetailDrawer.jsx`

---

### AW-09 — Frontend: Message Read Receipts (tick marks)
**Status**: ❌ Missing
**FRD Reference**: Section 6.3 — "Delivery ticks"

**Action** (builds on RT-07):
- Outbound messages show:
  - Single grey tick: sent to Meta
  - Double grey tick: delivered to customer device
  - Double blue tick: read by customer
- Icons from Lucide or custom SVGs

**Files to change**: `src/components/ConversationComponents.jsx`

---

### AW-10 — Frontend: Conversation Assignment UI
**Status**: ⚠️ Partial (backend endpoint exists `POST /api/conversations/:id/assign`)

**Action**:
- Add "Assign to me" button in conversation header
- Add "Transfer to..." button opening agent selector modal
- Show current assigned agent name in conversation header badge

**Files to change**: `src/components/ConversationDetailDrawer.jsx` (once created)
**Files to change**: `src/services/conversationService.js`

---

## Acceptance Criteria

- [ ] Agent widget loads in the Widget tab of conversation drawer via iframe
- [ ] Portal mode shows appropriate read/write permissions based on user role
- [ ] File attachments can be sent (image, document) with preview
- [ ] Template selector shows approved WABA templates and allows selection
- [ ] Quick replies populate the text area on click
- [ ] Customer profile panel shows contact history and editable notes
- [ ] Delivery ticks show correct status per outbound message
- [ ] "Assign to me" and "Transfer to" buttons work
