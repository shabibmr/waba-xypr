# Issues & Solutions

## CRITICAL

**1. Status Queue Name Mismatch — State Manager**
Change `'statusQueue'` hardcode in `rabbitmq.service.ts` to `process.env.STATUS_QUEUE || QUEUES.GENESYS_STATUS_UPDATES`.

---

**2. No Correlation Event Consumer — State Manager**
Add `consumeCorrelationEvents()` in `rabbitmq.service.ts` that calls a handler to update `conversation_mappings` with the returned `conversationId`.

---

**3. Missing `tenantId` in Mapping Lookups — State Manager**
Pass `message.tenantId` into every `getMappingByConversationId()` and `getMappingByWaId()` call inside `operationHandlers.ts`.

---

**4. Missing ~20 Backend Endpoints — Agent Portal Service**
Implement all missing routes in `agent-portal-service`: auth, conversations, messages, dashboard, organization, onboarding. Mount under `/api/agents` and `/api`.

---

**5. Auth-Service Internal-Only, Frontend Blocked**
Route all frontend auth calls through `agent-portal-service`, which calls auth-service internally using `INTERNAL_SERVICE_SECRET`. Never expose auth-service directly to frontend.

---

## HIGH

**6. `tenantId` Optional on `InboundMessage` Type**
In `state-manager/src/types/index.ts`, change `tenantId?: string` to `tenantId: string` on `InboundMessage` interface.

---

**7. `messageId` vs `wamid` — WhatsApp Webhook Status Payload**
In `webhook-processor.service.js`, rename `messageId: status.id` to `wamid: status.id` to match State Manager's `StatusUpdate` type.

---

**8. Media Object Structure Mismatch — Genesys Webhook → State Manager**
Expand `OutboundMessage` type to `media?: { url: string; contentType: string; filename?: string }` instead of flat `media_url`.

---

**9. `AuthCallback.jsx` Sends Wrong Field Name**
Change `token: data.token` to `accessToken: data.accessToken, refreshToken: data.refreshToken` in the `postMessage` call inside `AuthCallback.jsx`.

---

**10. No Refresh Token Issued by Auth-Service**
Add a `POST /api/v1/token/refresh` route in auth-service. Issue and cache a `refreshToken` alongside `accessToken` on initial token generation.

---

## MEDIUM

**11. Missing `Wifi` Import — `Onboarding.jsx`**
Add `Wifi` to the lucide-react import on line 3 of `Onboarding.jsx`.

---

**12. Hardcoded Token Key in Portal Services**
Replace `sessionStorage.getItem('agent_access_token')` in `Onboarding.jsx:226` and `dashboardService.js:11` with `authService.getAccessToken()`.

---

**13. Legacy `tenantId: 'default'` in State Manager**
Remove legacy compatibility methods or replace the hardcoded `'default'` string with a thrown error to prevent silent cross-tenant data access.

---

**14. Missing `VITE_META_*` in `.env.example`**
Add `VITE_META_APP_ID=` and `VITE_META_CONFIG_ID=` entries to `agent-portal/.env.example`.

---

**15. Inconsistent `getToken()` vs `getAccessToken()`**
Replace all `authService.getToken()` calls in `conversationService`, `messageService`, and `socketService` with `authService.getAccessToken()`. Remove the legacy alias.
