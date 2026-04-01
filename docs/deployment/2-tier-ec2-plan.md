# 2-Tier EC2 Deployment Plan (2× t2.small)

## Overview

Deploy 14 microservices + 3 infrastructure components across 2 t2.small EC2 instances (2GB RAM each).

---

## Server 1 — "Data Tier"

**Role:** Infrastructure services + data-heavy microservices
**Estimated RAM:** ~1.7GB

| Component              | Port  | Est. RAM | Co-location Rationale                          |
|------------------------|-------|----------|-------------------------------------------------|
| PostgreSQL             | 5432  | ~300MB   | Core database                                   |
| Redis                  | 6379  | ~100MB   | Token cache, conversation cache, dedup           |
| RabbitMQ               | 5672  | ~300MB   | Central message bus                              |
| state-manager          | 3005  | ~100MB   | Heaviest DB/Redis consumer — needs low latency   |
| auth-service           | 3004  | ~80MB    | Constant Redis access for token cache            |
| tenant-service         | 3007  | ~80MB    | Frequent DB reads from all other services        |

**Total: 6 components, ~960MB base + overhead ≈ 1.7GB**

### Networking

- Open ports to Server 2: `5432`, `6379`, `5672`, `15672`, `3004`, `3005`, `3007`
- Security group: allow inbound from Server 2 private IP only (for infra ports)
- RabbitMQ management UI (15672): restrict to your IP for debugging

---

## Server 2 — "App Tier"

**Role:** API gateway, pipeline services, UI frontends
**Estimated RAM:** ~1.6GB

| Component                  | Port  | Est. RAM | Notes                              |
|----------------------------|-------|----------|------------------------------------|
| api-gateway                | 3000  | ~100MB   | Entry point, public-facing         |
| whatsapp-webhook-service   | 3009  | ~80MB    | Ingress from Meta webhooks         |
| genesys-webhook-service    | 3011  | ~80MB    | Ingress from Genesys webhooks      |
| inbound-transformer        | 3002  | ~80MB    | Stateless transformer              |
| outbound-transformer       | 3003  | ~80MB    | Stateless transformer              |
| genesys-api-service        | 3010  | ~80MB    | Outbound to Genesys Cloud API      |
| whatsapp-api-service       | 3008  | ~80MB    | Outbound to Meta Graph API         |
| agent-portal (UI)          | 3014  | ~60MB    | Static React via Nginx             |
| agent-portal-service       | 3015  | ~100MB   | Portal backend API                 |
| agent-widget (UI)          | 3012  | ~50MB    | Static React via Nginx             |
| admin-dashboard (UI)       | 3006  | ~50MB    | Static React via Nginx             |

**Total: 11 components, ~840MB base + overhead ≈ 1.6GB**

### Networking

- Public-facing ports: `3000` (API gateway), `3014` (agent portal)
- Webhook ingress: `3009` (Meta), `3011` (Genesys) — routed through api-gateway
- All services connect to Server 1 for DB/Redis/RabbitMQ via private IP

---

## Environment Variables

### Server 1 services

```env
# state-manager, auth-service, tenant-service
DB_HOST=localhost
REDIS_HOST=localhost
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

### Server 2 services

```env
# All services on Server 2
DB_HOST=<server1-private-ip>
REDIS_HOST=<server1-private-ip>
RABBITMQ_URL=amqp://guest:guest@<server1-private-ip>:5672

# Internal service URLs (Server 1)
AUTH_SERVICE_URL=http://<server1-private-ip>:3004
STATE_MANAGER_URL=http://<server1-private-ip>:3005
TENANT_SERVICE_URL=http://<server1-private-ip>:3007

# Internal service URLs (Server 2 — localhost)
INBOUND_TRANSFORMER_URL=http://localhost:3002
OUTBOUND_TRANSFORMER_URL=http://localhost:3003
GENESYS_API_SERVICE_URL=http://localhost:3010
WHATSAPP_API_SERVICE_URL=http://localhost:3008
```

---

## Critical Setup Steps

### 1. Add swap on both instances (prevents OOM)

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2. Limit Node.js heap per service

Add to each service in docker-compose:

```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=128
```

### 3. Set Docker memory limits

```yaml
# Server 1 — docker-compose.server1.yml
services:
  postgres:
    mem_limit: 384m
  redis:
    mem_limit: 128m
  rabbitmq:
    mem_limit: 384m
  state-manager:
    mem_limit: 150m
  auth-service:
    mem_limit: 128m
  tenant-service:
    mem_limit: 128m

# Server 2 — docker-compose.server2.yml
services:
  api-gateway:
    mem_limit: 128m
  whatsapp-webhook-service:
    mem_limit: 100m
  genesys-webhook-service:
    mem_limit: 100m
  inbound-transformer:
    mem_limit: 100m
  outbound-transformer:
    mem_limit: 100m
  genesys-api-service:
    mem_limit: 100m
  whatsapp-api-service:
    mem_limit: 100m
  agent-portal:
    mem_limit: 80m
  agent-portal-service:
    mem_limit: 128m
  agent-widget:
    mem_limit: 64m
  admin-dashboard:
    mem_limit: 64m
```

### 4. Drop MinIO — use S3 directly

Replace MinIO with AWS S3 for media storage in production. Saves ~200MB RAM.

```env
# genesys-webhook-service
STORAGE_PROVIDER=s3
AWS_S3_BUCKET=waba-media-outbound
AWS_REGION=<your-region>
# Use EC2 instance role — no access keys needed
```

### 5. PostgreSQL tuning for 384MB limit

```sql
-- /etc/postgresql/postgresql.conf overrides
shared_buffers = 96MB
effective_cache_size = 192MB
work_mem = 4MB
maintenance_work_mem = 48MB
max_connections = 50
```

### 6. Redis tuning for 128MB limit

```conf
maxmemory 100mb
maxmemory-policy allkeys-lru
```

### 7. RabbitMQ tuning for 384MB limit

```conf
vm_memory_high_watermark.absolute = 256MiB
disk_free_limit.absolute = 256MiB
```

---

## Security Groups

### Server 1 (Data Tier)

| Port  | Source                 | Purpose               |
|-------|------------------------|-----------------------|
| 22    | Your IP                | SSH                   |
| 5432  | Server 2 private IP    | PostgreSQL            |
| 6379  | Server 2 private IP    | Redis                 |
| 5672  | Server 2 private IP    | RabbitMQ              |
| 15672 | Your IP                | RabbitMQ Management   |
| 3004  | Server 2 private IP    | auth-service API      |
| 3005  | Server 2 private IP    | state-manager API     |
| 3007  | Server 2 private IP    | tenant-service API    |

### Server 2 (App Tier)

| Port  | Source     | Purpose                          |
|-------|------------|----------------------------------|
| 22    | Your IP    | SSH                              |
| 80    | 0.0.0.0/0  | HTTP (redirect to HTTPS)         |
| 443   | 0.0.0.0/0  | HTTPS (api-gateway + portals)    |
| 3000  | 0.0.0.0/0  | API Gateway (or behind ALB)      |
| 3009  | Meta IPs   | WhatsApp webhook ingress         |
| 3011  | Genesys IPs| Genesys webhook ingress          |

---

## Deployment Order

### Server 1 (start first)

```bash
# 1. Infrastructure
docker compose -f docker-compose.server1.yml up -d postgres redis rabbitmq

# 2. Wait for healthy
docker compose -f docker-compose.server1.yml exec postgres pg_isready
docker compose -f docker-compose.server1.yml exec redis redis-cli ping

# 3. Core services
docker compose -f docker-compose.server1.yml up -d tenant-service auth-service state-manager
```

### Server 2 (start after Server 1 is healthy)

```bash
# 1. Verify connectivity to Server 1
curl http://<server1-private-ip>:3004/api/v1/health
curl http://<server1-private-ip>:3007/health

# 2. Start all app services
docker compose -f docker-compose.server2.yml up -d
```

---

## Monitoring

### Memory watchdog (cron on both servers)

```bash
# /etc/cron.d/memory-watchdog — alert if free memory < 100MB
*/5 * * * * root free -m | awk '/Mem:/ {if($7<100) system("logger -p user.crit LOW_MEMORY: " $7 "MB free")}'
```

### Health checks

```bash
# Quick health check script
curl -sf http://localhost:3000/health   # api-gateway
curl -sf http://localhost:3004/api/v1/health  # auth-service
curl -sf http://localhost:3005/health   # state-manager
curl -sf http://localhost:3007/health   # tenant-service
```

