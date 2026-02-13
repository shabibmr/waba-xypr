# Phase 3: Dispatch & Queue Routing

**Priority:** Critical | **Depends on:** Phase 2 (Transformation Logic)
**FRD Refs:** REQ-OUT-04, Section 2.1, Section 2.2

---

## Gap Summary

The current service **dispatches transformed messages via direct HTTP** to whatsapp-api-service using type-specific endpoints (`/whatsapp/send/text`, `/whatsapp/send/image`, etc.). The FRD's **recommended mode** is to publish to the `outbound-ready` RabbitMQ queue. The HTTP mode is available as an optional "pipeline mode" fallback.

Additionally, the input queue name is wrong -- consuming from `outbound-genesys-messages` but FRD specifies `outbound-processed`.

---

## Current State

| Feature | Status | Detail |
|---------|--------|--------|
| Input queue | Wrong name | Consumes `outbound-genesys-messages`, FRD says `outbound-processed` |
| Output queue dispatch | Missing | No publish to `outbound-ready` queue |
| HTTP dispatch | Implemented | Calls whatsapp-api-service endpoints directly |
| Exchange/routing key | Missing | FRD specifies topic exchange `outbound.exchange` with `outbound.ready.{tenantId}` routing key |
| RabbitMQ message headers | Missing | No `X-Tenant-ID`, `X-Correlation-ID`, `X-Message-Type`, `X-Timestamp` headers on outgoing messages |
| Persistent delivery mode | Missing | Not setting `deliveryMode: 2` on published messages |
| HTTP retry with backoff | Missing | Current HTTP dispatch has no retry logic |

## Expected State (FRD)

- **Primary (Queue Mode):** Publish to `outbound-ready` via `outbound.exchange` with tenant-specific routing key, persistent delivery, headers
- **Secondary (Pipeline Mode):** HTTP `POST /whatsapp/send` with 3 retries, exponential backoff, proper status code handling

---

## Tasks

### T3.1 - Add `outbound-processed` and `outbound-ready` Queue Names to Shared Constants
- Update `/shared/constants/queues.js`:
  ```javascript
  OUTBOUND_PROCESSED: 'outbound-processed',   // State Manager -> Outbound Transformer
  OUTBOUND_READY: 'outbound-ready',           // Outbound Transformer -> WhatsApp API Service
  OUTBOUND_TRANSFORMER_DLQ: 'outbound-transformer-dlq', // DLQ for failed transformations
  ```
- These are new queues, alongside existing `OUTBOUND_GENESYS_MESSAGES`

### T3.2 - Update Input Queue to `outbound-processed`
- In `src/config/index.ts`:
  - Change `rabbitmq.queue` from `QUEUES.OUTBOUND_GENESYS_MESSAGES` to `QUEUES.OUTBOUND_PROCESSED`
  - Or make it configurable: `process.env.QUEUE_INPUT || QUEUES.OUTBOUND_PROCESSED`
- Update prefetch to 10 (configurable via `RABBITMQ_PREFETCH_COUNT` env var)

### T3.3 - Implement Queue Dispatch (Recommended Mode)
- Create `src/services/dispatcher.service.ts`
- Assert exchange and output queue on startup:
  ```typescript
  await channel.assertExchange('outbound.exchange', 'topic', { durable: true });
  await channel.assertQueue('outbound-ready', { durable: true });
  await channel.bindQueue('outbound-ready', 'outbound.exchange', 'outbound.ready.*');
  ```
- `dispatchViaQueue(transformedMessage: OutputMessage)`:
  - Routing key: `outbound.ready.${transformedMessage.metadata.tenantId}`
  - Headers: `X-Tenant-ID`, `X-Correlation-ID`, `X-Message-Type: outbound`, `X-Timestamp`, `Content-Type: application/json`
  - Properties: `deliveryMode: 2` (persistent), `contentType: 'application/json'`
  - Publish to `outbound.exchange`

### T3.4 - Implement HTTP Pipeline Dispatch (Optional Mode)
- In `src/services/dispatcher.service.ts`, add `dispatchViaHttp(transformedMessage: OutputMessage)`
- Config: `PIPELINE_MODE_ENABLED` (default: `false`), `WHATSAPP_API_BASE_URL`
- Endpoint: `POST {WHATSAPP_API_BASE_URL}/whatsapp/send`
- Send full `OutputMessage` as body (not type-specific endpoints)
- Retry: 3 attempts, exponential backoff (2s, 4s, 8s)
- Status code handling per FRD:
  - 200-299: success (ACK)
  - 400-499: client error, no retry (ACK)
  - 429: rate limited (NACK for requeue)
  - 500-599: server error, retry then NACK
  - Timeout: retry then NACK

### T3.5 - Update Message Processor to Use Dispatcher
- Replace direct `sendMessage()` call in `message-processor.service.ts` with:
  ```typescript
  if (config.pipelineMode) {
    await dispatchViaHttp(outputMessage);
  } else {
    await dispatchViaQueue(outputMessage);
  }
  ```
- Refactor `whatsapp.service.ts` -- either keep for pipeline mode with updated interface or replace entirely with dispatcher

### T3.6 - Handle Multi-Message Dispatch (Audio+Text)
- If transformer returns array (e.g., audio + separate text), dispatch each message individually
- Maintain ordering: send audio first, then text

### T3.7 - Update .env.example
- Add new env vars:
  ```
  QUEUE_INPUT=outbound-processed
  QUEUE_OUTPUT=outbound-ready
  QUEUE_DLQ=outbound-transformer-dlq
  RABBITMQ_PREFETCH_COUNT=10
  PIPELINE_MODE_ENABLED=false
  WHATSAPP_API_BASE_URL=http://whatsapp-api-service:3008
  ```

---

## Acceptance Criteria

- [ ] Service consumes from `outbound-processed` queue (not `outbound-genesys-messages`)
- [ ] Transformed messages published to `outbound-ready` via `outbound.exchange`
- [ ] Routing key includes tenantId: `outbound.ready.{tenantId}`
- [ ] Messages published with persistent delivery mode
- [ ] RabbitMQ headers set: `X-Tenant-ID`, `X-Correlation-ID`, `X-Message-Type`, `X-Timestamp`
- [ ] Prefetch count configurable (default 10)
- [ ] Pipeline (HTTP) mode available behind `PIPELINE_MODE_ENABLED` flag
- [ ] HTTP mode has 3-retry exponential backoff
