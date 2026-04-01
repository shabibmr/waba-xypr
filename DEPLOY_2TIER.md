# 2-Tier Deployment Guide (Development)

Quick guide for deploying to your 2-tier architecture.

## Architecture

```
┌─────────────────────────────────┐
│  App Server: 65.2.112.193       │
│  ┌───────────────────────────┐  │
│  │  Application Services     │  │
│  │  - API Gateway            │  │
│  │  - WhatsApp Services      │  │
│  │  - Genesys Services       │  │
│  │  - Transformers           │  │
│  │  - Agent Portal           │  │
│  │  - State Manager          │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
                │
                │ Network Connection
                ▼
┌─────────────────────────────────┐
│  Infra Server: 15.207.0.150     │
│  ┌───────────────────────────┐  │
│  │  Infrastructure           │  │
│  │  - PostgreSQL (5432)      │  │
│  │  - Redis (6379)           │  │
│  │  - RabbitMQ (5672)        │  │
│  │  - MinIO (9000)           │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

## Prerequisites

✅ Infra server (15.207.0.150) running with:
- PostgreSQL
- Redis
- RabbitMQ
- MinIO

✅ App server (65.2.112.193) with:
- Docker installed
- SSH access

## Deployment Steps

### 1. Prepare Configuration (Local Machine)

```bash
# In your local waba-xypr directory
cd ~/code/WABA/v1/waba-xypr

# Copy development template
cp .env.2tier-dev .env

# Edit with your credentials
nano .env
```

**Required updates:**
- `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN` (from Meta Business)
- `GENESYS_CLIENT_ID`, `GENESYS_CLIENT_SECRET` (from Genesys Cloud)

### 2. Push Code to Server

```bash
# From local machine
rsync -avz --exclude 'node_modules' \
  --exclude '.git' \
  -e "ssh -i xypr-dev-ssh.pem" \
  . ubuntu@65.2.112.193:~/waba-xypr/
```

### 3. Deploy on Server

```bash
# SSH to app server
ssh -i xypr-dev-ssh.pem ubuntu@65.2.112.193

# Navigate to app directory
cd ~/waba-xypr

# Deploy
docker compose -f docker-compose.2tier.yml up -d --build
```

### 4. Verify Deployment

```bash
# Check all services are running
docker compose -f docker-compose.2tier.yml ps

# Check logs
docker compose -f docker-compose.2tier.yml logs -f

# Test API Gateway
curl http://65.2.112.193:3000/health
```

## Access Services

| Service | URL | Purpose |
|---------|-----|---------|
| API Gateway | http://65.2.112.193:3000 | Main API entry |
| Agent Portal | http://65.2.112.193:3014 | Customer Portal UI |
| Admin Dashboard | http://65.2.112.193:3006 | Admin UI |
| WhatsApp Webhook | http://65.2.112.193:3009/webhook | For Meta |
| Genesys Webhook | http://65.2.112.193:3011/webhook | For Genesys |

## Common Commands

```bash
# View all logs
docker compose -f docker-compose.2tier.yml logs -f

# View specific service
docker compose -f docker-compose.2tier.yml logs -f tenant-service

# Restart all services
docker compose -f docker-compose.2tier.yml restart

# Restart specific service
docker compose -f docker-compose.2tier.yml restart auth-service

# Stop all
docker compose -f docker-compose.2tier.yml down

# Rebuild and restart
docker compose -f docker-compose.2tier.yml up -d --build

# Check status
docker compose -f docker-compose.2tier.yml ps
```

## Quick Deploy Script

```bash
#!/bin/bash
# deploy.sh - Run on app server

cd ~/waba-xypr
git pull origin m1  # if using git
docker compose -f docker-compose.2tier.yml up -d --build
docker compose -f docker-compose.2tier.yml ps
```

## Troubleshooting

### Can't connect to infra server

```bash
# Test from app server
ping 15.207.0.150

# Test PostgreSQL
telnet 15.207.0.150 5432

# Test Redis
telnet 15.207.0.150 6379

# Test RabbitMQ
telnet 15.207.0.150 5672
```

### Service won't start

```bash
# Check logs
docker logs whatsapp-tenant-service

# Check if port is in use
sudo netstat -tulpn | grep :3007

# Restart specific service
docker compose -f docker-compose.2tier.yml restart tenant-service
```

### Update code without rebuilding

```bash
# For code changes that don't need rebuild
docker compose -f docker-compose.2tier.yml restart [service-name]

# For changes that need rebuild
docker compose -f docker-compose.2tier.yml up -d --build [service-name]
```

## Network Security

Ensure AWS Security Groups allow:

**App Server → Infra Server:**
- PostgreSQL: 5432
- Redis: 6379
- RabbitMQ: 5672
- MinIO: 9000

**Internet → App Server:**
- HTTP: 80
- API Gateway: 3000
- WhatsApp Webhook: 3009
- Genesys Webhook: 3011
- Agent Portal: 3014

## Next Steps

1. ✅ Deploy app services
2. ⬜ Configure Meta webhook URL
3. ⬜ Configure Genesys webhook URL
4. ⬜ Test end-to-end message flow
5. ⬜ Monitor logs and health
