# Troubleshooting Guide

Comprehensive troubleshooting guide for the WhatsApp-Genesys Cloud Integration Platform.

## Quick Diagnostics

### Check All Services Health

```powershell
# Run health check script
.\scripts\health-check.ps1

# Or manually check each service
curl http://localhost:3000/health  # API Gateway
curl http://localhost:3004/health  # Auth Service
curl http://localhost:3005/health  # State Manager
curl http://localhost:3007/health  # Tenant Service
# ... etc
```

### Check Infrastructure

```powershell
# Check Docker containers
docker ps

# Check infrastructure services
docker-compose -f docker-compose.infra.yml ps

# Check logs
docker-compose logs -f [service-name]
```

## Common Issues

### 1. Services Won't Start

#### Symptom
```
Error: Cannot connect to Redis
Error: ECONNREFUSED 127.0.0.1:6379
```

#### Solution
```powershell
# Check if infrastructure is running
docker-compose -f docker-compose.infra.yml ps

# Start infrastructure if not running
docker-compose -f docker-compose.infra.yml up -d

# Verify Redis is accessible
docker exec -it redis redis-cli ping
# Should return: PONG
```

---

#### Symptom
```
Error: Port 3000 is already in use
```

#### Solution
```powershell
# Find process using the port
netstat -ano | findstr :3000

# Kill the process (replace PID)
taskkill /PID <PID> /F

# Or change the port in .env
PORT=3100
```

---

### 2. Webhook Validation Failures

#### WhatsApp Webhook Verification Fails

**Symptom**:
```
Meta console shows: "Callback verification failed"
```

**Solution**:
1. Check `META_VERIFY_TOKEN` matches in both Meta console and `.env`
2. Ensure webhook URL is publicly accessible
3. Check webhook service logs:
   ```powershell
   docker-compose logs -f whatsapp-webhook-service
   ```

---

#### WhatsApp Signature Validation Fails

**Symptom**:
```
Error: Invalid Meta signature
```

**Solution**:
1. Verify `META_APP_SECRET` is correct in `.env`
2. Check request body is not modified before validation
3. Ensure Content-Type is `application/json`
4. Debug signature calculation:
   ```javascript
   console.log('Received signature:', req.headers['x-hub-signature-256']);
   console.log('Request body:', JSON.stringify(req.body));
   ```

---

### 3. Authentication Issues

#### Genesys Token Errors

**Symptom**:
```
Error: 401 Unauthorized from Genesys API
Error: Failed to obtain OAuth token
```

**Solution**:
1. Verify Genesys credentials in tenant configuration:
   ```bash
   curl http://localhost:3007/tenants/tenant-001/credentials/genesys
   ```

2. Check Auth Service logs:
   ```powershell
   docker-compose logs -f auth-service
   ```

3. Test token manually:
   ```bash
   curl http://localhost:3004/auth/token \
     -H "X-Tenant-ID: tenant-001"
   ```

4. Verify Genesys region is correct:
   ```
   GENESYS_REGION=mypurecloud.com  # or .ie, .de, .jp, etc.
   ```

5. Check token cache:
   ```bash
   docker exec -it redis redis-cli
   > KEYS tenant:*:oauth:token
   > GET tenant:tenant-001:oauth:token
   ```

---

### 4. Message Delivery Failures

#### Messages Not Reaching Genesys

**Symptom**: WhatsApp messages received but not appearing in Genesys

**Diagnosis**:
1. Check RabbitMQ queue:
   ```bash
   # Access RabbitMQ management UI
   http://localhost:15672
   # Default credentials: guest/guest
   
   # Check queue: inbound-whatsapp-messages
   # Look for messages piling up
   ```

2. Check Inbound Transformer logs:
   ```powershell
   docker-compose logs -f inbound-transformer
   ```

3. Verify conversation mapping:
   ```bash
   curl "http://localhost:3005/state/conversation?whatsappNumber=+919876543210"
   ```

**Solutions**:
- If queue is full: Restart inbound-transformer
- If no mapping: Check State Manager database
- If transformer errors: Check Genesys API credentials

---

#### Messages Not Reaching WhatsApp

**Symptom**: Agent messages sent but customer doesn't receive them

**Diagnosis**:
1. Check outbound queue:
   ```bash
   # RabbitMQ UI: queue "outbound-genesys-messages"
   ```

2. Check Outbound Transformer logs:
   ```powershell
   docker-compose logs -f outbound-transformer
   ```

3. Check WhatsApp API Service logs:
   ```powershell
   docker-compose logs -f whatsapp-api-service
   ```

4. Verify tenant WhatsApp credentials:
   ```bash
   curl http://localhost:3007/tenants/tenant-001/whatsapp
   ```

**Solutions**:
- If 401 error: WhatsApp access token expired, refresh credentials
- If 429 error: Rate limit exceeded, implement backoff
- If 400 error: Invalid message format, check transformer logic

---

### 5. Database Issues

#### Connection Pool Exhausted

**Symptom**:
```
Error: Connection pool timeout
Error: Too many clients already
```

**Solution**:
```javascript
// Increase pool size in database config
const pool = new Pool({
  max: 20,  // Increase from default 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Or restart services to reset connections
docker-compose restart state-manager tenant-service
```

---

#### Migration Failures

**Symptom**:
```
Error: relation "tenants" does not exist
```

**Solution**:
```powershell
# Run migrations
.\scripts\db-migrate.ps1 -Action up

# Check migration status
.\scripts\db-migrate.ps1 -Action status

# Rollback if needed
.\scripts\db-migrate.ps1 -Action down
```

---

### 6. Redis Issues

#### Redis Connection Errors

**Symptom**:
```
Error: Redis connection to localhost:6379 failed
```

**Solution**:
```powershell
# Check Redis is running
docker ps | findstr redis

# Check Redis logs
docker logs redis

# Test connection
docker exec -it redis redis-cli ping

# Restart Redis
docker-compose -f docker-compose.infra.yml restart redis
```

---

#### Cache Inconsistency

**Symptom**: Stale data being returned

**Solution**:
```bash
# Clear specific keys
docker exec -it redis redis-cli
> DEL tenant:tenant-001:oauth:token
> DEL tenant:tenant-001:mapping:*

# Or flush entire cache (CAUTION: affects all tenants)
> FLUSHDB
```

---

### 7. RabbitMQ Issues

#### Queue Backlog

**Symptom**: Messages piling up in queues

**Diagnosis**:
```bash
# Check queue depths in RabbitMQ UI
http://localhost:15672/#/queues

# Or via CLI
docker exec -it rabbitmq rabbitmqctl list_queues name messages
```

**Solutions**:
1. Scale consumers:
   ```powershell
   docker-compose up -d --scale inbound-transformer=3
   ```

2. Check consumer errors:
   ```powershell
   docker-compose logs -f inbound-transformer
   ```

3. Purge queue if needed (CAUTION: deletes messages):
   ```bash
   docker exec -it rabbitmq rabbitmqctl purge_queue inbound-whatsapp-messages
   ```

---

#### Connection Refused

**Symptom**:
```
Error: connect ECONNREFUSED 127.0.0.1:5672
```

**Solution**:
```powershell
# Check RabbitMQ is running
docker ps | findstr rabbitmq

# Check RabbitMQ logs
docker logs rabbitmq

# Restart RabbitMQ
docker-compose -f docker-compose.infra.yml restart rabbitmq

# Wait for RabbitMQ to be ready (can take 30-60 seconds)
docker logs -f rabbitmq
# Look for: "Server startup complete"
```

---

### 8. Performance Issues

#### Slow Message Processing

**Diagnosis**:
1. Check queue consumer lag
2. Monitor CPU/memory usage:
   ```powershell
   docker stats
   ```
3. Check database query performance
4. Review logs for slow operations

**Solutions**:
- Increase consumer prefetch limit
- Add database indexes
- Scale transformer services
- Optimize Redis caching

---

#### High Memory Usage

**Solution**:
```powershell
# Check memory usage
docker stats

# Set memory limits in docker-compose.prod.yml
services:
  inbound-transformer:
    mem_limit: 512m
    mem_reservation: 256m

# Restart with limits
docker-compose -f docker-compose.prod.yml up -d
```

---

### 9. Tenant-Specific Issues

#### Tenant Not Found

**Symptom**:
```
Error: Tenant identification required
Error: Tenant not found
```

**Solution**:
1. Verify tenant exists:
   ```bash
   curl http://localhost:3007/tenants/tenant-001
   ```

2. Check tenant status:
   ```json
   {
     "tenantId": "tenant-001",
     "status": "active"  // Must be "active"
   }
   ```

3. Verify API key mapping:
   ```bash
   docker exec -it redis redis-cli
   > GET apikey:your-api-key-here
   # Should return tenant ID
   ```

---

#### Rate Limit Exceeded

**Symptom**:
```
Error: 429 Rate limit exceeded
```

**Solution**:
1. Check tenant rate limit:
   ```bash
   curl http://localhost:3007/tenants/tenant-001
   # Look for "rateLimit" field
   ```

2. Increase limit if needed:
   ```bash
   curl -X PATCH http://localhost:3007/tenants/tenant-001 \
     -H "Content-Type: application/json" \
     -d '{"rateLimit": 200}'
   ```

3. Check current usage:
   ```bash
   docker exec -it redis redis-cli
   > KEYS ratelimit:tenant-001:*
   > GET ratelimit:tenant-001:202601141030
   ```

---

## Debugging Tools

### Log Analysis

```powershell
# Follow logs for specific service
docker-compose logs -f service-name

# Search logs for errors
docker-compose logs | findstr ERROR

# Export logs to file
docker-compose logs > logs.txt

# Filter by timestamp
docker-compose logs --since 30m
docker-compose logs --until 2026-01-14T10:00:00
```

### Database Queries

```bash
# Connect to PostgreSQL
docker exec -it postgres psql -U postgres -d whatsapp_genesys

# Check tenants
SELECT * FROM tenants;

# Check conversation mappings
SELECT * FROM conversation_mappings WHERE tenant_id = 'tenant-001';

# Check message history
SELECT * FROM messages WHERE conversation_id = 'conv-123' ORDER BY created_at DESC LIMIT 10;
```

### Redis Inspection

```bash
docker exec -it redis redis-cli

# List all keys
KEYS *

# List tenant keys
KEYS tenant:*

# Get specific value
GET tenant:tenant-001:oauth:token

# Check TTL
TTL tenant:tenant-001:oauth:token

# Monitor commands in real-time
MONITOR
```

### Network Debugging

```powershell
# Test service connectivity
curl http://localhost:3000/health

# Test with headers
curl http://localhost:3004/auth/token `
  -H "X-Tenant-ID: tenant-001"

# Verbose output
curl -v http://localhost:3000/health

# Test from within Docker network
docker exec -it api-gateway curl http://auth-service:3004/health
```

---

## Getting Help

### Before Asking for Help

1. ✅ Check this troubleshooting guide
2. ✅ Review service-specific README files
3. ✅ Check service logs for error messages
4. ✅ Verify infrastructure (Redis, RabbitMQ, PostgreSQL) is running
5. ✅ Test with health check endpoints

### Information to Provide

When reporting issues, include:
- **Error message** (full stack trace)
- **Service logs** (relevant portions)
- **Environment** (development/production)
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Recent changes** (code, config, infrastructure)

### Support Channels

- **Documentation**: Check service READMEs and docs/
- **Logs**: Enable DEBUG logging for detailed output
- **Issues**: Open GitHub issue with template
- **Team**: Contact development team

---

## Preventive Measures

### Regular Maintenance

```powershell
# Weekly: Clear old logs
docker system prune -f

# Monthly: Vacuum database
docker exec -it postgres psql -U postgres -d whatsapp_genesys -c "VACUUM ANALYZE;"

# As needed: Restart services
docker-compose restart
```

### Monitoring Checklist

- [ ] All services responding to `/health`
- [ ] RabbitMQ queues not backing up
- [ ] Redis memory usage under 80%
- [ ] PostgreSQL connection pool healthy
- [ ] No error spikes in logs
- [ ] Tenant rate limits appropriate
- [ ] OAuth tokens refreshing correctly

### Backup Strategy

```powershell
# Backup PostgreSQL
docker exec -it postgres pg_dump -U postgres whatsapp_genesys > backup.sql

# Backup Redis (if needed)
docker exec -it redis redis-cli SAVE

# Backup .env files
cp .env .env.backup
```
