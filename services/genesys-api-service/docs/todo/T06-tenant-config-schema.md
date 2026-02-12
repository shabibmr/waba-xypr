# T06 — Tenant Config — integrationId & Full Schema (CRITICAL / MVP)

**Status:** WRONG / INCOMPLETE
**Severity:** CRITICAL — `integrationId` is used in genesys-api.service.ts but never returned by tenant.service.ts
**MVP Required:** YES
**Depends On:** Nothing (independent fix)
**Blocks:** T05 (URL construction uses integrationId), T08 (retry config), T09 (rate limit config)

---

## Gap Description

### Problem 1 — `integrationId` Used But Not Returned

In `genesys-api.service.ts`:
```typescript
if (!credentials.integrationId) {
    throw new Error(`Missing Genesys Open Messaging Integration ID for tenant ${tenantId}`);
}
const url = `${baseUrl}/api/v2/conversations/messages/${credentials.integrationId}/inbound/open/message`;
```

In `tenant.service.ts`:
```typescript
return {
    clientId: response.data.clientId,
    clientSecret: response.data.clientSecret,
    region: response.data.region,
    // integrationId is MISSING
};
```

`credentials.integrationId` will always be `undefined`. The error is thrown but never caught cleanly — it throws before the URL is even used.

### Problem 2 — FRD Tenant Config Schema Not Fully Mapped

The FRD defines a richer configuration object (Section 5.2):

```json
{
  "genesys": {
    "region": "usw2.pure.cloud",
    "oauthClientId": "...",
    "oauthClientSecret": "...",
    "integrationId": "...",
    "rateLimits": { "requestsPerMinute": 300, "burstSize": 50 },
    "retry": { "maxAttempts": 5, "baseDelayMs": 1000, "maxDelayMs": 32000 },
    "timeout": { "connectMs": 5000, "readMs": 10000 }
  }
}
```

Current `tenant.service.ts` returns a flat object without `rateLimits`, `retry`, or `timeout`.

### Problem 3 — Field Name Mismatch

The tenant-service API (per tenant-service MEMORY.md) returns `clientId`, `clientSecret`, `region` for Genesys credentials. These match what `tenant.service.ts` maps. However:
- The FRD calls these `oauthClientId` / `oauthClientSecret`
- The `integrationId` field in the tenant service corresponds to `genesys_integration_id` in the DB (UNIQUE constraint per MEMORY.md)

---

## What Needs to Be Fixed

### In `src/services/tenant.service.ts`

Return the complete credential set from the tenant-service API response:

```typescript
return {
  clientId: response.data.clientId,
  clientSecret: response.data.clientSecret,
  region: response.data.region,
  integrationId: response.data.integrationId,  // ADD THIS — maps to genesys_integration_id
  rateLimits: response.data.rateLimits || { requestsPerMinute: 300, burstSize: 50 },
  retry: response.data.retry || { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 32000 },
  timeout: response.data.timeout || { connectMs: 5000, readMs: 10000 }
};
```

### Verify Tenant Service API Response

Check `services/tenant-service/src/routes/tenantRoutes.js` endpoint:
`GET /tenants/:id/genesys/credentials`

Confirm it returns `integrationId`. If not, this needs to be added to the tenant service response (that is a tenant-service task, not this service's task — but it must be coordinated).

### In `src/config/config.ts`

Add default values for tenant config when not provided by tenant service:
```
GENESYS_DEFAULT_RATE_LIMIT=300
GENESYS_DEFAULT_RETRY_ATTEMPTS=5
GENESYS_DEFAULT_TIMEOUT_MS=10000
```

---

## Acceptance Criteria

- [ ] `getTenantGenesysCredentials()` returns `integrationId` (not undefined)
- [ ] Service does not throw "Missing Genesys Open Messaging Integration ID" for a valid tenant
- [ ] `rateLimits`, `retry`, `timeout` have defaults when not provided
- [ ] `integrationId` comes from the tenant service API (not hardcoded)
- [ ] Error thrown when tenant-service returns 404 (tenant not found)
