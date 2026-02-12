# T12 — HTTP Timeouts on Axios Calls (MAJOR)

**Status:** NOT IMPLEMENTED
**Severity:** MAJOR — All axios calls have no timeout; a hung Genesys API will block a consumer thread indefinitely
**MVP Required:** No (quick fix — important for production stability)
**Depends On:** Nothing (independent quick fix)
**Blocks:** Nothing

---

## Gap Description

Every axios call in the codebase (`genesys-api.service.ts`, `auth.service.ts`, `tenant.service.ts`) is made with no timeout configuration. A network stall or unresponsive upstream service will cause the RabbitMQ consumer goroutine to hang indefinitely, consuming a prefetch slot and blocking that message from being processed.

**FRD reference:** Section 5.2 (tenant config timeout fields), Section 3 (Functional Requirements, Timeout handling)

---

## Affected Files and Calls

### `src/services/genesys-api.service.ts`
All `axios.post()` and `axios.get()` calls:
- `sendInboundMessage` — POST to Genesys inbound API
- `sendOutboundMessage` — POST to Genesys agentless API
- `sendReceipt` — POST to Genesys receipts API
- `getConversation` — GET Genesys conversation
- `updateConversationAttributes` — PATCH conversation attributes
- `disconnectConversation` — POST disconnect
- `sendTypingIndicator` — POST typing
- `getConversationMessages` — GET messages
- `getOrganizationUsers` — GET users
- `getGenesysUser` — GET user
- `getOrganizationDetails` — GET org

### `src/services/auth.service.ts`
- `getAuthToken` — GET auth token

### `src/services/tenant.service.ts`
- `getTenantGenesysCredentials` — GET tenant credentials

---

## FRD Timeout Values

Per FRD section 5.2 tenant config schema:
- `connectMs`: 5000 (5 seconds connect timeout)
- `readMs`: 10000 (10 seconds read/response timeout)

For internal service calls (auth-service, tenant-service), reasonable defaults:
- Connect: 2000ms
- Read: 5000ms

---

## What Needs to Be Fixed

### For Genesys API calls (after T06 provides tenant config)

Use per-tenant timeout config when available:
```typescript
await axios.post(url, payload, {
  headers: { ... },
  timeout: credentials.timeout?.readMs || 10000
});
```

Axios `timeout` option applies to the entire request (connect + read combined), which is a limitation. For separate connect/read timeouts, an `http.Agent` with `timeout` configuration would be needed — but single `timeout` is acceptable for MVP.

### For internal service calls (auth, tenant)

Apply fixed conservative timeouts:
```typescript
await axios.get(url, {
  headers: { ... },
  timeout: 5000  // 5 seconds for internal services
});
```

---

## Acceptance Criteria

- [ ] All axios calls to Genesys Cloud have a timeout (10 seconds minimum)
- [ ] All axios calls to auth-service have a timeout (5 seconds)
- [ ] All axios calls to tenant-service have a timeout (5 seconds)
- [ ] Timeout error is caught and classified as retriable (NACK) in consumer
- [ ] Timeout value is logged when a timeout occurs
