---
description: Master orchestrator that sequences all debug workflows to fully diagnose an outbound message failure
---
# Orchestrate Outbound Debug

This is the **master orchestrator** workflow. It sequences the specialized debug
workflows in the correct order to fully diagnose why an outbound message from the
Agent Widget failed to reach a WhatsApp customer, or why the status update didn't
flow back.

> **Compose files**: `docker-compose.remote.yml` (app), `docker-compose.infra.yml` (infra)

---

## Phase 1 — Infrastructure Health Check

Run `/check-health` to verify all containers are running.

```bash
docker-compose -f docker-compose.infra.yml ps
docker-compose -f docker-compose.remote.yml ps
```

**If any service is down**: Run `/restart-service` for each down service before continuing.

---

## Phase 2 — Queue Flow Assessment

Run `/check-queue-health` to assess the RabbitMQ queue pipeline.

```bash
docker exec -it whatsapp-rabbitmq rabbitmqadmin list queues vhost name messages consumers
```

Evaluate:
- **If any outbound queue has messages > 0 with consumers = 0**: The consumer service crashed. Run `/restart-service` for that service.
- **If DLQ queues have messages**: Inspect the DLQ payloads to understand the failure class.
- **If all queues are healthy**: Move to Phase 3.

---

## Phase 3 — End-to-End Message Trace

Run `/trace-outbound-message` with the user-provided ID.

Ask the user for a `conversation_id`, `genesys_message_id`, or `wamid` and trace
across all 7 hops:

1. `genesys-webhook` → `outbound.genesys.msg`
2. `state-manager` (outbound identity resolution) → `outbound.processed.msg`
3. `outbound-transformer` (message transformation) → `outbound.ready.msg`
4. `whatsapp-api-service` (Meta API delivery) → `outbound.ack.evt`
5. `state-manager` (WAMID ACK linkage)
6. `whatsapp-webhook` (Meta status callback) → `inbound.whatsapp.status.evt`
7. `state-manager` (status update) → Agent Widget

**Outcome**: Identify which hop the message stopped at.

---

## Phase 4 — Targeted Hop Debug (if needed)

If Phase 3 identified a failing hop, run `/debug-outbound-hop` targeting that
specific service.

This performs:
- Container health inspection
- RabbitMQ connection verification
- Inter-service connectivity checks
- Hop-specific log analysis

---

## Phase 5 — Status Loop Verification (if message delivered but no status)

If the message was successfully delivered to WhatsApp (Hop 4 passed) but the
Agent Widget doesn't show status updates, run `/verify-status-loop`.

This checks:
- WAMID ACK linkage (`outbound.ack.evt`)
- Meta status webhook reception
- State-manager status processing
- Agent Portal real-time event emission

---

## Phase 6 — Deep Research (if root cause unclear)

If Phases 3–5 did not reveal a clear root cause, run `/deep-research-issue`.

This performs:
- Codebase search for the error pattern
- Cross-reference with `shared/constants/queues.js`
- Redis and Postgres state inspection
- Known bug pattern matching

---

## Phase 7 — Apply Fix & Verify

If a fix is identified:
1. Present the fix to the user for approval (do NOT auto-apply code changes)
2. If approved, apply the fix
3. Deploy via `/deploy-hotfix-remote`
4. Re-run `/trace-outbound-message` with the same ID to confirm resolution

---

## Phase 8 — Monitor & Learn

Run `/monitor-workflow-results` to evaluate the overall debug session:
- Was the root cause identified?
- Was the fix effective?
- Are there new error patterns that need new workflows?

If a new debug pattern was discovered, invoke `/create-workflow` to capture it
for future use.

---

## Phase 9 — Final Report

Generate a comprehensive session summary:

```markdown
## Outbound Debug Session Report

**Date**: <timestamp>
**Original Symptom**: <user-described issue>
**Message ID**: <conversation_id / genesys_message_id / wamid>

### Infrastructure Status
| Service | Status |
|---------|--------|
| ... | 🟢/🔴 |

### Queue Health
| Queue | Depth | Consumers | DLQ |
|-------|-------|-----------|-----|
| ... | ... | ... | ... |

### Message Trace
| Hop | Service | Status | Error |
|-----|---------|--------|-------|
| 1-7 | ... | ✅/❌ | ... |

### Root Cause
<technical explanation>

### Fix Applied
<description of the fix>

### Verification Result
<post-fix trace result>

### New Workflows Created
<list or "None">
```
