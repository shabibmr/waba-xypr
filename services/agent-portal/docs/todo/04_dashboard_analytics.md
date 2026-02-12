# Task File 04: Dashboard & Analytics

**Priority**: 🔴 HIGH
**Depends on**: `02_state_management.md` (React Query hooks), `07_ui_components.md` (KPI card, chart components)
**Blocks**: Nothing (standalone feature)
**Estimated effort**: 2 weeks

---

## Context

The FRD specifies a real-time analytics dashboard with KPI cards, two charts (message volume, delivery success), and a token expiry indicator. The current `Dashboard.jsx` is a stub showing hardcoded conversation counts derived from the conversation list. No backend analytics endpoints exist.

**FRD Reference**: Section 6.2 — Dashboard & Analytics

**Relevant files**:
- `src/pages/Dashboard.jsx` — current stub
- `src/hooks/useAnalytics.ts` — to be created (per SM-04)
- `../agent-portal-service/src/routes/dashboardRoutes.js` — exists as stub
- `../agent-portal-service/src/controllers/dashboardController.js` — exists as stub
- `../agent-portal-service/src/services/dashboardCache.js` — exists but empty

---

## Tasks

### DA-01 — Backend: `GET /api/dashboard/metrics`
**Status**: ❌ Missing (route exists but controller is stub)
**FRD Reference**: Section 6.2 — KPI Cards

**Action** in `dashboardController.js`:
- Query state-manager DB (or agent-portal-service DB) for:
  - `totalMessages` — count of all messages for tenant today
  - `activeConversations` — conversations with status = 'active'
  - `closedConversations` — conversations with status = 'closed' or 'disconnected'
  - `failedDeliveries` — messages with delivery status = 'failed' today
  - `avgResponseTime` — average time between inbound and first outbound (seconds)
- Cache result in Redis for 30 seconds (use `dashboardCache.js`)
- Return structured JSON

**Response shape**:
```json
{
  "totalMessages": 1234,
  "activeConversations": 12,
  "closedConversations": 45,
  "failedDeliveries": 3,
  "avgResponseTimeSeconds": 42,
  "periodStart": "2026-02-12T00:00:00Z",
  "periodEnd": "2026-02-12T23:59:59Z"
}
```

**Endpoint**: `GET /api/dashboard/metrics`
**Files to change**: `../agent-portal-service/src/controllers/dashboardController.js`

---

### DA-02 — Backend: `GET /api/dashboard/message-volume`
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — Message Volume Chart

**Action**:
- Query params: `period=24h|7d|30d`
- Returns hourly or daily buckets:
  ```json
  {
    "labels": ["00:00", "01:00", ...],
    "inbound": [10, 5, 8, ...],
    "outbound": [8, 4, 7, ...]
  }
  ```
- Aggregate from conversation_messages table grouped by hour/day

**Endpoint**: `GET /api/dashboard/message-volume?period=24h`
**Files to change**: `../agent-portal-service/src/controllers/dashboardController.js`

---

### DA-03 — Backend: `GET /api/dashboard/delivery-stats`
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — Delivery Success Chart

**Action**:
- Query params: `period=24h|7d|30d`
- Returns per-bucket delivery counts:
  ```json
  {
    "labels": ["Mon", "Tue", ...],
    "delivered": [100, 95, 110, ...],
    "failed": [2, 5, 1, ...]
  }
  ```

**Endpoint**: `GET /api/dashboard/delivery-stats?period=7d`
**Files to change**: `../agent-portal-service/src/controllers/dashboardController.js`

---

### DA-04 — Backend: `GET /api/dashboard/token-status`
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — Token Expiry Indicator

**Action**:
- Returns Genesys OAuth token expiry info for the tenant:
  ```json
  {
    "genesysToken": {
      "expiresAt": "2026-02-19T12:00:00Z",
      "daysRemaining": 7,
      "status": "warning"   // "healthy" > 14d, "warning" 7-14d, "critical" < 7d
    }
  }
  ```
- Read from tenant credentials or Redis cache

**Endpoint**: `GET /api/dashboard/token-status`
**Files to change**: `../agent-portal-service/src/controllers/dashboardController.js`

---

### DA-05 — Frontend: KPI Cards with real data
**Status**: ❌ Missing (stub exists with hardcoded values)
**FRD Reference**: Section 6.2 — KPI Cards

**Action** in `Dashboard.jsx`:
- Use `useDashboardMetrics()` hook (per SM-04)
- Display 5 cards: Total Messages, Active Conversations, Closed, Failed Deliveries, Avg Response Time
- Show loading skeleton while data loads
- Show trend indicator (↑↓) comparing to previous period (if DA-01 returns prev data)

**Files to change**: `src/pages/Dashboard.jsx`

---

### DA-06 — Frontend: Message Volume Chart
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "Line chart: inbound vs. outbound, 30-second refresh"

**Action**:
- Install `recharts` (add to package.json)
- Add `LineChart` with two series (inbound green, outbound blue)
- Period selector: 24h / 7d / 30d tabs
- Auto-refetch every 30 seconds via `useQuery({ refetchInterval: 30000 })`

**Files to change**: `src/pages/Dashboard.jsx`
**Package**: `npm install recharts`

---

### DA-07 — Frontend: Delivery Success Chart
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "Bar chart: delivered vs. failed"

**Action**:
- Add `BarChart` with two bars per period (delivered, failed)
- Period selector shared with message volume chart
- Color: delivered = green, failed = red

**Files to change**: `src/pages/Dashboard.jsx`

---

### DA-08 — Frontend: Token Expiry Indicator
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "Token expiry indicator with color coding"

**Action**:
- Add a card or banner showing Genesys token status:
  - Green: > 14 days remaining
  - Yellow/orange: 7–14 days remaining ("Renew Soon")
  - Red: < 7 days remaining ("Renewal Required")
- Link to Settings > Genesys Credentials to renew

**Files to change**: `src/pages/Dashboard.jsx`

---

### DA-09 — Frontend: Date range selector
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "Date range picker for charts"

**Action**:
- Add tab-style period selector: "24h | 7d | 30d | Custom"
- "Custom" shows a date range picker (two date inputs)
- Selection updates both charts simultaneously

**Files to change**: `src/pages/Dashboard.jsx`

---

### DA-10 — Frontend: Export CSV / PDF
**Status**: ❌ Missing
**FRD Reference**: Section 6.2 — "Export dashboard data to CSV or PDF"

**Action**:
- Export button on dashboard header
- CSV: uses `papaparse` to convert metrics JSON to CSV, trigger browser download
- PDF: use `jspdf` + `html2canvas` to capture dashboard section

**Files to change**: `src/pages/Dashboard.jsx`
**Packages**: `npm install papaparse jspdf html2canvas`

---

## Acceptance Criteria

- [ ] Dashboard loads real data from backend APIs (not hardcoded)
- [ ] 5 KPI cards show current values with loading skeletons
- [ ] Message volume line chart visible with 24h/7d/30d toggle
- [ ] Delivery success bar chart visible
- [ ] Token expiry indicator shows correct color based on days remaining
- [ ] Charts auto-refresh every 30 seconds
- [ ] Date range selector works and updates both charts
- [ ] Export to CSV downloads a valid file
