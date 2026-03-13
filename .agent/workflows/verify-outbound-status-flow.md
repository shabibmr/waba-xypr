---
description: Check outbound message status update process flow — comprehensive log-based diagnosis with failure report
---
# Verify Outbound Status Flow

Traces how an outbound message's status updates (sent → delivered → read) propagate
from the Meta Graph API response back to the Agent Widget. Starts at
`whatsapp-api-service` and follows the WAMID ACK linkage, Meta webhook callbacks,
state-manager processing, and agent-portal real-time delivery.

> **Compose files**: `docker-compose.remote.yml` (app), `docker-compose.infra.yml` (infra)
> **Requires**: Optionally a `wamid`, `genesys_message_id`, or `correlationId` to narrow the search.

---

## Step 1 — Confirm outbound message was sent to Meta

Check `whatsapp-api-service` logs for successful delivery to the Meta Graph API and extraction of the WAMID:

```bash
docker logs whatsapp-api 2>&1 | grep -iE "Message delivered|Message sent|sendMessage|messageId" | tail -n 20
```

**What to look for:**
- `Message sent to WhatsApp` with `messageId: wamid.HBg...` — confirms Meta returned a WAMID
- `Message delivered to WhatsApp` with `tenantId`, `internalId` — ACK cycle starts here
- HTTP errors (400/403/404/429/5xx) — message never reached Meta, status flow won't start

**If no logs found**: The message may still be in the `outbound.ready.msg` queue or was DLQ'd.
```bash
docker exec -it whatsapp-rabbitmq rabbitmqadmin get queue=outbound.ready.msg count=3 2>/dev/null || echo "Queue empty or not found"
docker exec -it whatsapp-rabbitmq rabbitmqadmin get queue=whatsapp.api.dlq count=3 2>/dev/null || echo "DLQ empty"
```

---

## Step 2 — Verify WAMID ACK published to state-manager

After Meta returns a WAMID, `whatsapp-api-service` publishes a correlation ACK to `outbound.ack.evt`:

```bash
docker logs whatsapp-api 2>&1 | grep -iE "ACK_TRACE|Published WAMID ACK" | tail -n 15
```

**What to look for:**
- `[ACK_TRACE] Published WAMID ACK to state-manager` with `wamid`, `correlationId`, `ackQueue`
- If missing → `whatsappResult.wamid` or `metadata.correlationId` was null; check `processMessage` logic

**Queue depth check:**
```bash
docker exec -it whatsapp-rabbitmq rabbitmqadmin get queue=outbound.ack.evt count=3 2>/dev/null || echo "Queue empty"
```

---

## Step 3 — Verify state-manager received and processed the ACK

The state-manager `handleOutboundAck` operation links `correlationId` (genesys_message_id) to `wamid` in the DB:

```bash
docker logs whatsapp-state-manager 2>&1 | grep -iE "ACK_TRACE|outbound_ack_event|updateWamid" | tail -n 20
```

**What to look for:**
- `[ACK_TRACE] 1/2 Received outbound ACK` — consumer is alive
- `[ACK_TRACE] 2/2 updateWamid result` with `updated: true` — linkage complete ✅
- `updated: false` — no matching genesys_message_id in the messages table (check outbound identity resolution)
- `Outbound ACK processing failed` — DB or connection error

> ⚠️ **Critical**: Without ACK linkage, all subsequent status updates will fail with "Message not found for wamid"

---

## Step 4 — Check Meta is sending status webhooks

Meta sends status callbacks (sent/delivered/read) to `whatsapp-webhook-service`:

```bash
docker logs whatsapp-webhook 2>&1 | grep -iE "STATUS_TRACE|statuses|processStatusUpdate|status" | tail -n 25
```

**What to look for:**
- `[STATUS_TRACE] WhatsApp webhook: queued status update` with `wamid`, `status`, `recipientId`
- Status values: `sent`, `delivered`, `read`, `failed`
- If nothing → Meta webhook URL may be misconfigured or unreachable

**Narrow by specific wamid (if known):**
```bash
docker logs whatsapp-webhook 2>&1 | grep "<WAMID>" | tail -n 10
```

**Queue depth check:**
```bash
docker exec -it whatsapp-rabbitmq rabbitmqadmin get queue=inbound.whatsapp.status.evt count=3 2>/dev/null || echo "Queue empty"
```

---

## Step 5 — Verify state-manager status update processing

The state-manager `handleStatusUpdate` updates the message status in DB and emits events:

```bash
docker logs whatsapp-state-manager 2>&1 | grep -iE "STATUS_TRACE|status_update" | tail -n 30
```

**What to look for (4-phase trace):**

| Phase | Log Pattern | Meaning |
|-------|-------------|---------|
| 1/4 | `Received status update` | Consumer received from queue |
| 2/4 | `DB status updated` with `previous_status → new_status` | DB write succeeded |
| 3/4 | `Mapping lookup result` with `conversation_id`, `genesys_message_id` | Correlation found |
| 4/4 | `Publishing to agent portal` | Real-time event emitted |

**Common failures:**
- `Message not found for wamid` → ACK linkage hasn't completed yet (Step 3 failed or race condition)
- `Conversation not yet correlated` → No conversation_id mapped (status retries, then DLQ)
- `invalid_transition_or_stale` → Duplicate or out-of-order status (harmless, skip)
- Only 1/4 logged, no 2/4+ → `messageService.updateStatus` failed (DB issue)

---

## Step 6 — Verify inbound status event published for Genesys

After status DB update, state-manager publishes to `inbound.status.evt` for Genesys receipt delivery:

```bash
docker logs whatsapp-state-manager 2>&1 | grep -iE "inbound-status|publishToInboundStatus|inbound.status.evt" | tail -n 10
```

**Queue depth check:**
```bash
docker exec -it whatsapp-rabbitmq rabbitmqadmin get queue=inbound.status.evt count=3 2>/dev/null || echo "Queue empty"
```

---

## Step 7 — Verify Agent Portal real-time event delivery

State-manager emits `status_update` events to `outbound.agent.portal.evt`:

```bash
docker logs whatsapp-state-manager 2>&1 | grep -iE "agent.portal.evt|publishAgentPortalEvent|status_update.*tenantId" | tail -n 10
```

Confirm the agent-portal-service consumes and forwards to WebSocket:
```bash
docker logs whatsapp-agent-portal-service 2>&1 | grep -iE "portal.evt|status|socket" | tail -n 10
```

Confirm the agent-widget receives the event:
```bash
docker logs whatsapp-agent-widget 2>&1 | grep -iE "status|socket|event" | tail -n 10
```

---

## Step 8 — Check for DLQ messages (any stage)

```bash
# whatsapp-api-service DLQ
docker exec -it whatsapp-rabbitmq rabbitmqadmin get queue=whatsapp.api.dlq count=5 2>/dev/null || echo "Empty"

# state-manager DLQ
docker exec -it whatsapp-rabbitmq rabbitmqadmin get queue=state.manager.dlq count=5 2>/dev/null || echo "Empty"
```

---

## Step 9 — End-to-End Correlation Check (specific message)

If a specific `wamid` or `genesys_message_id` is provided, trace across all services:

```bash
# Replace <ID> with the wamid or genesys_message_id
ID="<ID>"

echo "=== whatsapp-api-service ==="
docker logs whatsapp-api 2>&1 | grep -i "$ID" | tail -n 10

echo "=== whatsapp-webhook-service ==="
docker logs whatsapp-webhook 2>&1 | grep -i "$ID" | tail -n 10

echo "=== state-manager ==="
docker logs whatsapp-state-manager 2>&1 | grep -i "$ID" | tail -n 15

echo "=== agent-portal-service ==="
docker logs whatsapp-agent-portal-service 2>&1 | grep -i "$ID" | tail -n 5
```

---

## Step 10 — Generate Failure Report

Compile findings into a diagnostic report:

### Status Flow Report

| # | Checkpoint | Service | Queue/Action | Status | Detail |
|---|-----------|---------|-------------|--------|--------|
| 1 | Message sent to Meta | whatsapp-api-service | Meta Graph API POST | ✅/❌ | WAMID received or HTTP error |
| 2 | WAMID ACK published | whatsapp-api-service | outbound.ack.evt | ✅/❌ | correlationId + wamid |
| 3 | ACK processed (linkage) | state-manager | handleOutboundAck | ✅/❌ | wamid linked to genesys_message_id |
| 4 | Meta status webhook received | whatsapp-webhook-service | /webhook POST | ✅/❌ | sent/delivered/read events |
| 5 | Status queued | whatsapp-webhook-service | inbound.whatsapp.status.evt | ✅/❌ | Payload published |
| 6 | Status DB update | state-manager | handleStatusUpdate | ✅/❌ | previous → new status |
| 7 | Inbound status event | state-manager | inbound.status.evt | ✅/❌ | For Genesys receipt |
| 8 | Agent Portal event | state-manager | outbound.agent.portal.evt | ✅/❌ | Real-time UI update |
| 9 | Widget receives update | agent-portal-service → agent-widget | WebSocket/SSE | ✅/❌ | Status reflected in UI |

### Root Cause Analysis

Based on the first ❌ in the table above, diagnose:

| First Failure Point | Likely Root Cause | Recommended Fix |
|---------------------|-------------------|-----------------|
| #1 — Meta API POST | Invalid access token, expired token, bad payload, rate limit | Check `.env` META_ACCESS_TOKEN, review payload in outbound-transformer |
| #2 — ACK not published | `wamid` or `correlationId` was null in whatsapp-api-service | Check `processMessage` — Meta response might be malformed |
| #3 — ACK not processed | genesys_message_id not found in messages table | Outbound identity resolution failed — run `/trace-outbound-message` |
| #4 — No Meta webhooks | Webhook URL unreachable or misconfigured | Run `/validate-whatsapp-webhook`, check Meta Developer Portal |
| #5 — Status not queued | RabbitMQ connection issue in whatsapp-webhook-service | Check `rabbitmq.service.js` connection status, restart service |
| #6 — DB update failed | Race condition (ACK not yet linked) or DB error | Check retry logs — should auto-resolve; if persistent, check DB connectivity |
| #7 — Inbound status not published | Conversation not correlated yet | Check correlation events — run `/debug-communication-id` |
| #8 — Portal event missing | state-manager didn't reach phase 4/4 | Check phases 1-3 first; fix upstream issue |
| #9 — Widget not updated | agent-portal-service not consuming portal.evt or WebSocket broken | Check agent-portal-service logs and WebSocket connections |
