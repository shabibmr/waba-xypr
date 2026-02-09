# API Gateway Service - Implementation Plan

## Goal

Transform the API Gateway from a basic routing service into a comprehensive middleware platform that provides authentication, validation, orchestration, monitoring, and multi-tenant support for the WABA-Genesys integration.

## Phased Implementation Approach

### Phase 1: Authentication & Authorization (Priority: HIGH)
**Duration**: 2 weeks

#### 1.1 JWT Token Validation Middleware
- **Files to Create/Modify**:
  - `src/middleware/auth.js` - JWT validation middleware
  - `src/middleware/tenantAuth.js` - Tenant-based authorization
  - `src/config/auth.config.js` - Auth configuration
  
- **Implementation Details**:
  - Integrate with `auth-service` for token validation
  - Implement role-based access control (RBAC) for endpoints
  - Add tenant context extraction from JWT tokens
  - Cache validation results in Redis for performance

#### 1.2 API Key Management for Webhooks
- **Files to Create/Modify**:
  - `src/middleware/webhookAuth.js` - Webhook authentication
  - `src/services/apiKeyService.js` - API key validation logic
  
- **Implementation Details**:
  - Implement API key rotation mechanism
  - Add X-API-Key header validation
  - Integrate with `tenant-service` for API key retrieval

#### 1.3 Webhook Signature Verification
- **Files to Create/Modify**:
  - `src/middleware/whatsappSignature.js` - WhatsApp signature verification
  - `src/middleware/genesysSignature.js` - Genesys signature verification
  
- **Implementation Details**:
  - Implement Meta's webhook signature verification algorithm
  - Add Genesys webhook authentication
  - Implement replay attack prevention with timestamp validation
  - Add IP whitelisting for webhook sources

---

### Phase 2: Request Validation & Transformation (Priority: HIGH)
**Duration**: 2 weeks

#### 2.1 Schema Validation
- **Files to Create/Modify**:
  - `src/middleware/validation.js` - Request validation middleware
  - `src/schemas/whatsapp.schema.js` - WhatsApp payload schemas
  - `src/schemas/genesys.schema.js` - Genesys payload schemas
  
- **Implementation Details**:
  - Use Joi or AJV for JSON schema validation
  - Define schemas for all webhook payloads
  - Add request body sanitization
  - Implement validation error handling with detailed messages

#### 2.2 Message Format Transformation
- **Files to Create/Modify**:
  - `src/transformers/requestTransformer.js` - Generic request transformer
  - `src/transformers/responseTransformer.js` - Response normalization
  
- **Implementation Details**:
  - Normalize incoming webhook payloads to internal format
  - Add content-type negotiation
  - Implement compression/decompression for large payloads

---

### Phase 3: Orchestration & Resilience (Priority: HIGH)
**Duration**: 3 weeks

#### 3.1 Circuit Breaker Pattern
- **Files to Create/Modify**:
  - `src/middleware/circuitBreaker.js` - Circuit breaker implementation
  - `src/config/resilience.config.js` - Resilience configuration
  
- **Implementation Details**:
  - Use `opossum` library for circuit breaker
  - Configure per-service circuit breakers
  - Add fallback responses for opened circuits
  - Implement health check endpoints for circuit state

#### 3.2 Retry Mechanisms
- **Files to Create/Modify**:
  - `src/middleware/retry.js` - Retry logic with exponential backoff
  
- **Implementation Details**:
  - Implement exponential backoff with jitter
  - Configure retry policies per service
  - Add dead letter queue integration for failed requests
  - Track retry attempts in logging

#### 3.3 Message Flow Tracking
- **Files to Create/Modify**:
  - `src/middleware/tracing.js` - Distributed tracing middleware
  - `src/services/correlationService.js` - Correlation ID management
  
- **Implementation Details**:
  - Generate unique correlation IDs for each request
  - Propagate correlation IDs across service calls
  - Integrate with OpenTelemetry or similar tracing solution
  - Add trace context to all logs

---

### Phase 4: Multi-tenant Routing (Priority: MEDIUM)
**Duration**: 2 weeks

#### 4.1 Tenant Resolution
- **Files to Create/Modify**:
  - `src/middleware/tenantResolver.js` - Tenant identification
  - `src/services/tenantService.js` - Tenant configuration retrieval
  
- **Implementation Details**:
  - Extract tenant ID from webhooks, JWT tokens, or API keys
  - Cache tenant configurations in Redis
  - Add tenant-not-found error handling
  - Implement tenant isolation in routing

#### 4.2 Per-tenant Rate Limiting
- **Files to Modify**:
  - `src/middleware/rateLimiter.js` - Enhance existing rate limiter
  
- **Implementation Details**:
  - Implement tenant-specific rate limits
  - Use Redis for distributed rate limiting
  - Add quota management per tenant
  - Implement rate limit exceeded notifications

#### 4.3 Tenant-specific Service Routing
- **Files to Create/Modify**:
  - `src/routes/tenantRoutes.js` - Dynamic tenant routing
  
- **Implementation Details**:
  - Route requests based on tenant configuration
  - Support tenant-specific service endpoints
  - Add A/B testing capabilities for tenants

---

### Phase 5: Monitoring & Analytics (Priority: MEDIUM)
**Duration**: 2 weeks

#### 5.1 Request/Response Logging
- **Files to Create/Modify**:
  - `src/middleware/requestLogger.js` - Enhanced logging middleware
  - `src/services/loggingService.js` - Structured logging service
  
- **Implementation Details**:
  - Implement structured logging with Winston or Bunyan
  - Log all requests/responses with correlation IDs
  - Mask sensitive data (tokens, passwords) in logs
  - Add log levels based on environment

#### 5.2 Metrics Collection
- **Files to Create/Modify**:
  - `src/middleware/metrics.js` - Metrics collection middleware
  - `src/services/metricsService.js` - Prometheus metrics exporter
  
- **Implementation Details**:
  - Collect metrics: request count, latency, error rate
  - Expose Prometheus metrics endpoint
  - Add custom metrics for business logic
  - Implement dashboard templates for Grafana

#### 5.3 Error Rate Monitoring
- **Files to Create/Modify**:
  - `src/middleware/errorTracking.js` - Error tracking middleware
  
- **Implementation Details**:
  - Track error rates by service and endpoint
  - Integrate with error tracking service (Sentry, New Relic)
  - Add alerting for error rate thresholds
  - Implement error categorization

---

### Phase 6: Message Queue Integration (Priority: MEDIUM)
**Duration**: 2 weeks

#### 6.1 RabbitMQ Integration
- **Files to Create/Modify**:
  - `src/services/queueService.js` - RabbitMQ publisher/consumer
  - `src/config/rabbitmq.config.js` - Queue configuration
  
- **Implementation Details**:
  - Integrate with existing RabbitMQ infrastructure
  - Publish webhook events to queues for async processing
  - Implement message persistence during service outages
  - Add dead letter queue handling

#### 6.2 Message Ordering & Sequencing
- **Files to Create/Modify**:
  - `src/services/sequencingService.js` - Message sequencing logic
  
- **Implementation Details**:
  - Ensure FIFO ordering for messages per conversation
  - Implement sequence number tracking
  - Handle out-of-order message detection
  - Add message buffering for ordering

---

### Phase 7: Enhanced Security (Priority: LOW)
**Duration**: 1 week

#### 7.1 IP Whitelisting
- **Files to Create/Modify**:
  - `src/middleware/ipWhitelist.js` - IP filtering middleware
  
- **Implementation Details**:
  - Maintain whitelist of Meta and Genesys IP ranges
  - Add dynamic IP whitelist updates
  - Implement geo-blocking if needed

#### 7.2 CORS Configuration
- **Files to Modify**:
  - `src/server.js` - Update CORS settings
  
- **Implementation Details**:
  - Configure CORS for agent portal and admin dashboard
  - Implement tenant-specific CORS policies
  - Add preflight request optimization

---

## Dependencies & Prerequisites

### External Dependencies Required
```json
{
  "opossum": "^7.0.0",          // Circuit breaker
  "joi": "^17.0.0",             // Schema validation
  "winston": "^3.11.0",         // Structured logging
  "prom-client": "^15.0.0",     // Prometheus metrics
  "amqplib": "^0.10.3",         // RabbitMQ client
  "opentelemetry": "^1.17.0",   // Distributed tracing
  "helmet": "^7.1.0"            // Security headers
}
```

### Service Dependencies
- **auth-service**: For JWT token validation
- **tenant-service**: For tenant configuration retrieval
- **RabbitMQ**: Message queue infrastructure
- **Redis**: Caching and rate limiting
- **PostgreSQL**: Audit logs and metrics storage

---

## Verification Plan

### Automated Tests

#### Unit Tests
```bash
# Run from /services/api-gateway
npm test
```

**Test Coverage Requirements**:
- Middleware functions (auth, validation, circuit breaker): 90%
- Service integrations: 80%
- Error handling: 100%

#### Integration Tests
```bash
# Run from /services/api-gateway
npm run test:integration
```

**Test Scenarios**:
1. JWT token validation with auth-service
2. Webhook signature verification (WhatsApp & Genesys)
3. Circuit breaker state transitions
4. Multi-tenant routing logic
5. Rate limiting per tenant
6. Message queue publishing

#### Load Testing
```bash
# Using Apache Bench or k6
k6 run scripts/load-test.js
```

**Test Scenarios**:
- Concurrent webhook processing (1000 req/s)
- Rate limiting effectiveness
- Circuit breaker under load
- Redis cache performance

---

### Manual Verification

#### 1. Authentication Flow
1. Generate JWT token from auth-service
2. Send request to protected endpoint with token
3. Verify tenant context is correctly extracted
4. Test with invalid/expired token - should return 401

#### 2. Webhook Security
1. Send WhatsApp webhook with valid signature
2. Send webhook with invalid signature - should return 403
3. Verify IP whitelisting (use VPN to test blocking)
4. Test replay attack prevention with old timestamp

#### 3. Circuit Breaker
1. Stop downstream service (e.g., state-manager)
2. Send requests - verify circuit opens after threshold
3. Verify fallback responses are returned
4. Restart service - verify circuit closes after health checks

#### 4. Multi-tenant Routing
1. Send requests with different tenant IDs
2. Verify correct tenant configurations are loaded
3. Test tenant-specific rate limits
4. Verify tenant isolation (no data leakage)

#### 5. Monitoring & Metrics
1. Access Prometheus metrics endpoint: `http://localhost:3000/metrics`
2. Verify metrics are being collected (request count, latency)
3. Trigger errors - verify error rate metrics update
4. Check structured logs for correlation IDs

---

## Rollback Strategy

### Per-Phase Rollback
- Each phase is feature-flagged in `src/config/features.config.js`
- Disable feature flags to rollback without code changes
- Maintain backward compatibility for 2 versions

### Database Migrations
- No schema changes required for API Gateway
- Redis cache can be flushed without data loss

### Deployment Strategy
- Blue-green deployment for zero downtime
- Canary deployment for high-risk phases (Circuit Breaker, Auth)
- Rollback triggers: Error rate > 5%, Latency > 2s

---

## Post-Implementation Tasks

1. **Documentation Updates**
   - Update API documentation in `docs/openapi.yaml`
   - Create runbook for operations team
   - Document troubleshooting guides

2. **Performance Optimization**
   - Optimize Redis cache hit rates
   - Fine-tune circuit breaker thresholds
   - Optimize rate limiter performance

3. **Security Audit**
   - Conduct penetration testing
   - Review authentication flows
   - Audit logging and compliance

4. **Monitoring Setup**
   - Configure Grafana dashboards
   - Set up alerting rules
   - Create SLO/SLA tracking
