# MVP Ready to Start - Complete Guide

**Date**: 2026-02-05
**Status**: 🚀 Ready for Full System Startup

---

## ✅ What's Been Completed

### Infrastructure (Task 00)
- ✅ PostgreSQL running with `waba_mvp` database
- ✅ Redis running on port 6379
- ✅ RabbitMQ running on ports 5672, 15672 (admin:admin123)
- ✅ MinIO running on ports 9000, 9001 with 4 buckets
- ✅ Database migrations executed (4 tables created)
- ✅ Demo tenant seeded

### Real Credentials Configured
- ✅ **Genesys Cloud** credentials updated in 4 services + database
- ✅ **WhatsApp Business API** credentials updated in 2 services + database
- ✅ **Infrastructure** credentials (RabbitMQ, PostgreSQL, Redis, MinIO)

### Services Configured (11 of 12)
1. ✅ State Manager (3005) - .env configured
2. ✅ Tenant Service (3007) - .env configured
3. ✅ Auth Service (3004) - .env configured, **currently running**
4. ✅ WhatsApp Webhook (3009) - .env configured with real credentials
5. ✅ Inbound Transformer (3002) - .env configured
6. ✅ Genesys API (3010) - .env configured with real credentials
7. ✅ Genesys Webhook (3011) - .env configured with real credentials
8. ✅ Outbound Transformer (3003) - .env configured
9. ✅ WhatsApp API (3008) - .env configured with real credentials
10. ✅ Customer Portal Frontend (3014) - .env configured
11. ✅ Customer Portal Backend (3015) - .env configured with real credentials

### Code Fixes Applied
- ✅ State Manager import paths fixed
- ✅ Auth Service dotenv added
- ✅ RabbitMQ credentials updated to admin:admin123
- ✅ Service URLs changed from Docker names to localhost

---

## 🚀 Quick Start All Services

### Option 1: Using Bash Script (Create This)

Create `start-all-services.sh`:

```bash
#!/bin/bash
cd /Users/admin/code/WABA/v1/waba-xypr

echo "Starting all MVP services..."

# Core Services
cd services/state-manager && npm run dev > /tmp/state-manager.log 2>&1 &
cd ../tenant-service && npm run dev > /tmp/tenant-service.log 2>&1 &
cd ../auth-service && npm run dev > /tmp/auth-service.log 2>&1 &

# Message Flow Services
cd ../whatsapp-webhook-service && npm run dev > /tmp/whatsapp-webhook.log 2>&1 &
cd ../inbound-transformer && npm run dev > /tmp/inbound-transformer.log 2>&1 &
cd ../genesys-api-service && npm run dev > /tmp/genesys-api.log 2>&1 &
cd ../genesys-webhook-service && npm run dev > /tmp/genesys-webhook.log 2>&1 &
cd ../outbound-transformer && npm run dev > /tmp/outbound-transformer.log 2>&1 &
cd ../whatsapp-api-service && npm run dev > /tmp/whatsapp-api.log 2>&1 &

# Customer Portal
cd ../agent-portal-service && npm run dev > /tmp/agent-portal-service.log 2>&1 &
cd ../agent-portal && npm run dev > /tmp/agent-portal.log 2>&1 &

echo "All services started! Waiting 5 seconds for startup..."
sleep 5

echo ""
echo "Service Status:"
for port in 3002 3003 3004 3005 3007 3008 3009 3010 3011 3014 3015; do
  if lsof -ti:$port > /dev/null 2>&1; then
    echo "  ✅ Port $port: Running"
  else
    echo "  ❌ Port $port: Not running"
  fi
done
```

Then run:
```bash
chmod +x start-all-services.sh
./start-all-services.sh
```

### Option 2: Manual Startup (One by One)

```bash
cd /Users/admin/code/WABA/v1/waba-xypr

# Terminal 1: State Manager
cd services/state-manager && npm run dev

# Terminal 2: Tenant Service
cd services/tenant-service && npm run dev

# Terminal 3: Auth Service
cd services/auth-service && npm run dev

# Terminal 4: WhatsApp Webhook
cd services/whatsapp-webhook-service && npm run dev

# Terminal 5: Inbound Transformer
cd services/inbound-transformer && npm run dev

# Terminal 6: Genesys API
cd services/genesys-api-service && npm run dev

# Terminal 7: Genesys Webhook
cd services/genesys-webhook-service && npm run dev

# Terminal 8: Outbound Transformer
cd services/outbound-transformer && npm run dev

# Terminal 9: WhatsApp API
cd services/whatsapp-api-service && npm run dev

# Terminal 10: Customer Portal Backend
cd services/agent-portal-service && npm run dev

# Terminal 11: Customer Portal Frontend
cd services/agent-portal && npm run dev
```

### Option 3: Background Processes

```bash
cd /Users/admin/code/WABA/v1/waba-xypr

# Start all services in background
cd services/state-manager && npm run dev > /tmp/state-manager.log 2>&1 &
cd ../tenant-service && npm run dev > /tmp/tenant-service.log 2>&1 &
cd ../auth-service && npm run dev > /tmp/auth-service.log 2>&1 &
cd ../whatsapp-webhook-service && npm run dev > /tmp/whatsapp-webhook.log 2>&1 &
cd ../inbound-transformer && npm run dev > /tmp/inbound-transformer.log 2>&1 &
cd ../genesys-api-service && npm run dev > /tmp/genesys-api.log 2>&1 &
cd ../genesys-webhook-service && npm run dev > /tmp/genesys-webhook.log 2>&1 &
cd ../outbound-transformer && npm run dev > /tmp/outbound-transformer.log 2>&1 &
cd ../whatsapp-api-service && npm run dev > /tmp/whatsapp-api.log 2>&1 &
cd ../agent-portal-service && npm run dev > /tmp/agent-portal-service.log 2>&1 &
cd ../agent-portal && npm run dev > /tmp/agent-portal.log 2>&1 &

# Wait for startup
sleep 5

# Check status
for port in 3002 3003 3004 3005 3007 3008 3009 3010 3011 3014 3015; do
  curl -s http://localhost:$port/health 2>/dev/null && echo "✅ Port $port healthy" || echo "⚠️ Port $port check failed"
done
```

---

## 📊 Verify All Services Running

### Quick Health Check Script

```bash
#!/bin/bash
echo "Checking all MVP services..."

check_service() {
  local port=$1
  local name=$2
  if lsof -ti:$port > /dev/null 2>&1; then
    echo "✅ $name (port $port): Running"
  else
    echo "❌ $name (port $port): NOT RUNNING"
  fi
}

check_service 3005 "State Manager"
check_service 3007 "Tenant Service"
check_service 3004 "Auth Service"
check_service 3009 "WhatsApp Webhook"
check_service 3002 "Inbound Transformer"
check_service 3010 "Genesys API"
check_service 3011 "Genesys Webhook"
check_service 3003 "Outbound Transformer"
check_service 3008 "WhatsApp API"
check_service 3015 "Customer Portal Backend"
check_service 3014 "Customer Portal Frontend"
```

### Check Health Endpoints

```bash
echo "Testing health endpoints..."

curl -s http://localhost:3004/health | jq .
curl -s http://localhost:3005/health | jq .
curl -s http://localhost:3007/health | jq .
curl -s http://localhost:3009/health | jq .
curl -s http://localhost:3011/health | jq .
curl -s http://localhost:3015/health | jq .
```

### View All Logs

```bash
# Follow all logs
tail -f /tmp/*.log

# Or specific service
tail -f /tmp/auth-service.log
tail -f /tmp/whatsapp-webhook.log
tail -f /tmp/genesys-api.log
```

---

## 🧪 Test the System

### 1. Test Genesys Token Generation

```bash
curl -X POST http://localhost:3004/auth/genesys/token \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "00000000-0000-0000-0000-000000000001"
  }'
```

**Expected**: OAuth token from Genesys Cloud

### 2. Test WhatsApp Token Retrieval

```bash
curl -X GET "http://localhost:3004/auth/whatsapp/token?tenantId=00000000-0000-0000-0000-000000000001"
```

**Expected**: WhatsApp access token from database

### 3. Test State Manager Mapping

```bash
# Create a mapping
curl -X POST http://localhost:3005/api/mapping \
  -H "Content-Type: application/json" \
  -d '{
    "waId": "+919876543210",
    "conversationId": "test-conv-123",
    "tenantId": "00000000-0000-0000-0000-000000000001"
  }'

# Retrieve mapping
curl -X GET "http://localhost:3005/api/mapping/+919876543210"
```

### 4. Access Customer Portal

Open in browser: http://localhost:3014

**Expected**: Customer Portal login page

### 5. Test Tenant Service

```bash
curl -X GET "http://localhost:3007/api/tenants/00000000-0000-0000-0000-000000000001"
```

**Expected**: Demo tenant details

---

## 📝 Next Steps After All Services Running

### 1. Configure Webhooks

#### Meta WhatsApp Webhook
1. Use ngrok: `ngrok http 3009`
2. Get public URL: `https://abc123.ngrok.io`
3. Configure in Meta Developer Console:
   - URL: `https://abc123.ngrok.io/webhook/whatsapp`
   - Verify Token: `whatsapp_webhook_verify_token_2024`

#### Genesys Webhooks
1. Use ngrok: `ngrok http 3011`
2. Get public URL: `https://xyz789.ngrok.io`
3. Configure in Genesys Cloud Admin:
   - Outbound Notification Webhook URL: `https://xyz789.ngrok.io/webhook/genesys`

### 2. Test End-to-End Message Flow

#### WhatsApp → Genesys
1. Send WhatsApp message to: `+[PHONE_NUMBER_ID]`
2. Check logs: `tail -f /tmp/whatsapp-webhook.log`
3. Verify in Genesys Agent Desktop

#### Genesys → WhatsApp
1. Reply from Genesys Agent Desktop
2. Check logs: `tail -f /tmp/genesys-webhook.log`
3. Verify WhatsApp message received

### 3. Monitor System

```bash
# Watch all logs
watch -n 1 'for log in /tmp/*.log; do echo "=== $log ==="; tail -5 $log; done'

# Monitor ports
watch -n 2 'lsof -ti:3002,3003,3004,3005,3007,3008,3009,3010,3011,3014,3015 | wc -l'
```

---

## 🛠️ Troubleshooting

### Service Won't Start

**Check logs:**
```bash
tail -50 /tmp/[service-name].log
```

**Common issues:**
- Missing .env file
- Port already in use: `lsof -ti:[PORT] | xargs kill -9`
- Missing dependencies: `npm install`
- Database not running: `docker ps | grep postgres`

### Can't Connect to Database

```bash
# Test connection
docker exec -it whatsapp-postgres psql -U postgres -d waba_mvp -c "SELECT 1;"

# Check if container is running
docker ps | grep postgres
```

### Redis Connection Failed

```bash
# Test Redis
docker exec -it whatsapp-redis redis-cli ping

# Should return: PONG
```

### RabbitMQ Authentication Failed

**Check credentials in .env files:**
```bash
grep RABBITMQ_URL services/*/src/.env
```

**Should all be:**
```
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
```

### Port Conflicts

```bash
# Kill all node processes
killall node

# Or kill specific port
kill -9 $(lsof -ti:[PORT])
```

---

## 📚 Key Documentation Files

- `MVP_DEPLOYMENT_STATUS.md` - Overall deployment status
- `CREDENTIALS_UPDATED.md` - All credentials and configuration
- `TASK_12_CUSTOMER_PORTAL.md` - Customer Portal implementation details
- `READY_TO_START.md` - This file
- `mvp_todo/` - Task implementation guides

---

## 🎯 Current Status Summary

### ✅ Complete
- All infrastructure services running
- All 11 application services configured
- Real Genesys credentials integrated
- Real WhatsApp credentials integrated
- Database seeded with demo tenant
- All .env files created and configured
- Code fixes applied

### ⚠️ Pending
- Start remaining 10 services (only auth-service running)
- Configure public webhook URLs (ngrok or domain)
- Register webhooks in Meta Developer Console
- Register webhooks in Genesys Cloud Admin
- End-to-end testing

### 🔜 Future Work
- Task 10: API Gateway (port 3000)
- Task 11: Admin Dashboard (port 3006)
- Production deployment
- SSL/TLS certificates
- Load balancing
- Monitoring and alerting

---

**Ready to proceed!** All configuration is complete. You can now start all services and begin testing the complete system.
