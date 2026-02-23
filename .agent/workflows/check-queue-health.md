---
description: Check all outbound RabbitMQ queue depths and DLQs for bottlenecks or stuck messages
---
# Check Queue Health

This workflow inspects all RabbitMQ queues involved in the outbound message flow
to detect bottlenecks, stuck messages, or growing DLQs.

> **Compose files**: `docker-compose.remote.yml` (app), `docker-compose.infra.yml` (infra)

---

## Step 1 — Verify RabbitMQ is running

```bash
docker-compose -f docker-compose.infra.yml ps rabbitmq
```

If it's not running, start it:
```bash
docker-compose -f docker-compose.infra.yml up -d rabbitmq
```

---

## Step 2 — List all queues with message counts

```bash
docker exec -it whatsapp-rabbitmq rabbitmqadmin list queues vhost name messages consumers
```

---

## Step 3 — Identify the 5 outbound flow queues

Focus specifically on these queues and their message counts:

| Queue | Expected Depth | If High |
|-------|---------------|---------|
| `outbound.genesys.msg` | 0 | state-manager is not consuming |
| `outbound.processed.msg` | 0 | outbound-transformer is not consuming |
| `outbound.ready.msg` | 0 | whatsapp-api-service is not consuming |
| `outbound.ack.evt` | 0 | state-manager ACK consumer is stuck |
| `inbound.whatsapp.status.evt` | 0 | state-manager status consumer is stuck |

---

## Step 4 — Check DLQ queues for failures

```bash
docker exec -it whatsapp-rabbitmq rabbitmqadmin list queues name messages | grep -i dlq
```

The 3 critical DLQs:
- `outbound.transformer.dlq` — failed message transformations
- `outbound.whatsapp.api.dlq` — Meta API delivery failures
- `inbound.state.manager.dlq` — state resolution failures

If any DLQ has messages > 0, inspect the top messages:
```bash
docker exec -it whatsapp-rabbitmq rabbitmqadmin get queue=<DLQ_QUEUE_NAME> count=3
```

---

## Step 5 — Check consumer counts

If a queue has `consumers = 0`, the corresponding service has crashed or disconnected:
- `outbound.genesys.msg` → check `whatsapp-state-manager` container
- `outbound.processed.msg` → check `whatsapp-outbound-transformer` container
- `outbound.ready.msg` → check `whatsapp-api` container

```bash
docker-compose -f docker-compose.remote.yml ps state-manager outbound-transformer whatsapp-api-service
```

---

## Step 6 — Summary

Report a table with color-coded status:
- 🟢 Queue depth 0, consumers > 0
- 🟡 Queue depth 1-5, consumers > 0 (processing lag)
- 🔴 Queue depth > 5 or consumers = 0 (stuck/crashed)
- ⚠️ DLQ depth > 0 (failures accumulating)

If any queue is 🔴, recommend running `/restart-service` for the stuck consumer,
then `/trace-outbound-message` to verify recovery.
