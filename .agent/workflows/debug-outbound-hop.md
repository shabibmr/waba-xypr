---
description: Deep-dive debug a specific hop in the outbound message flow
---
# Debug Outbound Hop

This workflow performs a targeted deep-dive into one specific service/hop in
the outbound message chain. Run this after `/trace-outbound-message` or
`/check-queue-health` has identified the failing hop.

> **Compose files**: `docker-compose.remote.yml` (app), `docker-compose.infra.yml` (infra)

---

## Step 1 — Identify the failing hop

Ask the user which hop failed, or infer from previous workflow output:

| Hop | Service | Container Name |
|-----|---------|---------------|
| 1 | genesys-webhook-service | `genesys-webhook` |
| 2 | state-manager | `whatsapp-state-manager` |
| 3 | outbound-transformer | `whatsapp-outbound-transformer` |
| 4 | whatsapp-api-service | `whatsapp-api` |
| 5 | whatsapp-webhook-service | `whatsapp-webhook` |

---

## Step 2 — Check container health

```bash
docker inspect --format='{{.State.Status}} {{.State.ExitCode}} {{.RestartCount}}' <container_name>
```

If exited or restarting, check the last crash logs:
```bash
docker logs --tail 100 <container_name> 2>&1 | grep -iE "error|exception|fatal|crash|ECONNREFUSED"
```

---

## Step 3 — Hop-specific deep inspection

### Hop 1: genesys-webhook (port 3011)
```bash
# Check if webhook is receiving Genesys events at all
docker logs --tail 200 genesys-webhook 2>&1 | grep -iE "processWebhookEvent|classifyEvent|skip"
# Verify the service can reach state-manager
docker exec -it genesys-webhook wget -qO- http://state-manager:3005/health 2>&1 || echo "Cannot reach state-manager"
```

### Hop 2: state-manager (port 3005)
```bash
# Check outbound identity resolution
docker logs --tail 200 whatsapp-state-manager 2>&1 | grep -i "outbound_identity_resolution"
# Check for mapping failures
docker logs --tail 200 whatsapp-state-manager 2>&1 | grep -iE "MAPPING_NOT_FOUND|MAPPING_STATUS|MISSING_PHONE"
# Inspect Redis for cached mapping
docker exec -it whatsapp-redis redis-cli KEYS "*conversation*" | head -n 10
# Check Postgres connectivity
docker exec -it whatsapp-state-manager wget -qO- http://localhost:3005/health 2>&1
```

### Hop 3: outbound-transformer (port 3003)
```bash
# Check transformation processing
docker logs --tail 200 whatsapp-outbound-transformer 2>&1 | grep -iE "transform|dispatch|validation"
# Check for DLQ routing
docker logs --tail 100 whatsapp-outbound-transformer 2>&1 | grep -i "dlq"
# Verify RabbitMQ connection
docker logs --tail 50 whatsapp-outbound-transformer 2>&1 | grep -iE "rabbit|amqp|consumer"
```

### Hop 4: whatsapp-api-service (port 3008)
```bash
# Check Meta API calls
docker logs --tail 200 whatsapp-api 2>&1 | grep -iE "delivered|failed|error|wamid|token"
# Check for expired Meta access tokens
docker logs --tail 100 whatsapp-api 2>&1 | grep -iE "401|403|OAuthException|token"
# Check WAMID ACK publishing
docker logs --tail 100 whatsapp-api 2>&1 | grep -i "outbound.ack"
```

### Hop 5: whatsapp-webhook (port 3009) — Status path
```bash
# Check incoming status webhooks from Meta
docker logs --tail 200 whatsapp-webhook 2>&1 | grep -iE "status|delivered|read|sent"
# Check RabbitMQ publishing of status events
docker logs --tail 100 whatsapp-webhook 2>&1 | grep -i "inbound.whatsapp.status"
```

---

## Step 4 — Check inter-service connectivity

If a service cannot reach its dependencies, test the internal Docker network:
```bash
# From the failing container, test downstream services
docker exec -it <container_name> sh -c "wget -qO- http://tenant-service:3007/health 2>&1 || echo FAIL"
docker exec -it <container_name> sh -c "wget -qO- http://state-manager:3005/health 2>&1 || echo FAIL"
docker exec -it <container_name> sh -c "wget -qO- http://auth-service:3004/health 2>&1 || echo FAIL"
```

---

## Step 5 — Report findings

Produce a structured diagnostic for the specific hop:
- **Container Status**: Running / Restarting / Exited
- **RabbitMQ Connection**: Connected / Disconnected
- **Downstream Services**: Reachable / Unreachable
- **Root Cause**: (identified error or symptom)
- **Recommended Fix**: (restart, config change, code fix, etc.)

If the root cause requires code analysis, recommend running `/deep-research-issue`.
