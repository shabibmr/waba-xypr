# Task 10 — Future Enhancements (Post-MVP)

**Priority:** LOW — listed in FRD Section 13 as future work
**Depends on:** All previous tasks (MVP must be complete first)
**Blocks:** Nothing

---

## Overview

These features are explicitly called out in FRD Section 13 as future enhancements. They should be planned after the core MVP is working. None are required for a basic working widget.

---

## F1 — Typing Indicators

**FRD Reference:** Section 13 — "Typing: WebSocket event"

**Description:** Show a "typing..." indicator when the customer is composing a message on WhatsApp.

**Backend changes:**
- Handle `customer_typing` WebSocket event from inbound message pipeline
- Emit `typing_indicator` event to agent widget room

**Frontend changes:**
- `TypingIndicator` component — animated dots
- Subscribe to `typing_indicator` socket event
- Auto-hide after 3s timeout

```javascript
socket.on('typing_indicator', ({ waId }) => {
  setTyping(true);
  clearTimeout(typingTimer.current);
  typingTimer.current = setTimeout(() => setTyping(false), 3000);
});
```

---

## F2 — Emoji Reactions

**FRD Reference:** Section 13 — "Reactions: Emoji picker"

**Description:** Agents can react to messages with emojis (mirroring WhatsApp reactions).

**Options:**
- Use `emoji-mart` or `@emoji-mart/react` library
- Trigger via long-press or hover on a message
- POST reaction to `/api/v1/widget/react` → forwards to whatsapp-api-service

**UI:** Floating emoji picker anchored to message row

---

## F3 — Message Templates UI

**FRD Reference:** Section 13 — "Templates: Predefined messages"
**Current state:** 3 hardcoded templates

**Improvements:**
- Fetch real templates from Meta Business API (via whatsapp-api-service)
- UI: Template browser with search/filter
- Dynamic parameter input form (fills in `{{1}}`, `{{2}}` placeholders)
- Template preview before send
- Support for header image templates

**Backend:**
- `GET /api/v1/widget/templates` fetches from Meta API (not hardcoded)
- Cache template list in Redis (TTL: 5 min)

---

## F4 — Message Search

**FRD Reference:** Section 13 — "Search: Local filter"

**Description:** Filter visible messages in the current conversation.

**Frontend only** — no backend change needed:
```jsx
const [query, setQuery] = useState('');
const filtered = messages.filter(m =>
  !query || m.text?.toLowerCase().includes(query.toLowerCase())
);
```

Add a search input above `MessageList` with a clear button.

---

## F5 — Conversation Export (CSV)

**FRD Reference:** Section 13 — "Export: CSV via API"

**Backend:**
- `GET /api/v1/widget/conversation/:id/export?format=csv`
- Fetch all messages from state-manager
- Format as CSV: `timestamp, direction, text, status`
- Return as `Content-Disposition: attachment; filename="conversation.csv"`

**Frontend:**
- Export button in widget header
- Triggers download

---

## F6 — Analytics Dashboard

**FRD Reference:** Section 13 — "Analytics: Track events"

**Current state:** `GET /api/v1/widget/conversation/:id/analytics` returns raw numbers.

**Enhancements:**
- Visual charts: message volume over time, response time histogram
- Use `recharts` or `chart.js` in React
- Track frontend events (message sent, template used, media uploaded)
- Send events to an analytics endpoint: `POST /api/v1/widget/events`

---

## F7 — Conversation Tagging

**FRD Reference:** Section 13 — "Tagging: Metadata API"

**Description:** Agents can add tags to conversations (e.g., "billing", "urgent", "resolved").

**Backend:**
- `POST /api/v1/widget/conversation/:id/tags` — add tags
- `GET /api/v1/widget/conversation/:id/tags` — list tags
- Store in state-manager or agent-portal-service DB

**Frontend:**
- Tag chip input above/below message list
- Auto-suggest from existing tags

---

## F8 — SLA Timer

**FRD Reference:** Section 13 — "SLA: Timer UI"

**Description:** Show a countdown/elapsed timer for SLA compliance (e.g., "Response required in 2:45").

**Data source:** SLA config from tenant settings (agent-portal-service)

**Frontend:**
```jsx
function SLATimer({ startTime, slaSeconds }) {
  const elapsed = useElapsedTime(startTime);
  const remaining = slaSeconds - elapsed;
  const urgent = remaining < 60;
  return (
    <div className={`sla-timer ${urgent ? 'sla-timer--urgent' : ''}`}>
      {remaining > 0 ? `SLA: ${formatTime(remaining)}` : 'SLA BREACHED'}
    </div>
  );
}
```

---

## F9 — AI Reply Suggestions

**FRD Reference:** Section 13 — "AI: Suggestion endpoint"

**Description:** Show suggested replies from an AI endpoint based on conversation context.

**Backend:**
- `GET /api/v1/widget/conversation/:id/suggestions` → calls AI service
- Returns: `[{ text: 'Thank you for reaching out...' }, ...]`

**Frontend:**
- Suggestion chips above input box
- Click to populate input field

---

## F10 — Persistent Notification Badge

**Description:** Show unread message count when widget is minimized (Genesys embedded mode).

**Implementation:**
- Track incoming socket events while widget is unfocused/minimized
- Use `postMessage` to update Genesys agent desktop with badge count
- Reset count when widget is focused

---

## Priority Matrix for Future Work

| Feature | User Value | Dev Effort | Recommend Order |
|---------|-----------|------------|-----------------|
| F3 Message Templates UI | High | Medium | 1st |
| F1 Typing Indicators | Medium | Low | 2nd |
| F4 Message Search | Medium | Low | 3rd |
| F6 Analytics Dashboard | Medium | High | 4th |
| F5 Export CSV | Low | Low | 5th |
| F7 Tagging | Medium | Medium | 6th |
| F8 SLA Timer | High (enterprise) | Medium | 7th |
| F9 AI Suggestions | High (future) | High | 8th |
| F2 Emoji Reactions | Low | Medium | 9th |
| F10 Badge Count | Low | Low | 10th |
