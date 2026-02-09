# MVP Management Scripts

Quick reference guide for managing the WhatsApp-Genesys Integration MVP services.

## 📋 Available Scripts

### 🚀 start-mvp.sh
Starts all 11 MVP services in the correct order.

```bash
./start-mvp.sh
```

**What it does:**
- Checks infrastructure services are running
- Starts core services (State Manager, Tenant Service, Auth Service)
- Starts message flow services (WhatsApp, Genesys, Transformers)
- Starts Customer Portal (frontend + backend)
- Verifies health of all services
- Shows service URLs and management commands

**Requirements:**
- Docker infrastructure must be running first
- All services must have their dependencies installed (`npm install`)

---

### 🛑 stop-mvp.sh
Stops all running MVP services.

```bash
./stop-mvp.sh
```

**What it does:**
- Kills all processes on ports 3002-3015
- Leaves infrastructure services running (PostgreSQL, Redis, etc.)

**Note:** Infrastructure services remain running. To stop them:
```bash
docker compose -f docker-compose.infra.yml down
```

---

### 🔄 restart-mvp.sh
Stops and restarts all MVP services.

```bash
./restart-mvp.sh
```

**What it does:**
- Calls `stop-mvp.sh` to stop all services
- Waits 3 seconds
- Calls `start-mvp.sh` to restart all services

**Use when:**
- Services are misbehaving
- After updating .env files
- After code changes (with nodemon disabled)

---

### 📊 status-mvp.sh
Shows detailed status of all services.

```bash
./status-mvp.sh
```

**What it shows:**
- Infrastructure services status (PostgreSQL, Redis, RabbitMQ, MinIO)
- Each application service status with health check
- Process IDs and commands
- Running count (X/11 services)
- Quick links to UIs
- Log file locations

**Example output:**
```
State Manager (3005):      ✓ Healthy
  PID: 12345 | node src/index.js
```

---

### 📝 logs-mvp.sh
View logs for specific services or all services.

```bash
# View logs for a specific service
./logs-mvp.sh auth-service
./logs-mvp.sh whatsapp-webhook

# View all logs interleaved
./logs-mvp.sh all

# Show help
./logs-mvp.sh --help
```

**Available services:**
- `state-manager`
- `tenant-service`
- `auth-service`
- `whatsapp-webhook`
- `inbound-transformer`
- `genesys-api`
- `genesys-webhook`
- `outbound-transformer`
- `whatsapp-api`
- `agent-portal-service`
- `agent-portal`
- `all` (all logs combined)

**Log files location:** `/tmp/*.log`

---

## 🎯 Common Workflows

### First Time Setup

```bash
# 1. Start infrastructure
docker compose -f docker-compose.infra.yml up -d

# 2. Wait for infrastructure to be ready (30 seconds)
sleep 30

# 3. Start all MVP services
./start-mvp.sh

# 4. Check status
./status-mvp.sh
```

### Daily Development

```bash
# Start services
./start-mvp.sh

# View logs while developing
./logs-mvp.sh all

# Check what's running
./status-mvp.sh

# Restart after changes
./restart-mvp.sh

# Stop when done
./stop-mvp.sh
```

### Debugging Issues

```bash
# 1. Check overall status
./status-mvp.sh

# 2. View logs for failing service
./logs-mvp.sh [service-name]

# 3. Restart that service manually
cd services/[service-name]
npm run dev

# Or restart all
./restart-mvp.sh
```

### Clean Restart

```bash
# Stop everything
./stop-mvp.sh
docker compose -f docker-compose.infra.yml down

# Clear logs (optional)
rm /tmp/*.log

# Start fresh
docker compose -f docker-compose.infra.yml up -d
sleep 30
./start-mvp.sh
```

---

## 📊 Service Ports Reference

| Service | Port | Type |
|---------|------|------|
| Inbound Transformer | 3002 | Message Flow |
| Outbound Transformer | 3003 | Message Flow |
| Auth Service | 3004 | Core |
| State Manager | 3005 | Core |
| Tenant Service | 3007 | Core |
| WhatsApp API | 3008 | Message Flow |
| WhatsApp Webhook | 3009 | Message Flow |
| Genesys API | 3010 | Message Flow |
| Genesys Webhook | 3011 | Message Flow |
| Customer Portal (UI) | 3014 | Frontend |
| Customer Portal (API) | 3015 | Backend |

---

## 🏗️ Infrastructure Services

| Service | Port | UI/Access |
|---------|------|-----------|
| PostgreSQL | 5432 | `psql -U postgres -d waba_mvp` |
| Redis | 6379 | `redis-cli` |
| RabbitMQ | 5672, 15672 | http://localhost:15672 (admin/admin123) |
| MinIO | 9000, 9001 | http://localhost:9001 (admin/admin123) |

**Start infrastructure:**
```bash
docker compose -f docker-compose.infra.yml up -d
```

**Stop infrastructure:**
```bash
docker compose -f docker-compose.infra.yml down
```

**Stop and remove volumes:**
```bash
docker compose -f docker-compose.infra.yml down -v
```

---

## 🐛 Troubleshooting

### "Port already in use" error

```bash
# Kill specific port
lsof -ti:[PORT] | xargs kill -9

# Or kill all node processes
killall node

# Then restart
./start-mvp.sh
```

### Service won't start

```bash
# Check logs
./logs-mvp.sh [service-name]

# Common issues:
# 1. Missing dependencies
cd services/[service-name]
npm install

# 2. Missing .env file
cp .env.example .env
# Edit .env with correct values

# 3. Infrastructure not running
docker compose -f docker-compose.infra.yml up -d
```

### All services show "Not running"

```bash
# Check if infrastructure is up
docker ps

# If not, start it
docker compose -f docker-compose.infra.yml up -d
sleep 30

# Then start services
./start-mvp.sh
```

### Health check fails but service is running

```bash
# Service might still be starting
# Wait 10 seconds and check again
sleep 10
./status-mvp.sh

# Or check logs for errors
./logs-mvp.sh [service-name]
```

---

## 💡 Tips

1. **Always check status first**
   ```bash
   ./status-mvp.sh
   ```

2. **View logs in separate terminal**
   ```bash
   # Terminal 1: Run services
   ./start-mvp.sh

   # Terminal 2: Watch logs
   ./logs-mvp.sh all
   ```

3. **Quick health check**
   ```bash
   for port in 3002 3003 3004 3005 3007 3008 3009 3010 3011 3014 3015; do
     curl -s http://localhost:$port/health && echo " - Port $port OK"
   done
   ```

4. **Monitor resource usage**
   ```bash
   # CPU and Memory usage
   ps aux | grep -E "node|npm" | grep -v grep
   ```

5. **Clear old logs**
   ```bash
   rm /tmp/*.log
   ```

---

## 🔗 Quick Links

After starting all services:

- **Customer Portal**: http://localhost:3014
- **Portal Backend API**: http://localhost:3015/health
- **Auth Service**: http://localhost:3004/health
- **State Manager**: http://localhost:3005/health
- **Tenant Service**: http://localhost:3007/health
- **RabbitMQ Management**: http://localhost:15672
- **MinIO Console**: http://localhost:9001

---

## 📚 Related Documentation

- `READY_TO_START.md` - Complete setup guide
- `CREDENTIALS_UPDATED.md` - All credentials and configuration
- `MVP_DEPLOYMENT_STATUS.md` - Overall deployment status
- `TASK_12_CUSTOMER_PORTAL.md` - Customer Portal details

---

**Questions or Issues?**
Check the logs first: `./logs-mvp.sh [service-name]`
