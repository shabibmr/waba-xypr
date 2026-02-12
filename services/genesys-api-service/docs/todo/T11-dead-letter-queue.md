# T11 — Dead Letter Queue (DLQ) Routing (MAJOR)

**Status:** NOT IMPLEMENTED
**Severity:** MAJOR — Permanently-failed messages are silently discarded; no recovery or audit trail
**MVP Required:** No (MVP can operate without DLQ but messages will be lost on permanent failures)
**Depends On:** T01 (RabbitMQ channel required to publish to DLQ)
**Blocks:** Nothing

---

## Gap Description

The FRD defines a dead letter queue (`genesys-api.dlq`) for messages that cannot be processed and should not be retried. Without this, permanent failures (bad payloads, unknown tenants, Genesys 400 errors) are silently ACKed and the original message is lost.

**FRD reference:** Section 9.4 (Dead Letter Queue), Section 6.1 (Error Scenarios table)

---

## When to Route to DLQ

Per FRD section 6.1 error scenarios:

| Error | Route to DLQ? |
|-------|--------------|
| Invalid JSON | YES |
| Missing required field (validation failure) | YES |
| Unknown tenant | YES |
| Genesys 400 Bad Request | YES |
| Genesys 403 Forbidden | YES |
| Genesys 404 Not Found | YES |
| Max retries exceeded | YES |
| Duplicate message (dedupe) | NO — silent ACK |
| Genesys 5xx | NO — NACK (requeue) |
| Rate limit / timeout | NO — NACK (requeue) |

---

## DLQ Message Schema (FRD Section 9.4)

```json
{
  "original_payload": { ... },
  "failure_reason": "Validation error: Missing metadata.tenantId",
  "failure_timestamp": "2023-11-15T03:33:20.000Z",
  "service": "genesys-api-service",
  "tenant_id": "uuid-tenant-1111-2222-3333"
}
```

- `original_payload`: the full original message (or raw string if JSON parse failed)
- `failure_reason`: human-readable description of why it failed
- `failure_timestamp`: UTC ISO-8601 when failure occurred
- `service`: always `"genesys-api-service"` (identifies origin)
- `tenant_id`: from metadata if available, `null` if not parseable

---

## What Needs to Be Built

### 1. DLQ Publisher in RabbitMQ Service (T01 extension)

```typescript
async function routeToDLQ(
  originalPayload: unknown,
  reason: string,
  tenantId?: string
): Promise<void>
```

Publishes to:
- Exchange: `dlq`
- Routing key: `genesys-api.dlq`
- Message: DLQ schema above
- Properties: `delivery_mode: 2` (persistent), `content_type: application/json`

**Critical:** If DLQ publish fails, log CRITICAL-level error (not just error) — this is a double failure.

### 2. DLQ Queue Setup in Startup (T01)

Assert on startup:
- Exchange: `dlq` (type: `direct`, durable: true)
- Queue: `genesys-api.dlq` (durable: true)
- Binding: `dlq` exchange → `genesys-api.dlq` queue on routing key `genesys-api.dlq`

### 3. Wire into Consumer (T01, T03, T05)

Consumers of `routeToDLQ`:
- `T03` — validation failures
- `T01` — JSON parse errors
- `T01` — unknown tenant (config not found)
- `T08` — max retries exceeded
- `T05` — non-retriable Genesys errors (400, 403, 404)

In all these cases: call `routeToDLQ(payload, reason)` then `channel.ack(msg)`.

---

## Operational Notes

- The DLQ is an audit trail, not a retry queue
- A separate tool/process (admin dashboard or manual) should process DLQ messages
- DLQ messages should be retained long enough for investigation (e.g., 7 days message TTL)
- Consider adding message count alerting on DLQ queue depth

---

## Acceptance Criteria

- [ ] Invalid JSON messages land in `genesys-api.dlq` (not lost)
- [ ] Unknown tenant messages land in `genesys-api.dlq`
- [ ] Genesys 400 responses land in `genesys-api.dlq`
- [ ] Genesys 5xx responses do NOT land in DLQ (they NACK+requeue)
- [ ] DLQ message contains `failure_reason` and `failure_timestamp`
- [ ] DLQ message contains original payload for replay
- [ ] DLQ publish failure is logged at CRITICAL level
- [ ] DLQ queue and exchange are asserted durable on startup
