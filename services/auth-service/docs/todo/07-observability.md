# Phase 07 — Observability (Metrics, Logging, Health)

**Depends on:** 06-api-layer
**Blocks:** Nothing (additive)
**MVP Critical:** NO (post-MVP enhancement)

---

## Gap Analysis

### Current State
- No metrics collection — no Prometheus counters, histograms, or gauges
- Logging is `console.log`/`console.error` (addressed in TASK-01-05)
- Health check returns basic Redis status only (no latency measurement, no Tenant Service check)

### FRD Requirements (Section 12)
- Prometheus metrics endpoint (`GET /metrics` on port 9090 or same port)
- Counter metrics: `auth_token_requests_total`, `auth_cache_hits_total`, `auth_cache_misses_total`, `auth_oauth_success_total`, `auth_oauth_failures_total`, `auth_jwt_validation_success_total`, `auth_jwt_validation_failures_total`
- Histogram metrics: `auth_token_request_duration_ms`, `auth_oauth_exchange_duration_ms`, `auth_jwt_validation_duration_ms`
- Gauge metrics: `redis_health`, `redis_connection_status`, `tenant_service_health`
- Structured JSON logs with `service`, `correlationId`, `tenantId`, `provider` fields
- No secrets in logs (enforced by logger usage rules)

---

## Tasks

### TASK-07-01: Add prom-client for Prometheus metrics
**Priority:** Post-MVP
**File:** `src/utils/metrics.js`

**Description:** Install `prom-client` and define all metric instruments from FRD Section 12.1. Add `/metrics` endpoint.

```bash
npm install prom-client
```

```javascript
// src/utils/metrics.js
const client = require('prom-client');

// Enable default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ prefix: 'auth_service_' });

// ─── Counters ───────────────────────────────────────────────────────────────

const tokenRequests = new client.Counter({
  name: 'auth_token_requests_total',
  help: 'Total token requests',
  labelNames: ['provider'],
});

const cacheHits = new client.Counter({
  name: 'auth_cache_hits_total',
  help: 'Token cache hits',
  labelNames: ['provider'],
});

const cacheMisses = new client.Counter({
  name: 'auth_cache_misses_total',
  help: 'Token cache misses',
  labelNames: ['provider'],
});

const cacheWrites = new client.Counter({
  name: 'auth_cache_writes_total',
  help: 'Token cache writes',
  labelNames: ['provider'],
});

const oauthSuccess = new client.Counter({
  name: 'auth_oauth_success_total',
  help: 'Successful OAuth exchanges',
  labelNames: ['provider', 'region'],
});

const oauthFailures = new client.Counter({
  name: 'auth_oauth_failures_total',
  help: 'Failed OAuth exchanges',
  labelNames: ['provider', 'reason'],
});

const jwtValidationSuccess = new client.Counter({
  name: 'auth_jwt_validation_success_total',
  help: 'Successful JWT validations',
  labelNames: ['region'],
});

const jwtValidationFailures = new client.Counter({
  name: 'auth_jwt_validation_failures_total',
  help: 'Failed JWT validations',
  labelNames: ['region', 'reason'],
});

const requestCollapsed = new client.Counter({
  name: 'auth_request_collapsed_total',
  help: 'Requests served from cache via request collapsing',
  labelNames: ['provider'],
});

const rateLimitEvents = new client.Counter({
  name: 'auth_rate_limit_events_total',
  help: 'Rate limit events',
  labelNames: ['provider'],
});

const degradedModeRequests = new client.Counter({
  name: 'auth_degraded_mode_requests_total',
  help: 'Requests processed in degraded mode',
  labelNames: ['provider'],
});

const redisFailures = new client.Counter({
  name: 'auth_redis_failure_total',
  help: 'Redis connectivity failures',
});

// ─── Histograms ──────────────────────────────────────────────────────────────

const tokenRequestDuration = new client.Histogram({
  name: 'auth_token_request_duration_ms',
  help: 'Token request duration in milliseconds',
  labelNames: ['provider', 'source'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

const oauthExchangeDuration = new client.Histogram({
  name: 'auth_oauth_exchange_duration_ms',
  help: 'OAuth exchange duration in milliseconds',
  labelNames: ['provider', 'region'],
  buckets: [100, 250, 500, 1000, 2000, 3000, 5000],
});

const jwtValidationDuration = new client.Histogram({
  name: 'auth_jwt_validation_duration_ms',
  help: 'JWT validation duration in milliseconds',
  labelNames: ['region'],
  buckets: [1, 5, 10, 20, 50, 100, 200],
});

// ─── Gauges ──────────────────────────────────────────────────────────────────

const redisHealth = new client.Gauge({
  name: 'auth_redis_health',
  help: 'Redis health status (1=healthy, 0=unhealthy)',
});

const tenantServiceHealth = new client.Gauge({
  name: 'auth_tenant_service_health',
  help: 'Tenant Service health status (1=healthy, 0=unhealthy)',
});

module.exports = {
  register: client.register,
  tokenRequests,
  cacheHits,
  cacheMisses,
  cacheWrites,
  oauthSuccess,
  oauthFailures,
  jwtValidationSuccess,
  jwtValidationFailures,
  requestCollapsed,
  rateLimitEvents,
  degradedModeRequests,
  redisFailures,
  tokenRequestDuration,
  oauthExchangeDuration,
  jwtValidationDuration,
  redisHealth,
  tenantServiceHealth,
};
```

**Integration points:** Import `metrics` in services and increment/observe at the right points (see FRD Section 12.1 for where each metric is recorded).

**Acceptance:** `GET /metrics` returns Prometheus text format with at least `auth_token_requests_total` present.

---

### TASK-07-02: Add metrics HTTP endpoint
**Priority:** Post-MVP
**File:** Add to `src/app.js`

```javascript
// Add to src/app.js
const metrics = require('./utils/metrics');

// Metrics endpoint — no auth (Prometheus scraper)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});
```

---

### TASK-07-03: Instrument services with metrics
**Priority:** Post-MVP
**Description:** Add metric instrumentation calls inside services.

**Instrumentation map:**

| Location | Metric to record |
|----------|-----------------|
| `TokenService.getToken()` entry | `tokenRequests.inc({ provider })` |
| `TokenService.getToken()` success | `tokenRequestDuration.observe({ provider, source }, duration)` |
| `TokenCacheRepository.get()` hit | `cacheHits.inc({ provider })` |
| `TokenCacheRepository.get()` miss | `cacheMisses.inc({ provider })` |
| `TokenCacheRepository.set()` | `cacheWrites.inc({ provider })` |
| `GenesysOAuthClient` success | `oauthSuccess.inc({ provider, region })` |
| `GenesysOAuthClient` 401 | `oauthFailures.inc({ provider, reason: 'invalid_credentials' })` |
| `GenesysOAuthClient` 429 | `rateLimitEvents.inc({ provider })` |
| `GenesysOAuthClient` max retries | `oauthFailures.inc({ provider, reason: 'max_retries_exceeded' })` |
| `JWTValidatorService` success | `jwtValidationSuccess.inc({ region })` |
| `JWTValidatorService` expired | `jwtValidationFailures.inc({ region, reason: 'expired' })` |
| `JWTValidatorService` invalid sig | `jwtValidationFailures.inc({ region, reason: 'invalid_signature' })` |
| `GenesysTokenService._getTokenDegraded()` | `degradedModeRequests.inc({ provider })` |
| `RedisHealthMonitor` → unhealthy | `redisHealth.set(0)`, `redisFailures.inc()` |
| `RedisHealthMonitor` → healthy | `redisHealth.set(1)` |
| Request collapsing (`_waitForCache` success) | `requestCollapsed.inc({ provider })` |

---

### TASK-07-04: Add request logging middleware
**Priority:** Post-MVP
**File:** `src/api/middleware/request-logger.middleware.js`

**Description:** Log every incoming request and its response status + duration.

```javascript
// src/api/middleware/request-logger.middleware.js
const logger = require('../../utils/logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Don't log health/metrics endpoints at info level (too noisy)
    const logFn = (req.path === '/api/v1/health' || req.path === '/metrics')
      ? logger.debug.bind(logger)
      : logger.info.bind(logger);

    logFn('HTTP request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      correlationId: req.correlationId,
    });
  });

  next();
}

module.exports = { requestLogger };
```

---

### TASK-07-05: Alerting documentation
**Priority:** Post-MVP
**Description:** Document alert rules (for ops team runbook). No code required — configuration for Prometheus Alertmanager or Grafana.

**Critical alerts (page on-call):**
1. Redis down: `auth_redis_health == 0` for > 1 minute
2. High OAuth failure rate: `rate(auth_oauth_failures_total[5m]) / rate(auth_token_requests_total[5m]) > 0.1`

**Warning alerts:**
1. Degraded mode active: `auth_degraded_mode_requests_total > 0`
2. Cache hit rate low: `rate(auth_cache_hits_total[5m]) / rate(auth_token_requests_total[5m]) < 0.8`
3. High latency: `histogram_quantile(0.95, auth_token_request_duration_ms_bucket) > 1000`

See FRD Section 12.3 for full alert definitions.
