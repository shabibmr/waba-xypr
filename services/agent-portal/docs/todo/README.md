# Agent Portal — Gap Analysis & Task List

**Source**: FRD `docs/customer-portal-frd.md` vs actual implementation (Feb 2026)
**Overall Completeness**: ~40–50%
**Backend (agent-portal-service)**: ~60% complete
**Frontend (agent-portal)**: ~35% complete

---

## File Index (dependency order)

| File | Area | Priority | Est. Effort |
|------|------|----------|-------------|
| [01_security_auth.md](./01_security_auth.md) | OAuth PKCE + token security | 🔴 CRITICAL | 1 week |
| [02_state_management.md](./02_state_management.md) | React Query + custom hooks | 🔴 HIGH | 1 week |
| [03_onboarding.md](./03_onboarding.md) | Onboarding wizard completion | 🔴 HIGH | 1.5 weeks |
| [04_dashboard_analytics.md](./04_dashboard_analytics.md) | KPIs, charts, metrics | 🔴 HIGH | 2 weeks |
| [05_conversation_management.md](./05_conversation_management.md) | Search, filters, pagination, export | 🟡 MEDIUM | 2 weeks |
| [06_settings.md](./06_settings.md) | Credentials, webhooks, team mgmt | 🟡 MEDIUM | 2 weeks |
| [07_ui_components.md](./07_ui_components.md) | Shared UI component library | 🟡 MEDIUM | 1 week |
| [08_realtime.md](./08_realtime.md) | Socket.IO live updates | 🟡 MEDIUM | 1 week |
| [09_agent_widget.md](./09_agent_widget.md) | Widget embed + messaging features | 🟢 LOWER | 3 weeks |

---

## Dependency Order Rationale

```
01_security_auth
    └── 02_state_management
            ├── 03_onboarding  (needs validated auth flow)
            ├── 04_dashboard   (needs React Query + auth)
            └── 07_ui_components (needed by all pages)
                    ├── 05_conversation_management
                    ├── 06_settings
                    └── 08_realtime
                            └── 09_agent_widget
```

---

## MVP Minimal Task List

The following tasks are the **bare minimum** to achieve a working MVP where a customer can:
1. Log in via Genesys OAuth
2. Complete onboarding (WABA + Genesys config)
3. View conversations and send messages
4. See a basic dashboard

### MVP Critical Path

**From `01_security_auth.md`**:
- [ ] S-01: Fix token storage — move from localStorage to sessionStorage/memory
- [ ] S-02: Add PKCE (generateCodeVerifier / generateCodeChallenge) to Genesys OAuth flow

**From `02_state_management.md`**:
- [ ] SM-01: Install and configure React Query QueryClient in main.jsx
- [ ] SM-02: Refactor AuthContext to use sessionStorage (not localStorage)
- [ ] SM-03: Create `useConversations` hook (replaces manual useState in Workspace.jsx)

**From `03_onboarding.md`**:
- [ ] OB-01: Implement Step 2 — Genesys credentials form (clientId, secret, region)
- [ ] OB-02: Implement Step 4 — Connectivity test (call `/api/onboarding/validate`)
- [ ] OB-03: Implement Step 5 — Display generated webhook URLs
- [ ] OB-04: Backend: `POST /api/onboarding/validate` endpoint
- [ ] OB-05: Backend: `GET /api/onboarding/progress` + `PUT /api/onboarding/progress` endpoints

**From `04_dashboard_analytics.md`**:
- [ ] DA-01: Backend: `GET /api/dashboard/metrics` endpoint (total, active, closed, failed counts)
- [ ] DA-02: Replace hardcoded Dashboard.jsx stats with real API data
- [ ] DA-03: Add token expiry indicator (days remaining card)

**From `05_conversation_management.md`**:
- [ ] CM-01: Add status filter (active/closed) to conversation list
- [ ] CM-02: Add search by name/phone number

**From `06_settings.md`**:
- [ ] SET-01: Organization profile edit form (name, email, timezone)
- [ ] SET-02: WhatsApp credentials update UI (re-connect / token refresh)
- [ ] SET-03: Genesys credentials update form

---

## Feature Completeness Summary

| Feature | Implemented | Missing | % Done |
|---------|-------------|---------|--------|
| Genesys OAuth (no PKCE) | Yes | PKCE, secure storage | 70% |
| Onboarding Wizard | Steps 1,3 only | Steps 2,4,5 | 50% |
| Dashboard | KPI stubs | Real data, charts | 20% |
| Analytics | None | All | 0% |
| Conversation List | Basic | Search, filter, pagination | 50% |
| Conversation Detail | None | Drawer, audit, logs | 5% |
| Message Sending | Text only | Templates, media | 60% |
| Settings | Read-only display | Edit, credentials, webhooks | 20% |
| Agent Widget | Stub | Full implementation | 10% |
| React Query | Not used | All | 0% |
| Socket.IO | Service exists | Wired connections | 40% |
| Security (PKCE/cookies) | Partial OAuth | PKCE, HTTP-only cookies | 30% |
| UI Component Library | Inline only | Reusable components | 20% |
