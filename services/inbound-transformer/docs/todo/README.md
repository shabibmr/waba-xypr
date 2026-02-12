# Inbound Transformer — Todo Index

## Overview

This directory contains the gap analysis and task breakdown for bringing the `inbound-transformer` service into alignment with its implementation spec (`implementation_plan.md`).

> The `docs/inbound-transformer-frd.md` file is empty. The `implementation_plan.md` in the service root is the authoritative functional reference.

---

## File Index

| File | Content | Priority |
|------|---------|----------|
| `00-gap-analysis.md` | Full gap analysis (G1–G16) mapping every discrepancy between current code and FRD | — |
| `01-critical-fixes.md` | 4 bugs that prevent the service from working at all | CRITICAL |
| `02-media-and-message-types.md` | Media attachments forwarding, interactive / contact / sticker / system message handling | HIGH |
| `03-typescript-types-and-validation.md` | Type interfaces and Joi input validation | MEDIUM |
| `04-error-handling-and-dlq.md` | Dead letter queue, exponential backoff, custom error classes | HIGH |
| `05-rabbitmq-reliability.md` | Connection recovery, graceful shutdown | MEDIUM |
| `06-logging.md` | Winston structured logging, tenant context, correlation IDs | MEDIUM |
| `07-health-check.md` | HTTP 503 on degraded state, metadata fields | LOW |
| `08-testing.md` | Fix placeholder tests, add real unit + integration tests | MEDIUM |

---

## Dependency Order

```
01-critical-fixes          ← do first, nothing works without this
    └── 02-media-and-message-types
    └── 04-error-handling-and-dlq
            └── 05-rabbitmq-reliability
    └── 03-typescript-types-and-validation
            └── 08-testing
    └── 06-logging         ← independent, can run in parallel with 02/03/04
    └── 07-health-check    ← independent
```

---

## MVP Minimal Task List

These are the **minimum tasks** required to make the service functional for basic end-to-end text messaging between WhatsApp and Genesys.

### Must-do (service broken without these)

- [x] **01-A** — Fix queue name (`INBOUND_WHATSAPP_MESSAGES` not `INBOUND_TRANSFORMER_WORK`)
  - `src/config/rabbitmq.ts` — 1 line change
  - **Without this: zero messages are ever consumed**

- [x] **01-B** — Add `from` field to existing-conversation message payload
  - `src/utils/messageFormatter.ts` — add `from` to the `isNew=false` branch
  - **Without this: every reply in an ongoing conversation throws TypeError at genesys-api-service**

- [x] **01-C** — Fix response field from `response.id` → `response.messageId`
  - `src/services/genesysService.ts` and `src/services/transformerService.ts` — 3 line changes
  - **Without this: Genesys message ID is never persisted in state-manager**

### Should-do (for a stable MVP demo)

- [x] **04-A** — Add Dead Letter Queue + retry counter with exponential backoff
  - `src/config/rabbitmq.ts`, `src/consumers/inboundConsumer.ts`
  - Prevents one bad/invalid message from halting all processing indefinitely

- [x] **02-A** — Forward media attachments (image, document, audio, video)
  - `src/utils/messageFormatter.ts` — `buildAttachmentContent()` + `content` array in payload
  - Agents receive attachment URL instead of `[Image]` placeholder text

- [x] **05-A** — Add RabbitMQ connection-level event handlers
  - `src/consumers/inboundConsumer.ts`
  - Prevents silent consumer death after a RabbitMQ restart

- [x] **01-D** — Fix `.env.example` variable name (`GENESYS_API_URL`)
  - Allows operators to override the Genesys API service URL

### Can defer (polish / production hardening)

- [ ] **02-C** — Interactive messages (button / list replies)
- [ ] **02-D** — Contact message support
- [ ] **02-F** — Filter system / reaction messages
- [ ] **03-A/B/C** — TypeScript types (replace `any`)
- [ ] **03-D** — Joi input validation
- [ ] **04-B** — Exponential backoff
- [ ] **04-C/D/E** — Custom errors, error handler middleware
- [ ] **05-B/C** — Channel-level recovery, graceful shutdown
- [ ] **06-A/B/C/D** — Structured logging (Winston)
- [ ] **07-A/B** — Health check HTTP 503 + metadata
- [ ] **08-A–E** — Fix all tests

---

## Key Bugs Summary

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| G1 | Wrong queue name subscribed | Service receives 0 messages | 1 line |
| G2 | `from` missing for existing conversations | TypeError on every reply | 5 lines |
| G3 | `response.id` → `response.messageId` | Genesys ID never tracked | 3 lines |
| G4 | Media URL ignored, attachment never built | Agents see `[Image]` only | Medium |
| G10 | No DLQ | Bad message loops forever | Medium |
| G13 | No reconnect after connection drop | Consumer silently dies | Small |
