# Task File 07 — Observability, Logging & Testing
**Priority:** MEDIUM — Can be done in parallel with 05–06. Required for production monitoring.
**FRD Refs:** §6.4, §9

---

## Gaps

### GAP-45: Structured logging missing correlation fields
**Current (`logger.ts`):** Basic Winston logger. Logs use `logger.info('message', data)` without consistent correlation fields.
**FRD (§6.4.1):** Each webhook log entry must include:
```
tenant_id, genesys_id, integration_id, event_type, processing_time_ms,
echo_filtered, has_media, status
```
Pattern: structured key-value fields alongside message.

---

### GAP-46: Authenticated Genesys URLs logged unredacted
**Current:** No sanitization of payloads before logging.
**FRD (§8.3.2):** Attachment URLs are authenticated Genesys URLs — must be redacted in logs. Only log `media_id`, not the full URL.
```js
// Before logging payload, replace attachment.url with "[REDACTED]"
```

---

### GAP-47: No Prometheus metrics
**Current:** No metrics endpoint or instrumentation.
**FRD (§6.4.2):** Prometheus metrics required:
- `webhook_requests_total` (labels: `tenant_id`, `event_type`, `status`)
- `webhook_processing_seconds` histogram (labels: `event_type`)
- `signature_failures_total` (labels: `tenant_id`)
- `echo_filtered_total` (labels: `tenant_id`)
- `media_processed_total` (labels: `tenant_id`, `mime_type`, `status`)
- `rabbitmq_publish_failures_total` (labels: `queue`)

**Note:** Can use `prom-client` npm package for Node.js. Expose at `GET /metrics`.

---

### GAP-48: Unit tests use wrong payload schema
**Current (`tests/unit/services/webhook.test.js`, `tests/fixtures/events.js`):** Test fixtures use the old/wrong event structure (not FRD Open Messaging schema with `channel.from.id`, `type`, `direction`).
**Required:** Tests must be updated to use the FRD-compliant payload structure after implementation changes in tasks 01–05.

---

### GAP-49: Test coverage for signature validation scenarios
**Current (`tests/api/webhook.api.test.js`):** Only tests 200 OK for health and basic webhook acceptance. No tests for:
- Valid signature → 200
- Invalid signature → 403
- Missing signature → 403
- Unknown integration → 400
- Malformed JSON → 400

**FRD (§9.1.1):** These must all be covered.

---

### GAP-50: Test coverage for echo detection
**Current:** No tests for echo detection.
**FRD (§9.1.2):** Required test cases:
- `messageId: "mw-12345"` → filtered
- `messageId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"` (v4 UUID) → filtered
- `messageId: null` → NOT filtered
- `messageId: "external-system-msg-123"` → NOT filtered

---

### GAP-51: Test coverage for event classification
**Current:** Minimal tests.
**FRD (§9.1.3):** Required test cases:
- `type: "Text", direction: "Outbound"` → `outbound_message`
- `type: "Receipt", direction: "Outbound"` → `status_event`
- `type: "HealthCheck"` → `health_check`
- `type: "Text", direction: "Inbound"` → `unknown`

---

### GAP-52: No integration tests for media processing
**Current:** No media processing test.
**FRD (§9.2.2):** Integration test needed for:
- Webhook with attachment → MinIO upload → presigned URL in RabbitMQ payload
- Media download failure → message still published with `media: null`

---

## Tasks

| # | Task | File(s) to Change |
|---|------|-------------------|
| 07-A | Add structured log fields to each webhook processing step: `tenantId`, `genesysId`, `integrationId`, `eventType`, `processingTimeMs`, `echoFiltered`, `hasMedia` | `webhook.controller.ts`, `genesys-handler.service.ts` |
| 07-B | Add payload sanitization before logging: redact `attachment.url` | new `sanitize.ts` util or inline |
| 07-C | Add `prom-client` dependency; implement counters/histograms from FRD §6.4.2; expose at `GET /metrics` | new `metrics.ts`, `index.ts` |
| 07-D | Update test fixtures in `tests/fixtures/events.js` to use FRD-compliant Open Messaging payload schema | `tests/fixtures/events.js` |
| 07-E | Add unit tests for signature validation (valid, invalid, missing, tampered body) | `tests/unit/` |
| 07-F | Add unit tests for echo detection (all 4 scenarios from GAP-50) | `tests/unit/` |
| 07-G | Add unit tests for event classification (all 4 scenarios from GAP-51) | `tests/unit/` |
| 07-H | Add integration tests for end-to-end message flow (text + media, with mocked external services) | `tests/api/` |

---

## Acceptance Criteria
- Every processed webhook log includes `tenantId`, `genesysId`, `eventType`, `processingTimeMs`
- Attachment URLs are `[REDACTED]` in all log output
- `GET /metrics` returns Prometheus-format metrics
- Test coverage for all FRD §9.1 scenarios
- Existing tests pass after schema refactoring
