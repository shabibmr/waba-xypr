# Phase 1: Infrastructure & Foundation

**Priority:** 🔴 Critical (Blocks MVP)  
**Dependencies:** None  
**Estimated Effort:** 3-4 days  

---

## Overview
Establish the foundational infrastructure required for the service to operate as a RabbitMQ consumer instead of an HTTP API server. This phase transforms the service architecture from a REST API to a message queue worker.

---

## Tasks

### 1.1 RabbitMQ Integration

#### 1.1.1 Install Dependencies
```bash
npm install amqplib
```

**Files to Update:**
- `package.json` - Add `amqplib` to dependencies

**Acceptance Criteria:**
- ✅ `amqplib` added to package.json
- ✅ Package successfully installs

---

#### 1.1.2 Create RabbitMQ Configuration Module

**Files to Create:**
- `src/config/rabbitmq.config.js`

**Implementation Requirements:**
```javascript
// Configuration structure
{
  host: RABBITMQ_HOST,
  port: RABBITMQ_PORT,
  username: RABBITMQ_USER,
  password: RABBITMQ_PASSWORD,
  vhost: RABBITMQ_VHOST,
  queue: 'outbound-processed',
  exchange: 'whatsapp-exchange',
  prefetchCount: 10,
  reconnectDelay: 5000,
  maxReconnectAttempts: 10
}
```

**Environment Variables to Add:**
```bash
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=whatsapp-service
RABBITMQ_PASSWORD=<secure>
RABBITMQ_VHOST=/whatsapp
RABBITMQ_QUEUE=outbound-processed
RABBITMQ_PREFETCH=10
```

**Files to Update:**
- `.env.example`
- `src/config/rabbitmq.config.js` (new)

**Acceptance Criteria:**
- ✅ All RabbitMQ config parameters defined
- ✅ Environment variables documented
- ✅ Config exports proper structure

---

#### 1.1.3 Create RabbitMQ Connection Manager

**Files to Create:**
- `src/services/rabbitmq.service.js`

**Implementation Requirements:**
```javascript
class RabbitMQService {
  async connect() // Establish connection
  async createChannel() // Create channel with prefetch
  async reconnect() // Handle reconnection with backoff
  async close() // Graceful shutdown
  isConnected() // Connection status
}
```

**Features:**
- Connection establishment with retry
- Exponential backoff (5s, 10s, 20s, 40s, max 60s)
- Channel creation with prefetch count
- Connection health monitoring
- Graceful shutdown handling

**Acceptance Criteria:**
- ✅ Connection established on startup
- ✅ Auto-reconnect on connection failure
- ✅ Exponential backoff implemented
- ✅ Channel created with prefetch=10
- ✅ Graceful shutdown on SIGTERM/SIGINT

---

### 1.2 Message Consumer Implementation

#### 1.2.1 Create Message Queue Consumer

**Files to Create:**
- `src/consumers/message-queue.consumer.js`

**Implementation Requirements:**
```javascript
class MessageQueueConsumer {
  async startConsumer() // Start consuming messages
  async processMessage(msg) // Process single message
  async acknowledgeMessage(msg) // ACK message
  async rejectMessage(msg, requeue) // NACK message
  async handleParseError(msg, error) // Handle JSON parse errors
}
```

**Message Processing Flow:**
1. Consume message from `outbound-processed`
2. Parse message JSON
3. Extract `metadata` and `wabaPayload`
4. Call message processor
5. ACK on success, NACK on failure
6. Handle parse errors (NACK without requeue)

**Acceptance Criteria:**
- ✅ Consumer binds to `outbound-processed` queue
- ✅ Messages consumed in FIFO order
- ✅ JSON parsing with error handling
- ✅ ACK/NACK logic implemented
- ✅ Parse errors send to DLQ (no requeue)

---

#### 1.2.2 Update Main Entry Point

**Files to Update:**
- `src/index.js`

**Changes Required:**
1. Remove Express app setup (keep for health checks only)
2. Initialize RabbitMQ connection
3. Start message consumer
4. Handle graceful shutdown
5. Keep minimal HTTP server for health endpoint only

**New Structure:**
```javascript
// Initialize services
const rabbitmqService = require('./services/rabbitmq.service');
const messageConsumer = require('./consumers/message-queue.consumer');

async function start() {
  // Connect to RabbitMQ
  await rabbitmqService.connect();
  
  // Start consumer
  await messageConsumer.startConsumer();
  
  // Start health check server (port 8081)
  startHealthCheckServer();
  
  // Graceful shutdown
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
```

**Acceptance Criteria:**
- ✅ RabbitMQ connection initialized on startup
- ✅ Consumer starts successfully
- ✅ Express routes removed (except health)
- ✅ Graceful shutdown implemented
- ✅ Health check server runs on separate port (8081)

---

### 1.3 Configuration Updates

#### 1.3.1 Update Service Configuration

**Files to Update:**
- `src/config/config.js`

**Additions:**
```javascript
config = {
  // ... existing
  
  rabbitmq: {
    host: process.env.RABBITMQ_HOST,
    port: process.env.RABBITMQ_PORT,
    username: process.env.RABBITMQ_USER,
    password: process.env.RABBITMQ_PASSWORD,
    vhost: process.env.RABBITMQ_VHOST,
    queue: process.env.RABBITMQ_QUEUE,
    prefetchCount: parseInt(process.env.RABBITMQ_PREFETCH || '10')
  },
  
  metaApi: {
    timeout: 10000,
    maxRetries: 3,
    retryDelay: 1000
  },
  
  credentialCache: {
    ttl: 900000 // 15 minutes
  },
  
  healthCheck: {
    port: 8081
  }
}
```

**Acceptance Criteria:**
- ✅ All RabbitMQ config parameters present
- ✅ Meta API config added
- ✅ Cache TTL configured
- ✅ Health check port configured

---

#### 1.3.2 Environment Variables Documentation

**Files to Update:**
- `.env.example`
- `README.md` (if exists)

**Complete Environment Variables:**
```bash
# Service
NODE_ENV=production
SERVICE_PORT=8080 # Deprecated - only for health check now
HEALTH_CHECK_PORT=8081
LOG_LEVEL=info

# RabbitMQ
RABBITMQ_HOST=rabbitmq.internal.svc.cluster.local
RABBITMQ_PORT=5672
RABBITMQ_USER=whatsapp-service
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD}
RABBITMQ_VHOST=/whatsapp
RABBITMQ_QUEUE=outbound-processed
RABBITMQ_PREFETCH=10

# Tenant Service
TENANT_SERVICE_URL=http://tenant-service:3007
TENANT_SERVICE_TIMEOUT=5000

# Meta API
META_API_TIMEOUT=10000
META_API_MAX_RETRIES=3

# Caching
CREDENTIAL_CACHE_TTL=900000
```

**Acceptance Criteria:**
- ✅ All variables documented in `.env.example`
- ✅ Comments added for clarity
- ✅ Secure values use placeholders

---

### 1.4 Health Check Endpoint

#### 1.4.1 Enhance Health Check

**Files to Update:**
- `src/routes/health.routes.js`
- `src/controllers/health.controller.js` (if exists)

**Enhanced Response:**
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "version": "1.1.0",
  "uptime": 86400,
  "checks": {
    "rabbitmq": {
      "status": "connected",
      "queueDepth": 10
    },
    "tenantService": {
      "status": "reachable",
      "latency": 12
    }
  }
}
```

**Acceptance Criteria:**
- ✅ Health check includes RabbitMQ status
- ✅ Health check includes Tenant Service status
- ✅ Returns appropriate HTTP codes (200/503)
- ✅ Runs on dedicated port (8081)

---

## Verification Plan

### Unit Tests
```bash
npm test -- src/services/rabbitmq.service.test.js
npm test -- src/consumers/message-queue.consumer.test.js
```

**Test Scenarios:**
- ✅ RabbitMQ connection success
- ✅ RabbitMQ connection failure with retry
- ✅ Message consumption and parsing
- ✅ ACK/NACK logic
- ✅ Graceful shutdown

### Integration Test
```bash
# Start local RabbitMQ
docker run -d -p 5672:5672 rabbitmq:3-management

# Publish test message
curl -X POST http://localhost:15672/api/exchanges/%2Fwhatsapp/whatsapp-exchange/publish \
  -u guest:guest \
  -H "Content-Type: application/json" \
  -d '{
    "routing_key": "outbound.processed.test-tenant",
    "payload": "{\"metadata\":{\"tenantId\":\"test-123\",\"phoneNumberId\":\"100000001\",\"internalId\":\"msg-test-001\"},\"wabaPayload\":{\"messaging_product\":\"whatsapp\",\"to\":\"919876543210\",\"type\":\"text\",\"text\":{\"body\":\"Test\"}}}"
  }'

# Check logs for consumption
npm run dev
```

**Expected:**
- ✅ Service connects to RabbitMQ
- ✅ Message consumed from queue
- ✅ Message parsed successfully
- ✅ Message acknowledged

---

## Dependencies Introduced
- `amqplib` (^0.10.3)

## Files Created
- `src/config/rabbitmq.config.js`
- `src/services/rabbitmq.service.js`
- `src/consumers/message-queue.consumer.js`

## Files Modified
- `src/index.js` (major refactor)
- `src/config/config.js`
- `.env.example`
- `package.json`
- Health check routes/controllers

## Breaking Changes
⚠️ **Service is no longer an HTTP API server** - All REST endpoints removed except `/health`

---

## Next Steps
After completing this phase → Proceed to **02-core-features.md** (Credential caching + Error handling)
