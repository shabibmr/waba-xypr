# T14 — Structured JSON Logging (MINOR)

**Status:** PARTIALLY IMPLEMENTED (console.log only, not structured JSON)
**Severity:** MINOR — Logs are not machine-parseable; no correlationId propagation; no latency fields
**MVP Required:** No (but important for debugging in production)
**Depends On:** Nothing
**Blocks:** T15 (metrics can reuse context from logger)

---

## Gap Description

`src/utils/logger.ts` uses plain `console.log/error/warn` with a string tenant-ID prefix:
```typescript
console.log(`[${tenantId}] Message sent to Genesys:`, response.data.id);
```

The FRD requires structured JSON logs with specific fields that enable log aggregation, correlation, and alerting.

**FRD reference:** Section 12.1 (Structured Logging), Section 12.4 (Distributed Tracing)

---

## FRD Log Format

```json
{
  "timestamp": "2023-11-15T03:33:20.123Z",
  "level": "INFO",
  "service": "genesys-api-service",
  "message": "Message delivered successfully",
  "tenantId": "uuid-tenant-1111",
  "correlationId": "uuid-1234-5678",
  "conversationId": "conversation-uuid-7890",
  "whatsappMessageId": "wamid.HBg...",
  "genesysRegion": "usw2.pure.cloud",
  "latencyMs": 145,
  "genesysStatus": 200
}
```

---

## Required Log Events (FRD Section 12.1)

| Event | Level | Required Fields |
|-------|-------|----------------|
| Message received from queue | INFO | tenantId, correlationId |
| Deduplication check (duplicate) | INFO | tenantId, whatsappMessageId |
| OAuth token cache HIT | DEBUG | tenantId |
| OAuth token cache MISS | DEBUG | tenantId |
| OAuth token obtained | INFO | tenantId, expiresIn, cached: false |
| Sending to Genesys API | INFO | tenantId, region, messageType |
| Conversation created in Genesys | INFO | tenantId, conversationId, communicationId |
| Correlation event published | INFO | tenantId, conversationId |
| Message routed to DLQ | ERROR | tenantId, reason |
| Rate limit exceeded | WARN | tenantId |
| Circuit breaker state change | ERROR/INFO | region, newState |
| Retry attempt | WARN | tenantId, attempt, maxAttempts |
| Token invalidated | INFO | tenantId |

---

## What Needs to Be Built

### 1. Rewrite `src/utils/logger.ts`

Replace console-based logger with a structured JSON emitter:

**Option A (simple):** Use `winston` with JSON transport
- Add `winston` dependency
- Configure with `json()` format
- Levels: error, warn, info, debug

**Option B (minimal):** Custom JSON writer (no additional dependency)
- Write JSON objects to stdout
- Match format exactly per FRD

For MVP simplicity, Option B avoids adding a new dependency.

**New logger interface:**
```typescript
interface LogContext {
  tenantId?: string;
  correlationId?: string;
  conversationId?: string;
  whatsappMessageId?: string;
  region?: string;
  latencyMs?: number;
  [key: string]: unknown;
}

logger.info(message: string, context?: LogContext): void
logger.warn(message: string, context?: LogContext): void
logger.error(message: string, context?: LogContext): void
logger.debug(message: string, context?: LogContext): void
```

Each call emits:
```json
{
  "timestamp": "<ISO-8601>",
  "level": "INFO",
  "service": "genesys-api-service",
  "message": "<message>",
  ...context fields
}
```

### 2. Correlation Context Propagation

The FRD (Section 12.4) requires `correlationId` and `tenantId` to flow through all log statements for a given message.

Use Node.js `AsyncLocalStorage` (built-in) to maintain a per-request context:
```typescript
// Set at start of message processing
asyncContext.run({ correlationId, tenantId }, () => {
  // All logger.* calls inside here automatically include correlationId + tenantId
});
```

This avoids passing context through every function parameter.

---

## Acceptance Criteria

- [ ] All log output is valid JSON (one object per line)
- [ ] Every log line includes `timestamp`, `level`, `service`, `message`
- [ ] `correlationId` is present in all logs within a message processing cycle
- [ ] `tenantId` is present in all tenant-specific logs
- [ ] DEBUG logs only emit in non-production (controlled by `LOG_LEVEL` env var)
- [ ] OAuth tokens and client secrets are never logged
- [ ] Latency (ms) is logged on Genesys API calls
