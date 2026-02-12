# Task 06 — Structured Logging

**Priority**: MEDIUM
**Depends on**: Task 01 (no hard dependency, but easier to debug once queue flows)
**Blocks**: nothing, but needed before production

---

## 06-A: Add Winston Logger

**Gap ref**: G12

**Problem**: All logging uses `console.log` / `console.error`. No log levels, no structured fields, no correlation IDs, no tenant scoping.

**Create**: `src/utils/logger.ts`

```typescript
import winston from 'winston';

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()]
});

export default logger;
```

**Add dependency**: `winston` to `package.json`.

---

## 06-B: Add Tenant-Scoped Logging Helper

Create a helper that attaches `tenantId` and `messageId` to every log entry for a given processing context:

```typescript
export function createMessageLogger(tenantId: string, messageId: string) {
    return logger.child({ tenantId, messageId, service: 'inbound-transformer' });
}
```

**Usage in `transformerService.ts`**:
```typescript
const log = createMessageLogger(tenantId, metaMessage.messageId);
log.info('Processing inbound message', { type: metaMessage.type });
log.error('Failed to send to Genesys', { error: sendError.message });
```

---

## 06-C: Replace All `console.log` / `console.error`

**Files to update**:
- `src/consumers/inboundConsumer.ts`
- `src/services/transformerService.ts`
- `src/services/stateService.ts`
- `src/services/genesysService.ts`
- `src/controllers/healthController.ts`

Replace every `console.log` with the appropriate `logger.info()`, `logger.debug()`, `logger.warn()`, or `logger.error()`.

---

## 06-D: Add Correlation / Trace ID

For end-to-end tracing across services, propagate the WhatsApp `messageId` as a correlation ID in all HTTP calls to downstream services.

Add `X-Correlation-ID: <messageId>` header to all axios requests in:
- `src/services/stateService.ts`
- `src/services/genesysService.ts`

Log the correlation ID at every processing step.
