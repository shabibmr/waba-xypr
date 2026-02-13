# Phase 7: Structured Logging

**Priority:** High | **Depends on:** Phase 1 (for field names like internalId)
**FRD Refs:** Section 8.2

---

## Gap Summary

All logging is `console.log` / `console.error` with unstructured strings. No JSON formatting, no correlation IDs, no tenant/message context in log entries. The FRD requires structured JSON logs with mandatory fields on every entry.

---

## Current State

- **Logger:** `console.log` / `console.error` throughout
- **Format:** Human-readable strings, e.g., `'Processing outbound message: ' + messageId`
- **Context fields:** None -- no `tenant_id`, `internal_id`, `wa_id`, `correlation_id`
- **Log levels:** Implicit via console method only (log = info, error = error)
- **JSON output:** No

## Expected State (FRD)

Every log entry should be JSON with:
```json
{
  "timestamp": "ISO-8601",
  "level": "INFO|WARN|ERROR|DEBUG",
  "service": "outbound-transformer",
  "version": "1.x.x",
  "tenant_id": "",
  "internal_id": "",
  "wa_id": "",
  "correlation_id": "",
  "message": "",
  "context": {}
}
```

---

## Tasks

### T7.1 - Add Logger Dependency
- Options (pick one):
  - `winston` -- most popular Node.js logger, JSON transport built-in
  - `pino` -- faster, lower overhead, JSON by default
- Recommendation: `pino` for a high-throughput message processing service
- `npm install pino`

### T7.2 - Create Logger Service
- Create `src/utils/logger.ts`
- Configure:
  - JSON output format
  - Log level from `LOG_LEVEL` env var (default: `info`)
  - Base fields: `service: 'outbound-transformer'`, `version: config.serviceVersion`
- Export:
  - `logger` -- base logger instance
  - `createMessageLogger(message)` -- child logger with `tenant_id`, `internal_id`, `wa_id`, `correlation_id` from message fields

### T7.3 - Replace All console.log/console.error
- **src/services/rabbitmq.service.ts:**
  - Replace `console.log('Waiting for outbound messages...')` with `logger.info('Consumer started', { queue })`
  - Replace `console.error('Message processing error:...')` with `msgLogger.error({ err, stage }, 'Message processing failed')`
  - Replace `console.error('RabbitMQ consumer error:...')` with `logger.error({ err }, 'RabbitMQ connection failed')`
- **src/services/message-processor.service.ts:**
  - Replace `console.log('Processing outbound message:...')` with `logger.info({ messageId }, 'Processing outbound message')`
  - Replace `console.log('Using WhatsApp credentials...')` with `msgLogger.debug('Resolved tenant credentials')`
  - Replace `console.log('Message sent to WhatsApp:...')` with `msgLogger.info({ metaMessageId }, 'Message dispatched')`
  - Replace `console.error(...)` with `msgLogger.error({ err }, 'Outbound transformation failed')`
- **src/services/whatsapp.service.ts:**
  - Add logging for dispatch attempts and failures
- **src/index.ts:**
  - Replace `console.log('Server running...')` with `logger.info({ port }, 'Service started')`
- **src/middleware/error.middleware.ts:**
  - Use `logger.error` instead of relying on console

### T7.4 - Add Correlation ID Propagation
- When processing a message, attach `correlation_id` (= `genesysId`) to all log entries
- Use child logger pattern:
  ```typescript
  const msgLogger = logger.child({
    tenant_id: message.tenantId,
    internal_id: message.internalId,
    wa_id: message.waId,
    correlation_id: message.genesysId
  });
  ```

### T7.5 - Add Processing Stage Context
- Log which stage of processing the message is in:
  - `validation`, `idempotency_check`, `transformation`, `url_validation`, `dispatch`, `dlq_routing`
- Add `stage` field to log context

### T7.6 - Update Config
- Add `LOG_LEVEL` env var to config and `.env.example`

---

## Acceptance Criteria

- [ ] All logs are JSON-formatted
- [ ] Every log entry has: `timestamp`, `level`, `service`, `version`
- [ ] Message-context logs include: `tenant_id`, `internal_id`, `wa_id`, `correlation_id`
- [ ] No raw `console.log` / `console.error` remaining in source
- [ ] Log level configurable via `LOG_LEVEL` env var
- [ ] Sensitive data not logged (no access tokens, no full message bodies in production)
