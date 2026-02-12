# T01 — RabbitMQ Consumer (CRITICAL / MVP)

**Status:** NOT IMPLEMENTED
**Severity:** CRITICAL — Service cannot fulfill its primary purpose without this
**MVP Required:** YES
**Depends On:** Nothing
**Blocks:** T04, T11, T03 (deduplication path)

---

## Gap Description

The FRD defines this service as **queue-driven**. Its primary trigger is a RabbitMQ message arriving on the `inbound-processed` queue. The entire `inbound-transformer → genesys-api-service → Genesys Cloud` flow requires a consumer.

**Current state:**
`amqplib` is listed in `package.json` but is **never imported or used** anywhere in `src/`. The service starts an HTTP server and exposes a `POST /genesys/messages/inbound` endpoint. There is no RabbitMQ connection, no channel, no consumer loop.

**FRD reference:** Section 6.1 (REQ-IN-07), Section 4 (Architecture Context)

---

## What Needs to Be Built

### 1. RabbitMQ Connection & Channel (`src/services/rabbitmq.service.ts`)

A persistent connection with reconnection logic:

- Connect using `RABBITMQ_URL` env var
- Heartbeat: 30 seconds
- On connection error/close: reconnect with exponential backoff
- Expose a channel getter

**Required config keys to add to `src/config/config.ts`:**
```
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
```

### 2. Queue/Exchange Setup

On startup, assert the following (idempotent):
- Queue: `inbound-processed` (durable: true)
- Queue: `correlation-events` (durable: true)
- DLQ queue: `genesys-api.dlq` (durable: true)

Queue names must use the shared constants from `shared/constants/queues.js`.

### 3. Consumer Loop (`src/consumers/inbound.consumer.ts`)

- `basic_qos` prefetch: 10 (configurable via `RABBITMQ_PREFETCH`)
- `auto_ack: false` — manual acknowledgment only
- On message: deserialize JSON, call processing pipeline
- ACK on success
- NACK with requeue=true on retriable failures
- ACK (no requeue) + DLQ route on permanent failures

### 4. Message Handler Sequence

```
receive message
  → parse JSON (catch SyntaxError → DLQ)
  → validate schema (T03)
  → extract tenantId
  → load tenant config (T06)
  → check deduplication (T02 + T07)
  → check rate limit (T09 — skip for MVP, allow through)
  → get auth token (T07)
  → send to Genesys (T05)
  → publish correlation event (T04)
  → ACK message
```

### 5. Startup in `src/index.ts`

After HTTP server starts, initialize RabbitMQ connection and start consumer.

---

## Error Handling per Message Type

| Error | Action |
|-------|--------|
| Invalid JSON | DLQ + ACK |
| Schema validation failure | DLQ + ACK |
| Unknown tenant | DLQ + ACK |
| Duplicate message | Silent ACK (skip) |
| Genesys 4xx | DLQ + ACK |
| Genesys 5xx / timeout | NACK (requeue) |
| Max retries exceeded | DLQ + ACK |

---

## Environment Variables Required

```env
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
RABBITMQ_PREFETCH=10
```

---

## Acceptance Criteria

- [ ] Service connects to RabbitMQ on startup
- [ ] Consumer reads from `inbound-processed` queue
- [ ] Messages are processed (not silently dropped)
- [ ] ACK sent only after successful Genesys delivery + correlation publish
- [ ] NACK sent on retriable errors (no message loss)
- [ ] Service reconnects automatically if RabbitMQ disconnects
- [ ] Prefetch limit respected (10 max in-flight)
