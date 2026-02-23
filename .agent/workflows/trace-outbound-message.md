---
description: Trace a single outbound message end-to-end across all 5 queue hops and 7 services
---
# Trace Outbound Message

This workflow traces the complete lifecycle of a single outbound message from
the Agent Widget through all queue hops to WhatsApp delivery and status callbacks.

> **Requires**: A `conversation_id`, `genesys_message_id`, or `wamid` to search for.
> **Compose files**: `docker-compose.remote.yml` (app), `docker-compose.infra.yml` (infra)

---

## Step 1 — Identify the search term

Ask the user for one of:
- `conversation_id` (Genesys conversation UUID)
- `genesys_message_id` (Genesys message UUID)
- `wamid` (WhatsApp message ID, e.g. `wamid.HBgN...`)

Store the provided value as `<ID>` for all subsequent steps.

---

## Step 2 — Hop 1: Genesys Webhook Service (entry point)

Check if the message arrived from Genesys Cloud to the webhook service:
```bash
docker logs genesys-webhook 2>&1 | grep -i "<ID>" | tail -n 20
```

**What to look for:**
- `Queued outbound message` — confirms it was published to `outbound.genesys.msg`
- `hasMedia: true/false` — note if media is involved
- Any errors about `classifyEvent`, `skip`, or `processOutboundMessage`

**If nothing found:** The message never reached genesys-webhook. Check Genesys Cloud Open Messaging integration configuration and network connectivity.

---

## Step 3 — Hop 2: State Manager (outbound identity resolution)

Check if the state-manager consumed the message and resolved the identity:
```bash
docker logs whatsapp-state-manager 2>&1 | grep -i "<ID>" | tail -n 30
```

**What to look for:**
- `Processing outbound message` with `operation: outbound_identity_resolution`
- `Outbound message processed successfully` — confirms publish to `outbound.processed.msg`
- `No active mapping found` — means no wa_id ↔ conversation_id mapping exists
- `Mapping status is EXPIRED/CLOSED` — conversation has ended
- `No phone_number_id on mapping` — missing WhatsApp phone number ID
- Any DLQ routing messages

---

## Step 4 — Hop 3: Outbound Transformer (message transformation)

Check if the transformer received and converted the message to WABA format:
```bash
docker logs whatsapp-outbound-transformer 2>&1 | grep -i "<ID>" | tail -n 20
```

**What to look for:**
- Successful consumption from `outbound.processed.msg`
- Any transformation errors (unsupported MIME, truncated caption)
- Publish to `outbound.ready.msg`
- DLQ routing if transformation failed

---

## Step 5 — Hop 4: WhatsApp API Service (Meta API delivery)

Check if the message was sent to the Meta Graph API:
```bash
docker logs whatsapp-api 2>&1 | grep -i "<ID>" | tail -n 20
```

**What to look for:**
- `Message delivered to WhatsApp` — successful Meta API call
- `Published WAMID ACK to state-manager` — WAMID correlation published to `outbound.ack.evt`
- HTTP error codes: `400` (bad payload), `403` (token expired), `404` (invalid phone number), `429` (rate limited)
- DLQ routing for permanent failures

---

## Step 6 — Hop 5: WAMID ACK Linkage (state-manager)

Check if the state-manager received the WAMID ACK and linked it to the tracked message:
```bash
docker logs whatsapp-state-manager 2>&1 | grep -i "outbound_ack_event" | tail -n 20
```

Also search by WAMID if available:
```bash
docker logs whatsapp-state-manager 2>&1 | grep -i "wam" | grep -i "<ID>" | tail -n 10
```

**What to look for:**
- `Processing outbound ACK from WhatsApp API` — confirms ACK received
- `Outbound ACK processing failed` — linkage failure (likely DB issue)

---

## Step 7 — Status Callback Path (WhatsApp → Agent Widget)

Check if WhatsApp status webhooks (sent/delivered/read) flowed back:
```bash
docker logs whatsapp-webhook 2>&1 | grep -i "status" | tail -n 20
docker logs whatsapp-state-manager 2>&1 | grep -i "status_update" | tail -n 20
```

**What to look for:**
- Status progression: `sent` → `delivered` → `read`
- `Status updated` — confirms DB was updated
- `Message not found for wamid` — WAMID ACK hasn't been processed yet (race condition)
- `Agent Portal Event` emission for real-time UI update

---

## Step 8 — Summary Report

Compile the findings into a structured table:

| Hop | Service | Queue | Status | Error |
|-----|---------|-------|--------|-------|
| 1 | genesys-webhook | outbound.genesys.msg | ✅/❌ | ... |
| 2 | state-manager | outbound.processed.msg | ✅/❌ | ... |
| 3 | outbound-transformer | outbound.ready.msg | ✅/❌ | ... |
| 4 | whatsapp-api | Meta API | ✅/❌ | ... |
| 5 | state-manager (ACK) | outbound.ack.evt | ✅/❌ | ... |
| 6 | whatsapp-webhook | inbound.whatsapp.status.evt | ✅/❌ | ... |
| 7 | state-manager (status) | agent portal event | ✅/❌ | ... |

If a hop failed, recommend running `/debug-outbound-hop` targeting that specific service.
