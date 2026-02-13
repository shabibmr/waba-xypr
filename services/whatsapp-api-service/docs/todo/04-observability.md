# Phase 4: Observability & Monitoring

**Priority:** 🟡 Medium (Post-MVP)  
**Dependencies:** 03-reliability.md  
**Estimated Effort:** 2-3 days  

---

## Overview
Implement comprehensive monitoring, metrics, and health checks for production observability. This enables operational visibility and proactive issue detection.

---

## Tasks

### 4.1 Prometheus Metrics

#### 4.1.1 Install Prometheus Client

```bash
npm install prom-client
```

**Files to Update:**
- `package.json`

---

#### 4.1.2 Create Metrics Service

**Files to Create:**
- `src/services/metrics.service.js`

**Implementation Requirements:**
```javascript
const promClient = require('prom-client');

class MetricsService {
  constructor() {
    // Enable default metrics
    promClient.collectDefaultMetrics();
    
    // Custom metrics
    this.messagesConsumed = new promClient.Counter({
      name: 'messages_consumed_total',
      help: 'Total messages consumed from queue',
      labelNames: ['tenant', 'status']
    });
    
    this.messagesDelivered = new promClient.Counter({
      name: 'messages_delivered_total',
      help: 'Total messages delivered to Meta API',
      labelNames: ['tenant']
    });
    
    this.messagesFailed = new promClient.Counter({
      name: 'messages_failed_total',
      help: 'Total messages failed',
      labelNames: ['tenant', 'error_code', 'retryable']
    });
    
    this.metaApiRequests = new promClient.Counter({
      name: 'meta_api_requests_total',
      help: 'Total requests to Meta API',
      labelNames: ['tenant', 'status_code', 'method']
    });
    
    this.messageProcessingDuration = new promClient.Histogram({
      name: 'message_processing_duration_seconds',
      help: 'Message processing duration',
      labelNames: ['tenant'],
      buckets: [0.1, 0.5, 1, 2, 5]
    });
    
    this.metaApiDuration = new promClient.Histogram({
      name: 'meta_api_request_duration_seconds',
      help: 'Meta API request duration',
      labelNames: ['tenant'],
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    });
    
    this.credentialFetchDuration = new promClient.Histogram({
      name: 'credential_fetch_duration_seconds',
      help: 'Credential fetch duration',
      labelNames: ['tenant', 'cached'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1]
    });
    
    this.queueDepth = new promClient.Gauge({
      name: 'rabbitmq_queue_depth',
      help: 'Current queue depth',
      labelNames: ['queue']
    });
    
    this.circuitBreakerState = new promClient.Gauge({
      name: 'tenant_circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
      labelNames: ['tenant', 'state']
    });
    
    this.rateLimitAvailable = new promClient.Gauge({
      name: 'tenant_rate_limit_available',
      help: 'Available rate limit tokens',
      labelNames: ['tenant']
    });
  }
  
  // Methods
  incrementMessagesConsumed(tenant, status) {
    this.messagesConsumed.inc({ tenant, status });
  }
  
  // ... other increment methods
  
  getMetrics() {
    return promClient.register.metrics();
  }
}
```

**Acceptance Criteria:**
- ✅ All 11 metrics defined (7 counters, 3 histograms, 1 gauge)
- ✅ Metrics have proper labels
- ✅ Histograms have appropriate buckets

---

#### 4.1.3 Integrate Metrics Throughout Codebase

**Files to Update:**
- `src/consumers/message-queue.consumer.js`
- `src/processors/message.processor.js`
- `src/services/whatsapp.service.js`
- `src/services/tenant.service.js`

**Message Consumer:**
```javascript
async processMessage(msg) {
  const start = Date.now();
  const tenantId = payload.metadata.tenantId;
  
  try {
    metricsService.incrementMessagesConsumed(tenantId, 'consumed');
    
    await messageProcessor.process(payload);
    
    metricsService.incrementMessagesDelivered(tenantId);
    metricsService.incrementMessagesConsumed(tenantId, 'success');
    
  } catch (error) {
    metricsService.incrementMessagesFailed(
      tenantId,
      error.code,
      error.retryable
    );
    metricsService.incrementMessagesConsumed(tenantId, 'failed');
    
  } finally {
    const duration = (Date.now() - start) / 1000;
    metricsService.observeMessageProcessingDuration(tenantId, duration);
  }
}
```

**WhatsApp Service:**
```javascript
async _makeRequest(tenantId, method, endpoint, data) {
  const start = Date.now();
  
  try {
    const response = await axios(...);
    
    metricsService.incrementMetaApiRequests(
      tenantId,
      response.status,
      method
    );
    
    return response;
    
  } finally {
    const duration = (Date.now() - start) / 1000;
    metricsService.observeMetaApiDuration(tenantId, duration);
  }
}
```

**Tenant Service:**
```javascript
async getWhatsAppCredentials(tenantId) {
  const start = Date.now();
  const cached = cache.has(tenantId);
  
  try {
    const credentials = await this._fetch(tenantId);
    return credentials;
    
  } finally {
    const duration = (Date.now() - start) / 1000;
    metricsService.observeCredentialFetchDuration(tenantId, duration, cached);
  }
}
```

**Acceptance Criteria:**
- ✅ All metrics instrumented
- ✅ Metrics labeled with tenant ID
- ✅ Durations measured accurately
- ✅ Error metrics include error codes

---

#### 4.1.4 Create Metrics Endpoint

**Files to Create:**
- `src/routes/metrics.routes.js`

**Implementation:**
```javascript
const router = require('express').Router();
const metricsService = require('../services/metrics.service');

router.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await metricsService.getMetrics());
});

module.exports = router;
```

**Files to Update:**
- `src/index.js` - Add metrics route

**Acceptance Criteria:**
- ✅ GET /metrics returns Prometheus format
- ✅ Metrics accessible on port 9090
- ✅ Metrics updated in real-time

---

### 4.2 Enhanced Health Checks

#### 4.2.1 Create Health Check Service

**Files to Create:**
- `src/services/health-check.service.js`

**Implementation:**
```javascript
class HealthCheckService {
  async checkHealth() {
    const checks = await Promise.all([
      this.checkRabbitMQ(),
      this.checkTenantService(),
      this.checkMetaApi()
    ]);
    
    const status = checks.every(c => c.status === 'healthy')
      ? 'healthy'
      : checks.some(c => c.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded';
    
    return {
      status,
      version: '1.1.0',
      uptime: process.uptime(),
      checks: {
        rabbitmq: checks[0],
        tenantService: checks[1],
        metaApi: checks[2]
      },
      metrics: this.getRecentMetrics()
    };
  }
  
  async checkRabbitMQ() {
    try {
      const connected = rabbitmqService.isConnected();
      const queueDepth = await rabbitmqService.getQueueDepth();
      
      return {
        status: connected ? 'healthy' : 'unhealthy',
        queueDepth,
        latency: 5  // connection check latency
      };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
  
  async checkTenantService() {
    const start = Date.now();
    try {
      await axios.get(`${config.services.tenant.url}/health`, {
        timeout: 2000
      });
      
      return {
        status: 'healthy',
        latency: Date.now() - start
      };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
  
  async checkMetaApi() {
    // Simple HEAD request to Meta API
    const start = Date.now();
    try {
      await axios.head('https://graph.facebook.com', {
        timeout: 2000
      });
      
      return {
        status: 'reachable',
        latency: Date.now() - start
      };
    } catch (error) {
      return { status: 'degraded', error: error.message };
    }
  }
  
  getRecentMetrics() {
    // Get last 1 minute metrics from Prometheus
    return {
      messagesProcessedLast1Min: 42,  // from metrics
      errorRateLast1Min: 0.02,
      queueDepth: 10
    };
  }
}
```

**Acceptance Criteria:**
- ✅ Health check tests all dependencies
- ✅ Returns overall status (healthy/degraded/unhealthy)
- ✅ Includes latency metrics
- ✅ Returns recent metrics

---

#### 4.2.2 Update Health Check Endpoint

**Files to Update:**
- `src/routes/health.routes.js`
- `src/controllers/health.controller.js`

**Enhanced Endpoint:**
```javascript
router.get('/health', async (req, res) => {
  const health = await healthCheckService.checkHealth();
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

router.get('/health/live', (req, res) => {
  // Kubernetes liveness probe (simple)
  res.status(200).json({ status: 'alive' });
});

router.get('/health/ready', async (req, res) => {
  // Kubernetes readiness probe (checks RabbitMQ)
  const ready = rabbitmqService.isConnected();
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready' });
});
```

**Acceptance Criteria:**
- ✅ /health returns detailed health
- ✅ /health/live for liveness probe
- ✅ /health/ready for readiness probe
- ✅ Appropriate HTTP status codes

---

### 4.3 Alerting Configuration

#### 4.3.1 Create Prometheus Alert Rules

**Files to Create:**
- `deployment/prometheus-alerts.yaml`

**Alert Rules:**
```yaml
groups:
  - name: whatsapp-api-service
    interval: 30s
    rules:
      - alert: ServiceDown
        expr: up{job="whatsapp-api-service"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "WhatsApp API Service is down"
          
      - alert: HighErrorRate
        expr: |
          rate(messages_failed_total[5m]) / rate(messages_consumed_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Error rate > 5% for WhatsApp API Service"
          
      - alert: QueueDepthHigh
        expr: rabbitmq_queue_depth{queue="outbound-processed"} > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Outbound queue depth > 1000 messages"
          
      - alert: CredentialFetchFailures
        expr: |
          increase(tenant_service_errors_total[5m]) > 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Multiple credential fetch failures"
          
      - alert: CircuitBreakerOpen
        expr: tenant_circuit_breaker_state{state="open"} > 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Circuit breaker open for tenant {{ $labels.tenant }}"
```

**Acceptance Criteria:**
- ✅ All critical alerts defined
- ✅ Appropriate thresholds set
- ✅ Alert labels and annotations clear

---

## Verification Plan

### Metrics Testing
```bash
# 1. Generate load
npm run load-test

# 2. Check metrics
curl http://localhost:9090/metrics

# Expected metrics:
# - messages_consumed_total
# - messages_delivered_total
# - messages_failed_total
# - message_processing_duration_seconds
# - etc.
```

### Health Check Testing
```bash
# 1. Healthy state
curl http://localhost:8081/health
# Expected: 200, status: "healthy"

# 2. Stop RabbitMQ
docker stop rabbitmq

curl http://localhost:8081/health
# Expected: 503, status: "unhealthy"

# 3. Readiness probe
curl http://localhost:8081/health/ready
# Expected: 503
```

### Alert Testing
```bash
# 1. Trigger high error rate
# Send messages with invalid credentials

# 2. Check Prometheus
# Expected: HighErrorRate alert firing

# 3. Trigger queue depth alert
# Stop consumer, publish 1500 messages
# Expected: QueueDepthHigh alert firing
```

---

## Dependencies Introduced
- `prom-client` (^15.0.0)

## Files Created
- `src/services/metrics.service.js`
- `src/services/health-check.service.js`
- `src/routes/metrics.routes.js`
- `deployment/prometheus-alerts.yaml`

## Files Modified
- `src/consumers/message-queue.consumer.js`
- `src/processors/message.processor.js`
- `src/services/whatsapp.service.js`
- `src/services/tenant.service.js`
- `src/routes/health.routes.js`
- `src/index.js`

## Breaking Changes
None

---

## Next Steps
After completing this phase → Proceed to **05-testing.md** (Comprehensive testing)
