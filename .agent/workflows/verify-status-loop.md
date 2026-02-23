---
description: Verify the WhatsApp status callback loop from Meta webhook back to the Agent Widget
---
# Verify Status Loop

This workflow verifies the return path ensuring WhatsApp delivery statuses
(sent → delivered → read) flow back and are reflected in the Agent Widget.

> **Compose files**: `docker-compose.remote.yml` (app), `docker-compose.infra.yml` (infra)

---

## Step 1 — Confirm WAMID linkage exists

The status loop depends on the WAMID being linked to a tracked message via `outbound.ack.evt`.

```bash
docker logs whatsapp-state-manager 2>&1 | grep -i "outbound_ack_event" | tail -n 10
```

**If no ACK events found**, the `whatsapp-api-service` may not be publishing to `outbound.ack.evt`:
```bash
docker logs whatsapp-api 2>&1 | grep -i "Published WAMID ACK" | tail -n 10
```

---

## Step 2 — Check if Meta is sending status webhooks

```bash
docker logs whatsapp-webhook 2>&1 | grep -iE "statuses|status" | tail -n 20
```

**What to look for:**
- Log entries showing `statuses` field in incoming webhook payloads
- Status values: `sent`, `delivered`, `read`, `failed`
- If nothing, Meta might not be sending callbacks (check webhook URL configuration in Meta Developer Portal)

---

## Step 3 — Check status queue publishing

```bash
docker exec -it whatsapp-rabbitmq rabbitmqadmin get queue=inbound.whatsapp.status.evt count=3 2>/dev/null || echo "Queue empty or not found"
```

---

## Step 4 — Check state-manager status processing

```bash
docker logs whatsapp-state-manager 2>&1 | grep -i "status_update" | tail -n 20
```

**What to look for:**
- `Processing status update` — consumer is alive
- `Status updated` with `previous_status` → `new_status` — successful transition
- `Message not found for wamid` — race condition: ACK hasn't linked the WAMID yet (will retry)
- `invalid_transition_or_stale` — duplicate or out-of-order status (harmless)

---

## Step 5 — Check Agent Portal real-time event emission

```bash
docker logs whatsapp-state-manager 2>&1 | grep -i "agent.portal.evt\|publishAgentPortalEvent\|status_update" | tail -n 10
```

This confirms that the `outbound.agent.portal.evt` queue receives the status update for real-time UI.

---

## Step 6 — Verify the Agent Widget receives the update

Check if the `agent-widget` WebSocket or SSE mechanism received the event:
```bash
docker logs whatsapp-agent-widget 2>&1 | grep -iE "status|socket|event" | tail -n 10
```

Also check if the `agent-portal-service` is consuming portal events:
```bash
docker logs whatsapp-agent-portal-service 2>&1 | grep -iE "portal.evt|status" | tail -n 10
```

---

## Step 7 — Status Progression Check

Verify the correct order of status transitions in the database:

Expected progression: `queued` → `sent` → `delivered` → `read`

```bash
# Check the state-manager logs for a specific wamid (replace <WAMID>)
docker logs whatsapp-state-manager 2>&1 | grep "<WAMID>" | tail -n 20
```

**Common issues:**
- Status stuck at `sent` → Meta is sending `delivered` but webhook URL is unreachable
- Status stuck at `queued` → WAMID ACK never arrived (check whatsapp-api-service)
- `Message not found` errors → Race condition between ACK and status events (retries should handle this)

---

## Step 8 — Summary

Report:
| Check | Status | Detail |
|-------|--------|--------|
| WAMID ACK linkage | ✅/❌ | ... |
| Meta status webhooks arriving | ✅/❌ | ... |
| Status queue publishing | ✅/❌ | ... |
| State-manager processing | ✅/❌ | ... |
| Agent Portal event emission | ✅/❌ | ... |
| Widget real-time update | ✅/❌ | ... |
