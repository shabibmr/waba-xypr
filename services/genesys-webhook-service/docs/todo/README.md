# Genesys Webhook Service — Gap Analysis & Task Index

## Overview

This directory contains the gap analysis between the current implementation and the FRD (`docs/genesys-webhook-frd.md`). The service has **fundamental structural gaps** — most critically, it processes a different Genesys event format than what the FRD specifies, and the tenant resolution / signature validation flow is incorrect.

---

## Gap Summary

| # | Gap | Severity | File |
|---|-----|----------|------|
| 01 | `integrationId` extracted from wrong payload field (should be `channel.from.id`) | 🔴 Critical | 01-security-signature.md |
| 02 | Tenant lookup uses wrong API (State Manager + credentials, not `/by-integration`) | 🔴 Critical | 01-security-signature.md |
| 03 | Invalid signature returns 401 (should be 403) | 🔴 Critical | 01-security-signature.md |
| 04 | Unknown tenant returns 404 (should be 400) | 🔴 Critical | 01-security-signature.md |
| 05 | No request size limit (10 MB) | 🟡 High | 01-security-signature.md |
| 06 | No Content-Type validation | 🟡 High | 01-security-signature.md |
| 07 | Wrong Genesys payload schema assumed (uses Notification API, not Open Messaging) | 🔴 Critical | 02-event-classification-echo.md |
| 08 | Event classification missing (no `direction`/`type` check) | 🔴 Critical | 02-event-classification-echo.md |
| 09 | **Echo detection completely absent** — causes infinite message loops | 🔴 Critical | 02-event-classification-echo.md |
| 10 | HealthCheck event type not handled | 🟡 High | 02-event-classification-echo.md |
| 11 | Outbound message RabbitMQ payload schema wrong | 🔴 Critical | 03-rabbitmq-payload-queues.md |
| 12 | Status event RabbitMQ payload schema wrong | 🔴 Critical | 03-rabbitmq-payload-queues.md |
| 13 | Queue names don't match FRD (`outboundQueue`/`statusQueue`) | 🔴 Critical | 03-rabbitmq-payload-queues.md |
| 14 | No retry logic for RabbitMQ publish | 🟡 High | 03-rabbitmq-payload-queues.md |
| 15 | No OAuth token for Genesys media download (Auth Service not called) | 🔴 Critical | 04-media-processing.md |
| 16 | Media download buffers full file in memory (should stream) | 🟡 High | 04-media-processing.md |
| 17 | Wrong MinIO bucket name (`whatsapp-media` vs `media-outbound`) | 🟡 High | 04-media-processing.md |
| 18 | File path missing day component | 🟠 Medium | 04-media-processing.md |
| 19 | Presigned URL not time-limited to 7 days | 🟡 High | 04-media-processing.md |
| 20 | No MIME type validation before upload | 🟡 High | 04-media-processing.md |
| 21 | No file size check (20 MB max) | 🟡 High | 04-media-processing.md |
| 22 | Media detection reads wrong payload field | 🔴 Critical | 04-media-processing.md |
| 23 | Always returns 200 before validation — can't return 403/400 | 🔴 Critical | 05-response-codes-error-handling.md |
| 24 | Missing 503 for dependency failure | 🟡 High | 05-response-codes-error-handling.md |
| 25 | No 4.5s timeout wrapper | 🟡 High | 05-response-codes-error-handling.md |
| 26 | Error response format nested, not flat | 🟠 Medium | 05-response-codes-error-handling.md |
| 27 | No rate limiting (100 req/min per IP) | 🟡 High | 06-reliability-nfr.md |
| 28 | Health check missing MinIO check; returns 200 even when unhealthy | 🟡 High | 06-reliability-nfr.md |
| 29 | No `/ready` readiness endpoint | 🟠 Medium | 06-reliability-nfr.md |
| 30 | No structured logging correlation fields | 🟠 Medium | 07-observability-testing.md |
| 31 | Authenticated URLs logged unredacted | 🟠 Medium | 07-observability-testing.md |
| 32 | No Prometheus metrics | 🟠 Medium | 07-observability-testing.md |
| 33 | Test fixtures use wrong payload schema | 🟡 High | 07-observability-testing.md |

---

## Task Files (Dependency Order)

```
01-security-signature.md       ← Must be done FIRST (tenant resolution is a prerequisite for everything)
02-event-classification-echo.md ← Depends on 01 (correct integration ID needed)
03-rabbitmq-payload-queues.md  ← Depends on 02 (classification drives which queue/schema)
04-media-processing.md         ← Depends on 01 (needs tenant for Auth Service), 02 (media detected post-classification)
05-response-codes-error-handling.md ← Depends on 01–02 (needs correct flow to know what to return)
06-reliability-nfr.md          ← Depends on 01–05 being functionally correct
07-observability-testing.md    ← Depends on 01–05 (tests must match new schemas)
```

---

## 🟢 Absolute Minimum — Error-Free Text Flow (10 tasks)

This is the smallest possible set of changes for the service to boot, receive a Genesys webhook, and correctly route a **text message** to RabbitMQ without crashing. Media, Auth Service, MinIO, echo detection, and exact error codes are all skipped.

### What you get with this set
- Text + status messages flow end-to-end to RabbitMQ
- Signature validation works against the correct tenant secret
- Downstream services (State Manager) receive the correct payload shape
- Service doesn't crash on any standard Genesys webhook

### What you accept as known gaps
- ⚠️ Media messages publish with `media: null` (attachment dropped silently)
- ⚠️ No echo detection — test carefully; middleware message loops are possible
- ⚠️ HTTP codes 401/404 instead of 403/400 (Genesys retries on any non-200, so functionally identical)
- ⚠️ Auth Service not called (media download would fail if attempted)

---

### Step 1 — Fix tenant resolution & signature validation
> **Why first:** Every other part of the service depends on correctly identifying the tenant and validating the request. Currently the integration ID is read from the wrong field and the lookup calls the wrong API — the service fails on every legitimate Genesys request.

**`01-A`** ✅ — Extract `integrationId` from `channel.from.id` (not root body)
**`01-B`** ✅ — Replace tenant lookup with `GET /api/v1/tenants/by-integration/{integrationId}` and read `webhookSecret` from its response
**`01-C`** ✅ — Remove the State Manager fallback from the signature path entirely

### Step 2 — Fix response sequencing
> **Why second:** Currently `200 OK` is sent *before* validation. This means the signature check and tenant lookup happen after the response is committed — any subsequent error is silently swallowed. All validation must happen synchronously before the `200` is returned.

**`05-A`** ✅ — Refactor `handleWebhook`: run parse → tenant lookup → signature check synchronously first; then `res.json({ status: 'accepted' })`; then process async

### Step 3 — Fix payload schema and event classification
> **Why third:** The handler currently reads fields from a completely different Genesys event format (Notification API). After this step it will correctly read the Open Messaging webhook format that Genesys actually sends.

**`02-A`** ✅ — Rewrite handler to read FRD Open Messaging schema: `payload.id`, `channel.from.id`, `channel.to.id`, `channel.to.idType`, `type`, `direction`, `text`, `channel.time`
**`02-B`** ✅ — Add `classifyEvent()`: if `direction != "Outbound"` → skip; `type == "Text"|"Structured"` → outbound_message; `type == "Receipt"|"Typing"|"Disconnect"` → status_event; `type == "HealthCheck"` → return `200 { status: "healthy" }` immediately

### Step 4 — Fix RabbitMQ payload shape and queue names
> **Why fourth:** Even with correct parsing, the messages published to RabbitMQ have the wrong shape and go to wrong queues. State Manager will not process them. This is the last piece of the text-only flow.

**`03-A`** ✅ — Rewrite outbound publish: `{ tenantId, genesysId: payload.id, type: "message", timestamp: channel.time, payload: { text, to_id: channel.to.id, to_id_type: channel.to.idType, media: null } }`
**`03-B`+`03-C`** ✅ — Rewrite status publish: `{ tenantId, genesysId: payload.id, originalMessageId: channel.messageId, status: lowercase(payload.status), timestamp: channel.time }` with mapping (`Delivered→delivered`, `Read→read`, `Typing→typing`, `Disconnect→disconnect`)
**`03-D`** ✅ — Fix queue names: messages → `outboundQueue` (`outbound-genesys-messages`), status events → `statusQueue` (`genesys-status-updates`)

---

## ✅ Full MVP — Add Media & Safety (adds 8 tasks)

After the 10 above are done, add these to handle media and avoid the most dangerous operational risks.

### Media — skip Auth Service, add graceful degradation

**`04-I`** ✅ — Fix media detection: check `payload.content[].contentType === "Attachment"` to find attachments
**`04-J`** ✅ — Graceful degradation: wrap media processing in try/catch; always publish the message; set `media: null` on any failure

**`04-A/B`** ✅ — Auth Service call: `POST /api/v1/token { tenantId, type: 'genesys' }` → `Authorization: Bearer {token}` on download request
**`04-C`** ✅ — Streaming download: `axios({ responseType: 'stream' })` piped directly to MinIO `putObject` (no full memory buffer)
**`04-D`** ✅ — Bucket name fixed: `media-outbound`
**`04-E`** ✅ — Path now includes day: `{tenantId}/{YYYY}/{MM}/{DD}/{uuid}.{ext}`
**`04-F`** ✅ — 7-day presigned URL via `minio.presignedGetObject(bucket, key, 604800)`
**`04-G`** ✅ — MIME allow-list enforced; unsupported type throws → handler degrades to `media: null`
**`04-H`** ✅ — `Content-Length` checked before download; rejects > 20 MB → handler degrades to `media: null`

### Echo detection — prevents message loops

**`02-C`+`02-D`** ✅ — Add `isEchoEvent()`: check `channel.messageId` for `mw-`/`middleware-`/`injected-` prefix; return `200 { echo_filtered: true }` without publishing
> Without this, every message sent by `genesys-api-service` will echo back as a webhook and re-enter the pipeline. Safe to skip in controlled testing, but **required before any real traffic**.

### Minimal reliability

**`03-F`** ✅ — Add one-retry on RabbitMQ publish failure (100ms delay); log critical after both fail
**`01-G`** ✅ — Add 10 MB request body limit to prevent oversized payloads from crashing the JSON parser

---

## 🔴 Defer Until After MVP

These are skipped for now. They improve correctness, security, and operability but do not block the basic message flow.

| Task | Why Skippable |
|---|---|
| `01-D` 401→403, `01-E` 404→400 | Genesys retries on any non-200; wrong code doesn't affect function |
| `01-F` Remove base64 sig fallback | Extra format is harmless for now |
| `01-H` Content-Type validation | Genesys always sends `application/json`; no real risk in dev |
| `04-A/B` Auth Service for media download | Skip entire media download; graceful `media: null` covers it |
| `04-C` Streaming download | Memory concern only; no functional impact at low volume |
| `04-D` Fix bucket name | Irrelevant until media download is enabled |
| `04-E` Fix path day component | Minor correctness issue |
| `04-F` 7-day presigned URL | Irrelevant until media upload is enabled |
| `04-G` MIME type validation | Irrelevant until media download is enabled |
| `04-H` 20 MB file size check | Irrelevant until media download is enabled |
| `05-B` Missing integration ID response | Falls through to signature failure already |
| `05-C` 503 for Tenant Service down | Currently returns 500; acceptable for dev |
| `05-D` 4.5s timeout wrapper | Low risk at dev traffic levels |
| `05-E` Flat error format | Cosmetic; Genesys ignores error body |
| `05-F` JSON parse error 400 | Express default handles this adequately |
| `06-A` Rate limiting | No risk in dev/single-tenant testing |
| `06-B/C` MinIO health check | Skip until media enabled |
| `06-D` `/ready` endpoint | Not needed without Kubernetes |
| `06-E` RabbitMQ reconnect cap | Auto-reconnect loop is harmless in dev |
| `06-G` Circuit breaker | Resilience-only; not blocking |
| `07-A` Structured log fields | Observability improvement |
| `07-B` Redact attachment URLs | Security hygiene, not functional |
| `07-C` Prometheus metrics | Observability enhancement |
| `07-D–H` Test suite updates | Do after implementation stabilises |

---

## Implementation Status

### ✅ Implemented (MVP Complete)

| Feature | Status | Task |
|---|---|---|
| `integrationId` extracted from `channel.from.id` | ✅ Fixed | 01-A |
| Tenant lookup via `GET /api/v1/tenants/by-integration/{id}` | ✅ Fixed | 01-B |
| State Manager fallback removed from signature path | ✅ Fixed | 01-C |
| 10 MB request body limit | ✅ Fixed | 01-G |
| Response sequencing — validate first, then `200` | ✅ Fixed | 05-A |
| FRD Open Messaging schema fields (`payload.id`, `channel.*`, etc.) | ✅ Fixed | 02-A |
| `classifyEvent()` with direction + type check | ✅ Fixed | 02-B |
| HealthCheck handled with `{ status: "healthy" }` | ✅ Fixed | 02-B |
| Echo detection (`mw-`/`middleware-`/`injected-` prefix) | ✅ Fixed | 02-C/D |
| Outbound message payload schema (FRD-compliant) | ✅ Fixed | 03-A |
| Status event payload schema (FRD-compliant) | ✅ Fixed | 03-B/C |
| Queue names: `outbound-genesys-messages` / `genesys-status-updates` | ✅ Fixed | 03-D |
| One-retry on RabbitMQ publish failure (100ms delay) | ✅ Fixed | 03-F |
| Media detection from `content[].contentType === "Attachment"` | ✅ Fixed | 04-I |
| Graceful media degradation (`media: null` on failure) | ✅ Fixed | 04-J |

### ✅ Already Working (Unchanged)

| Feature | Status |
|---|---|
| Express server boots on port 3011 | ✅ Working |
| Raw body capture for signature validation | ✅ Working |
| HMAC-SHA256 constant-time comparison | ✅ Working |
| MinIO client initialization | ✅ Working (wrong bucket — deferred) |
| RabbitMQ connection + auto-reconnect | ✅ Working |
| Winston structured logger | ✅ Working |
| Docker multi-stage build | ✅ Working |
| TypeScript compilation | ✅ Working |

### ❌ Still Missing (Deferred)

| Feature | Status |
|---|---|
| OAuth token for Genesys media download | ✅ Implemented (04-A/B) |
| Streaming media download | ✅ Implemented (04-C) |
| Correct MinIO bucket (`media-outbound`) | ✅ Implemented (04-D) |
| Day path component | ✅ Implemented (04-E) |
| 7-day presigned URL | ✅ Implemented (04-F) |
| MIME type validation | ✅ Implemented (04-G) |
| 20 MB file size check | ✅ Implemented (04-H) |
| 403 for invalid signature (currently 401) | ❌ Deferred (01-D) |
| 400 for unknown tenant (currently 404) | ❌ Deferred (01-E) |
| Rate limiting | ❌ Deferred (06-A) |
| Prometheus metrics | ❌ Deferred (07-C) |
| 4.5s timeout wrapper | ❌ Deferred (05-D) |
