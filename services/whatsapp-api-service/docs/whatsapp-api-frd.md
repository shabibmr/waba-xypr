# Functional Requirements Document: WhatsApp API Service

**Document Version:** 2.0 (LLM-Optimized)  
**Service Name:** `whatsapp-api-service`  
**Service Type:** Outbound Message Gateway  
**Parent Document:** System Design Document  
**Last Updated:** 2024-02-12

---

## 1. EXECUTIVE SUMMARY

### 1.1 Service Purpose
The WhatsApp API Service is a microservice that acts as the **egress gateway** to Meta's Cloud API (Graph API). It consumes pre-formatted WhatsApp messages from an internal queue and delivers them to customers via Meta's infrastructure.

### 1.2 Service Boundaries
- **Input Boundary:** RabbitMQ queue `outbound-processed` (messages already transformed to Meta format)
- **Output Boundary:** Meta Graph API (HTTPS POST requests)
- **Dependencies:** Tenant Service (credentials), RabbitMQ (message broker)

### 1.3 Key Metrics
- **Target Throughput:** 50 messages/second
- **Meta API Rate Limit:** 80 messages/second (Tier 2 WABA)
- **Retry Strategy:** Exponential backoff with jitter
- **Tenant Isolation:** Required (one tenant's failure must not affect others)

---

## 2. ARCHITECTURE OVERVIEW

### 2.1 Service Components

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────┐
│   RabbitMQ      │────────>│  WhatsApp API        │────────>│  Meta Graph │
│   (outbound-    │         │  Service             │         │  API        │
│   processed)    │         │                      │         │             │
└─────────────────┘         │  - Consumer          │         └─────────────┘
                            │  - Auth Handler      │               │
                            │  - HTTP Client       │               │
                            │  - Error Handler     │               │
                            └──────────────────────┘               │
                                      │                             │
                                      │ Fetch Credentials           │
                                      v                             │
                            ┌──────────────────────┐               │
                            │  Tenant Service      │               │
                            │  /tenants/:id/       │               │
                            │  credentials         │               │
                            └──────────────────────┘               │
                                                                    │
                            ┌──────────────────────┐               │
                            │  Logging/Monitoring  │<──────────────┘
                            │  - Success/Failure   │
                            │  - Latency Metrics   │
                            └──────────────────────┘
```

### 2.2 Technology Stack Requirements
- **Language:** Node.js (TypeScript preferred) or Python
- **Message Broker Client:** `amqplib` (Node.js) or `pika` (Python)
- **HTTP Client:** `axios` (Node.js) or `requests` (Python)
- **Configuration:** Environment variables + Config service (optional)
- **Logging:** Structured JSON logging (Winston/Bunyan for Node, structlog for Python)
- **Monitoring:** Prometheus metrics + Health check endpoint

---

## 3. DATA CONTRACTS

### 3.1 Input Message Schema (from RabbitMQ)

**Queue Name:** `outbound-processed`  
**Exchange:** `whatsapp-exchange` (topic exchange)  
**Routing Key Pattern:** `outbound.processed.{tenantId}`

#### 3.1.1 Message Envelope Structure
```json
{
  "metadata": {
    "tenantId": "string (UUID v4, required)",
    "phoneNumberId": "string (Meta WABA Phone Number ID, required)",
    "internalId": "string (UUID v4, required, for tracing)",
    "timestamp": "string (ISO 8601, required)",
    "priority": "number (0-10, optional, default: 5)",
    "retryCount": "number (optional, default: 0)"
  },
  "wabaPayload": {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "string (E.164 format, required)",
    "type": "string (text|template|image|document|video|audio|location|contacts|interactive)",
    "...": "additional fields based on message type"
  }
}
```

#### 3.1.2 Example: Text Message
```json
{
  "metadata": {
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "phoneNumberId": "100000001",
    "internalId": "msg-12345-67890",
    "timestamp": "2024-02-12T10:30:00.000Z",
    "priority": 5,
    "retryCount": 0
  },
  "wabaPayload": {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "919876543210",
    "type": "text",
    "text": {
      "body": "Hello from Genesys Support. How can we help you today?"
    }
  }
}
```

#### 3.1.3 Example: Template Message
```json
{
  "metadata": {
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "phoneNumberId": "100000001",
    "internalId": "msg-template-98765",
    "timestamp": "2024-02-12T10:35:00.000Z"
  },
  "wabaPayload": {
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "template",
    "template": {
      "name": "order_confirmation",
      "language": {
        "code": "en"
      },
      "components": [
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "text": "John Doe"
            },
            {
              "type": "text",
              "text": "ORD-12345"
            }
          ]
        }
      ]
    }
  }
}
```

#### 3.1.4 Example: Media Message (Image)
```json
{
  "metadata": {
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "phoneNumberId": "100000001",
    "internalId": "msg-media-55555"
  },
  "wabaPayload": {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "919876543210",
    "type": "image",
    "image": {
      "link": "https://cdn.example.com/images/product-123.jpg",
      "caption": "Your requested product image"
    }
  }
}
```

### 3.2 Tenant Credentials Schema (from Tenant Service)

**Endpoint:** `GET /api/v1/tenants/{tenantId}/credentials?type=whatsapp`  
**Authentication:** Internal service token (JWT or API key)

#### 3.2.1 Response Structure
```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "credentialType": "whatsapp",
  "credentials": {
    "systemUserAccessToken": "string (encrypted or plaintext, 200+ chars)",
    "phoneNumberId": "string (Meta WABA Phone Number ID)",
    "businessAccountId": "string (Meta WABA ID, optional)",
    "wabaProfile": {
      "displayName": "string (optional)",
      "about": "string (optional)",
      "tier": "string (optional, e.g., 'tier_2')"
    },
    "rateLimits": {
      "messagesPerSecond": 80,
      "messagesPerDay": 100000
    }
  },
  "status": "active|suspended|expired",
  "expiresAt": "string (ISO 8601, token expiration)",
  "lastValidated": "string (ISO 8601)"
}
```

#### 3.2.2 Error Responses
```json
// 404 Not Found
{
  "error": {
    "code": "TENANT_NOT_FOUND",
    "message": "Tenant with ID {tenantId} does not exist"
  }
}

// 403 Forbidden
{
  "error": {
    "code": "CREDENTIALS_SUSPENDED",
    "message": "WhatsApp credentials for tenant {tenantId} are suspended"
  }
}

// 500 Internal Server Error
{
  "error": {
    "code": "DECRYPTION_FAILED",
    "message": "Failed to decrypt tenant credentials"
  }
}
```

### 3.3 Meta Graph API Contract

**Base URL:** `https://graph.facebook.com/v18.0`  
**Endpoint:** `POST /{phone_number_id}/messages`  
**Authentication:** Bearer token (System User Access Token)

#### 3.3.1 Request Headers
```
Authorization: Bearer {systemUserAccessToken}
Content-Type: application/json
User-Agent: whatsapp-api-service/1.1
```

#### 3.3.2 Request Body
The `wabaPayload` from the input message (see Section 3.1).

#### 3.3.3 Success Response (200 OK)
```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "919876543210",
      "wa_id": "919876543210"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBgNMTIzNDU2Nzg5MAUCABEYEjRFNkY3ODlBQkNERUYwMTIA"
    }
  ]
}
```

**Key Fields:**
- `messages[0].id`: The WhatsApp Message ID (WAMID) - **MUST be logged for tracking**

#### 3.3.4 Error Responses

##### 400 Bad Request
```json
{
  "error": {
    "message": "Invalid parameter",
    "type": "OAuthException",
    "code": 100,
    "error_data": {
      "messaging_product": "whatsapp",
      "details": "Parameter 'to' is invalid"
    },
    "error_subcode": 2388003,
    "fbtrace_id": "AXYZabcdef123456"
  }
}
```

**Common 400 Error Subcodes:**
- `2388003`: Invalid phone number format
- `2388001`: Template does not exist
- `2388002`: Template parameter mismatch
- `2388005`: Media download failed
- `2388009`: Recipient not on WhatsApp

##### 401 Unauthorized
```json
{
  "error": {
    "message": "Invalid OAuth access token",
    "type": "OAuthException",
    "code": 190,
    "fbtrace_id": "AXYZabcdef123456"
  }
}
```

##### 403 Forbidden
```json
{
  "error": {
    "message": "Phone number not registered",
    "type": "OAuthException",
    "code": 10,
    "error_subcode": 2388054,
    "fbtrace_id": "AXYZabcdef123456"
  }
}
```

##### 429 Rate Limit Exceeded
```json
{
  "error": {
    "message": "Too many messages sent from this phone number",
    "type": "OAuthException",
    "code": 4,
    "error_subcode": 2388104,
    "fbtrace_id": "AXYZabcdef123456"
  }
}
```

##### Meta Error Code: 131047 (24-Hour Window Expired)
```json
{
  "error": {
    "message": "User's phone number is not part of the allowed list",
    "type": "OAuthException",
    "code": 131047,
    "error_data": {
      "messaging_product": "whatsapp",
      "details": "Recipient phone number not currently opted in"
    },
    "fbtrace_id": "AXYZabcdef123456"
  }
}
```

**Note:** Error code `131047` can also indicate the 24-hour customer service window has expired.

---

## 4. FUNCTIONAL REQUIREMENTS

### 4.1 Message Consumption (REQ-OUT-01)

**Requirement ID:** `REQ-OUT-01`  
**Priority:** CRITICAL  
**Owner:** WhatsApp API Service

#### 4.1.1 Description
The service MUST continuously consume messages from the RabbitMQ queue `outbound-processed`.

#### 4.1.2 Acceptance Criteria
1. Consumer establishes connection to RabbitMQ on service startup
2. Consumer prefetch count set to `10` (configurable)
3. Consumer acknowledges messages only after successful processing or permanent failure
4. Consumer handles connection failures with automatic reconnection (exponential backoff)
5. Consumer processes messages in FIFO order per routing key (per tenant)

#### 4.1.3 Configuration Parameters
```yaml
rabbitmq:
  host: "rabbitmq.internal.svc.cluster.local"
  port: 5672
  username: "${RABBITMQ_USER}"
  password: "${RABBITMQ_PASSWORD}"
  vhost: "/whatsapp"
  queue: "outbound-processed"
  exchange: "whatsapp-exchange"
  prefetchCount: 10
  reconnectDelay: 5000  # milliseconds
  maxReconnectAttempts: 10
```

#### 4.1.4 Error Handling
- **Connection Failure:** Retry with exponential backoff (5s, 10s, 20s, 40s, max 60s)
- **Channel Error:** Recreate channel, log error, alert operations
- **Parse Error:** Log error, NACK message without requeue (dead letter)

#### 4.1.5 Implementation Pseudocode
```typescript
async function startConsumer() {
  const connection = await connectToRabbitMQ();
  const channel = await connection.createChannel();
  
  await channel.assertQueue('outbound-processed', { durable: true });
  await channel.prefetch(config.prefetchCount);
  
  channel.consume('outbound-processed', async (msg) => {
    if (!msg) return;
    
    try {
      const payload = JSON.parse(msg.content.toString());
      await processMessage(payload);
      channel.ack(msg);
    } catch (error) {
      if (error instanceof ParseError) {
        // Permanent failure - don't requeue
        channel.nack(msg, false, false);
      } else if (error instanceof RetryableError) {
        // Temporary failure - requeue
        channel.nack(msg, false, true);
      } else {
        // Unknown error - log and decide based on error type
        handleUnknownError(error, msg, channel);
      }
    }
  });
}
```

---

### 4.2 Credential Retrieval (REQ-AUTH-01)

**Requirement ID:** `REQ-AUTH-01`  
**Priority:** CRITICAL  
**Owner:** WhatsApp API Service

#### 4.2.1 Description
For each message, the service MUST retrieve valid WhatsApp Business API credentials for the tenant.

#### 4.2.2 Acceptance Criteria
1. Service calls Tenant Service API: `GET /api/v1/tenants/{tenantId}/credentials?type=whatsapp`
2. Response includes System User Access Token and Phone Number ID
3. Credentials are cached in-memory with TTL (15 minutes default)
4. Cache is invalidated on 401/403 errors from Meta
5. Failed credential fetch results in message NACK with requeue

#### 4.2.3 Caching Strategy
```typescript
interface CredentialCache {
  [tenantId: string]: {
    token: string;
    phoneNumberId: string;
    cachedAt: number;
    ttl: number;  // milliseconds
  }
}

async function getCredentials(tenantId: string): Promise<Credentials> {
  const cached = cache[tenantId];
  
  if (cached && Date.now() - cached.cachedAt < cached.ttl) {
    return { token: cached.token, phoneNumberId: cached.phoneNumberId };
  }
  
  // Fetch from Tenant Service
  const credentials = await fetchFromTenantService(tenantId);
  
  // Cache for 15 minutes
  cache[tenantId] = {
    token: credentials.systemUserAccessToken,
    phoneNumberId: credentials.phoneNumberId,
    cachedAt: Date.now(),
    ttl: 15 * 60 * 1000
  };
  
  return credentials;
}
```

#### 4.2.4 Configuration Parameters
```yaml
tenantService:
  baseUrl: "http://tenant-service.internal.svc.cluster.local:8080"
  endpoint: "/api/v1/tenants/{tenantId}/credentials"
  timeout: 5000  # milliseconds
  retryAttempts: 3
  retryDelay: 1000  # milliseconds
  credentialCacheTTL: 900000  # 15 minutes in milliseconds
```

#### 4.2.5 Error Scenarios
| Error Type | HTTP Code | Action |
|------------|-----------|--------|
| Tenant Not Found | 404 | Log error, NACK without requeue (dead letter) |
| Credentials Suspended | 403 | Log warning, NACK without requeue, alert ops |
| Service Timeout | 408/504 | Log error, NACK with requeue (retry) |
| Internal Server Error | 500 | Log error, NACK with requeue (retry) |

---

### 4.3 Message Delivery to Meta (REQ-OUT-02)

**Requirement ID:** `REQ-OUT-02`  
**Priority:** CRITICAL  
**Owner:** WhatsApp API Service

#### 4.3.1 Description
The service MUST send WhatsApp messages to Meta's Graph API using the credentials retrieved in REQ-AUTH-01.

#### 4.3.2 HTTP Request Specification

**Method:** `POST`  
**URL:** `https://graph.facebook.com/v18.0/{phoneNumberId}/messages`

**Headers:**
```
Authorization: Bearer {systemUserAccessToken}
Content-Type: application/json
User-Agent: whatsapp-api-service/1.1
X-Tenant-ID: {tenantId}  # Custom header for logging
X-Internal-Message-ID: {internalId}  # Custom header for tracing
```

**Request Body:**
```json
{wabaPayload}  // From input message (Section 3.1)
```

**Timeout:** 10 seconds (configurable)

#### 4.3.3 Implementation Requirements
1. Use connection pooling (max 100 connections per tenant)
2. Enable HTTP keep-alive
3. Retry on network errors (max 3 retries with exponential backoff)
4. Log full request/response for debugging (sanitize tokens in logs)

#### 4.3.4 Success Handling (200 OK)
```typescript
async function handleSuccess(response: MetaApiResponse, internalId: string) {
  const wamid = response.messages[0].id;
  
  logger.info({
    event: 'message_delivered',
    internalId,
    wamid,
    recipient: response.contacts[0].wa_id,
    timestamp: new Date().toISOString()
  });
  
  // Emit metric
  metrics.increment('messages.delivered', { tenant: tenantId });
  
  // Acknowledge RabbitMQ message
  channel.ack(originalMessage);
}
```

#### 4.3.5 Configuration Parameters
```yaml
metaApi:
  baseUrl: "https://graph.facebook.com"
  version: "v18.0"
  timeout: 10000  # milliseconds
  maxRetries: 3
  retryDelay: 1000  # milliseconds, with exponential backoff
  connectionPoolSize: 100
  keepAliveTimeout: 60000  # milliseconds
```

---

### 4.4 Error Handling (REQ-ERR-01)

**Requirement ID:** `REQ-ERR-01`  
**Priority:** CRITICAL  
**Owner:** WhatsApp API Service

#### 4.4.1 Description
The service MUST handle all Meta API errors according to the error type and implement appropriate retry logic.

#### 4.4.2 Error Classification Matrix

| HTTP Code | Error Code | Error Subcode | Error Type | Description | Retry? | Action |
|-----------|------------|---------------|------------|-------------|--------|--------|
| 200 | - | - | SUCCESS | Message delivered | N/A | ACK, log WAMID |
| 400 | 100 | 2388003 | INVALID_PARAM | Invalid phone number | NO | ACK, log error, alert |
| 400 | 100 | 2388001 | TEMPLATE_NOT_FOUND | Template doesn't exist | NO | ACK, log error, alert |
| 400 | 100 | 2388002 | TEMPLATE_PARAM_MISMATCH | Wrong template params | NO | ACK, log error |
| 400 | 100 | 2388005 | MEDIA_DOWNLOAD_FAILED | Cannot download media | YES (1x) | NACK with requeue |
| 400 | 100 | 2388009 | RECIPIENT_NOT_ON_WHATSAPP | User not on WhatsApp | NO | ACK, log info |
| 400 | 131047 | - | WINDOW_EXPIRED | 24h session window expired | NO | ACK, log warning, notify Genesys |
| 401 | 190 | - | INVALID_TOKEN | Token expired/invalid | YES (1x) | Invalidate cache, NACK, alert |
| 403 | 10 | 2388054 | PHONE_NOT_REGISTERED | Phone number not registered | NO | ACK, log critical, alert ops |
| 429 | 4 | 2388104 | RATE_LIMIT | Too many messages | YES | NACK with delay, backpressure |
| 500 | - | - | META_SERVER_ERROR | Meta service down | YES | NACK with exponential backoff |
| 502/503/504 | - | - | META_UNAVAILABLE | Meta temporarily unavailable | YES | NACK with exponential backoff |
| - | - | - | NETWORK_ERROR | Connection timeout/refused | YES | NACK with exponential backoff |

#### 4.4.3 Retry Strategy

##### Retryable Errors
- 500, 502, 503, 504 (Meta server errors)
- Network timeouts
- 401/403 (auth errors - retry once after cache invalidation)
- 429 (rate limit - retry with backoff)

##### Non-Retryable Errors
- 400 with client error subcodes (invalid params, template errors)
- 131047 (window expired)
- 403 (phone not registered)

##### Exponential Backoff Algorithm
```typescript
function calculateBackoff(attempt: number, baseDelay: number = 1000): number {
  const maxDelay = 60000; // 1 minute
  const jitter = Math.random() * 1000;
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay + jitter;
}

// Example:
// Attempt 1: 1000ms + jitter
// Attempt 2: 2000ms + jitter
// Attempt 3: 4000ms + jitter
// Attempt 4: 8000ms + jitter
// Attempt 5: 16000ms + jitter
// Attempt 6+: 60000ms + jitter
```

#### 4.4.4 Error Handling Implementation

```typescript
async function handleMetaApiError(
  error: MetaApiError,
  message: RabbitMQMessage,
  retryCount: number
): Promise<void> {
  const errorCode = error.error?.code;
  const errorSubcode = error.error?.error_subcode;
  const httpStatus = error.httpStatus;
  
  // Log structured error
  logger.error({
    event: 'meta_api_error',
    internalId: message.metadata.internalId,
    tenantId: message.metadata.tenantId,
    httpStatus,
    errorCode,
    errorSubcode,
    errorMessage: error.error?.message,
    fbtrace: error.error?.fbtrace_id,
    retryCount
  });
  
  // Classify error
  if (isNonRetryableError(errorCode, errorSubcode, httpStatus)) {
    // Permanent failure - don't retry
    channel.ack(message);
    
    // Special handling for specific errors
    if (errorCode === 131047) {
      await notifyGenesysSessionExpired(message);
    }
    
    if (errorSubcode === 2388001) {
      await alertTemplateNotFound(message);
    }
    
  } else if (isAuthError(errorCode)) {
    // Auth error - invalidate cache and retry once
    await invalidateCredentialCache(message.metadata.tenantId);
    
    if (retryCount === 0) {
      await requeueMessage(message, 5000); // 5 second delay
    } else {
      channel.ack(message); // Already retried once
      await alertAuthFailure(message);
    }
    
  } else if (isRateLimitError(errorCode, errorSubcode)) {
    // Rate limit - apply backpressure
    const delayMs = calculateBackoff(retryCount, 10000); // Start at 10s
    await requeueMessage(message, delayMs);
    await applyBackpressure(message.metadata.tenantId);
    
  } else if (isServerError(httpStatus)) {
    // Meta server error - retry with exponential backoff
    const maxRetries = 5;
    
    if (retryCount < maxRetries) {
      const delayMs = calculateBackoff(retryCount);
      await requeueMessage(message, delayMs);
    } else {
      // Max retries exceeded
      channel.ack(message);
      await alertMaxRetriesExceeded(message);
    }
    
  } else {
    // Unknown error - log and treat as non-retryable
    channel.ack(message);
    await alertUnknownError(message, error);
  }
}
```

#### 4.4.5 Dead Letter Queue Configuration
```yaml
rabbitmq:
  deadLetterExchange: "whatsapp-dlx"
  deadLetterQueue: "outbound-failed"
  deadLetterRoutingKey: "outbound.failed"
  messageTTL: 86400000  # 24 hours before message expires
```

---

### 4.5 Tenant Isolation (REQ-ISO-01)

**Requirement ID:** `REQ-ISO-01`  
**Priority:** HIGH  
**Owner:** WhatsApp API Service

#### 4.5.1 Description
Failures for one tenant MUST NOT impact message delivery for other tenants.

#### 4.5.2 Acceptance Criteria
1. Each tenant's credentials are cached independently
2. Rate limiting is applied per tenant (not globally)
3. Errors for one tenant do not block queue consumption
4. Per-tenant circuit breakers prevent cascading failures

#### 4.5.3 Per-Tenant Circuit Breaker
```typescript
interface CircuitBreaker {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  threshold: number;
  timeout: number;
}

const circuitBreakers: Map<string, CircuitBreaker> = new Map();

async function sendMessageWithCircuitBreaker(
  tenantId: string,
  message: Message
): Promise<void> {
  const breaker = getOrCreateCircuitBreaker(tenantId);
  
  if (breaker.state === 'OPEN') {
    const now = Date.now();
    if (now - breaker.lastFailureTime > breaker.timeout) {
      breaker.state = 'HALF_OPEN';
    } else {
      throw new CircuitBreakerOpenError(
        `Circuit breaker open for tenant ${tenantId}`
      );
    }
  }
  
  try {
    await sendToMeta(message);
    
    // Success - reset breaker
    breaker.failureCount = 0;
    breaker.state = 'CLOSED';
    
  } catch (error) {
    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();
    
    if (breaker.failureCount >= breaker.threshold) {
      breaker.state = 'OPEN';
      logger.warn({
        event: 'circuit_breaker_opened',
        tenantId,
        failureCount: breaker.failureCount
      });
    }
    
    throw error;
  }
}

function getOrCreateCircuitBreaker(tenantId: string): CircuitBreaker {
  if (!circuitBreakers.has(tenantId)) {
    circuitBreakers.set(tenantId, {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      threshold: 5,  // Open after 5 consecutive failures
      timeout: 60000  // Try again after 1 minute
    });
  }
  return circuitBreakers.get(tenantId)!;
}
```

#### 4.5.4 Per-Tenant Rate Limiting
```typescript
interface RateLimiter {
  tokens: number;
  maxTokens: number;
  refillRate: number;  // tokens per second
  lastRefill: number;
}

const rateLimiters: Map<string, RateLimiter> = new Map();

async function checkRateLimit(tenantId: string): Promise<boolean> {
  const limiter = getOrCreateRateLimiter(tenantId);
  const now = Date.now();
  
  // Refill tokens based on time elapsed
  const elapsed = (now - limiter.lastRefill) / 1000;
  const tokensToAdd = elapsed * limiter.refillRate;
  limiter.tokens = Math.min(limiter.tokens + tokensToAdd, limiter.maxTokens);
  limiter.lastRefill = now;
  
  if (limiter.tokens >= 1) {
    limiter.tokens -= 1;
    return true;
  }
  
  return false;
}

function getOrCreateRateLimiter(tenantId: string): RateLimiter {
  if (!rateLimiters.has(tenantId)) {
    rateLimiters.set(tenantId, {
      tokens: 80,  // Start with full bucket
      maxTokens: 80,  // Meta Tier 2 limit
      refillRate: 80 / 60,  // 80 messages per minute = 1.33/sec
      lastRefill: Date.now()
    });
  }
  return rateLimiters.get(tenantId)!;
}
```

---

## 5. NON-FUNCTIONAL REQUIREMENTS

### 5.1 Performance (NFR-PERF-01)

#### 5.1.1 Throughput
- **Target:** 50 messages/second (aggregate across all tenants)
- **Peak:** 100 messages/second (burst capacity)
- **Per Tenant:** Dynamically limited based on Meta API tier

#### 5.1.2 Latency
- **Message Processing Time:** < 500ms (p95)
- **Meta API Response Time:** < 2 seconds (p95)
- **End-to-End Latency:** < 3 seconds (queue → Meta confirmation)

#### 5.1.3 Resource Limits
```yaml
resources:
  cpu: "2 cores"
  memory: "2Gi"
  maxConnections: 100
  maxConcurrentRequests: 50
```

---

### 5.2 Reliability (NFR-REL-01)

#### 5.2.1 Availability
- **Target SLA:** 99.9% uptime
- **Max Downtime:** 43 minutes per month
- **Recovery Time:** < 5 minutes (auto-restart)

#### 5.2.2 Durability
- **Message Loss:** Zero message loss (at-least-once delivery)
- **Data Persistence:** RabbitMQ messages persisted to disk
- **Backup:** Logs retained for 30 days

---

### 5.3 Observability (NFR-OBS-01)

#### 5.3.1 Metrics to Expose (Prometheus)
```typescript
// Counter metrics
metrics.counter('messages.consumed.total', { tenant, status })
metrics.counter('messages.delivered.total', { tenant })
metrics.counter('messages.failed.total', { tenant, error_code })
metrics.counter('meta_api.requests.total', { tenant, status_code })

// Histogram metrics
metrics.histogram('message.processing.duration', { tenant })
metrics.histogram('meta_api.request.duration', { tenant })
metrics.histogram('credential.fetch.duration', { tenant })

// Gauge metrics
metrics.gauge('rabbitmq.queue.depth', { queue: 'outbound-processed' })
metrics.gauge('tenant.circuit_breaker.state', { tenant, state })
metrics.gauge('tenant.rate_limit.available', { tenant })
```

#### 5.3.2 Logging Requirements
```typescript
// Structured logging format (JSON)
interface LogEntry {
  timestamp: string;  // ISO 8601
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  service: 'whatsapp-api-service';
  version: string;
  event: string;
  tenantId?: string;
  internalId?: string;
  wamid?: string;
  duration?: number;
  errorCode?: string;
  errorMessage?: string;
  fbtrace?: string;
  [key: string]: any;
}

// Example log entries
logger.info({
  event: 'message_consumed',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  internalId: 'msg-12345',
  messageType: 'text'
});

logger.error({
  event: 'meta_api_error',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  internalId: 'msg-12345',
  errorCode: 131047,
  errorMessage: 'Session expired',
  fbtrace: 'AXYZabcdef123456',
  retryCount: 0
});
```

#### 5.3.3 Health Check Endpoint
```
GET /health

Response:
{
  "status": "healthy" | "degraded" | "unhealthy",
  "version": "1.1.0",
  "uptime": 86400,  // seconds
  "checks": {
    "rabbitmq": {
      "status": "connected",
      "latency": 5  // milliseconds
    },
    "tenantService": {
      "status": "reachable",
      "latency": 12  // milliseconds
    },
    "metaApi": {
      "status": "reachable",
      "latency": 150  // milliseconds
    }
  },
  "metrics": {
    "messagesProcessedLast1Min": 42,
    "errorRateLast1Min": 0.02,  // 2%
    "queueDepth": 10
  }
}
```

---

### 5.4 Security (NFR-SEC-01)

#### 5.4.1 Token Handling
- **Storage:** Tokens MUST NOT be logged in plaintext
- **Transmission:** HTTPS only for all external communications
- **Caching:** In-memory cache only (no disk persistence)

#### 5.4.2 Log Sanitization
```typescript
function sanitizeLog(obj: any): any {
  const sensitive = ['token', 'accessToken', 'systemUserAccessToken', 'password'];
  
  return Object.keys(obj).reduce((acc, key) => {
    if (sensitive.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      acc[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object') {
      acc[key] = sanitizeLog(obj[key]);
    } else {
      acc[key] = obj[key];
    }
    return acc;
  }, {} as any);
}
```

---

## 6. TESTING REQUIREMENTS

### 6.1 Unit Tests

#### 6.1.1 Test Coverage Requirements
- **Minimum Coverage:** 80%
- **Critical Paths:** 100% (message processing, error handling)

#### 6.1.2 Test Scenarios
```typescript
describe('Message Processing', () => {
  test('should successfully send text message to Meta API', async () => {
    // Arrange
    const mockMessage = createMockTextMessage();
    const mockCredentials = createMockCredentials();
    
    // Act
    const result = await processMessage(mockMessage);
    
    // Assert
    expect(result.status).toBe('delivered');
    expect(result.wamid).toBeDefined();
  });
  
  test('should handle template not found error (2388001)', async () => {
    // Arrange
    const mockMessage = createMockTemplateMessage();
    metaApiMock.mockRejectedValue(createMetaError(100, 2388001));
    
    // Act
    await processMessage(mockMessage);
    
    // Assert
    expect(channelMock.ack).toHaveBeenCalledWith(mockMessage);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errorSubcode: 2388001 })
    );
  });
  
  test('should retry on 500 error with exponential backoff', async () => {
    // Arrange
    const mockMessage = createMockTextMessage();
    metaApiMock
      .mockRejectedValueOnce(createMetaError(500))
      .mockResolvedValueOnce({ messages: [{ id: 'wamid.123' }] });
    
    // Act
    await processMessage(mockMessage);
    
    // Assert
    expect(metaApiMock).toHaveBeenCalledTimes(2);
    expect(channelMock.ack).toHaveBeenCalledWith(mockMessage);
  });
  
  test('should invalidate cache on 401 error', async () => {
    // Arrange
    const mockMessage = createMockTextMessage();
    metaApiMock.mockRejectedValue(createMetaError(190));
    
    // Act
    await processMessage(mockMessage);
    
    // Assert
    expect(credentialCache.invalidate).toHaveBeenCalledWith(
      mockMessage.metadata.tenantId
    );
  });
});
```

---

### 6.2 Integration Tests

#### 6.2.1 Test Scenarios
1. **End-to-End Message Delivery**
   - Publish message to RabbitMQ
   - Verify Meta API receives correct payload
   - Verify message acknowledged

2. **Credential Retrieval**
   - Mock Tenant Service responses
   - Verify caching behavior
   - Verify cache invalidation on errors

3. **Error Handling**
   - Simulate various Meta API errors
   - Verify correct retry/no-retry behavior
   - Verify DLQ routing

4. **Rate Limiting**
   - Send burst of messages for one tenant
   - Verify rate limit enforcement
   - Verify other tenants unaffected

---

### 6.3 Load Tests

#### 6.3.1 Test Parameters
```yaml
loadTest:
  duration: "10m"
  rampUp: "1m"
  tenants: 10
  messagesPerSecond: 50
  messageTypes:
    - text: 70%
    - template: 20%
    - media: 10%
```

#### 6.3.2 Success Criteria
- **Throughput:** Sustain 50 msg/s for 10 minutes
- **Error Rate:** < 1%
- **Latency (p95):** < 3 seconds
- **Memory:** Stable (no leaks)
- **CPU:** < 80% utilization

---

## 7. DEPLOYMENT SPECIFICATIONS

### 7.1 Environment Variables
```bash
# Service Configuration
NODE_ENV=production
SERVICE_PORT=8080
LOG_LEVEL=info

# RabbitMQ
RABBITMQ_HOST=rabbitmq.internal.svc.cluster.local
RABBITMQ_PORT=5672
RABBITMQ_USER=whatsapp-service
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD}  # From secret
RABBITMQ_VHOST=/whatsapp
RABBITMQ_QUEUE=outbound-processed
RABBITMQ_PREFETCH=10

# Tenant Service
TENANT_SERVICE_URL=http://tenant-service.internal.svc.cluster.local:8080
TENANT_SERVICE_TIMEOUT=5000

# Meta API
META_API_BASE_URL=https://graph.facebook.com
META_API_VERSION=v18.0
META_API_TIMEOUT=10000
META_API_MAX_RETRIES=3

# Caching
CREDENTIAL_CACHE_TTL=900000  # 15 minutes

# Observability
PROMETHEUS_PORT=9090
HEALTH_CHECK_PORT=8081
```

### 7.2 Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whatsapp-api-service
  namespace: whatsapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: whatsapp-api-service
  template:
    metadata:
      labels:
        app: whatsapp-api-service
    spec:
      containers:
      - name: whatsapp-api-service
        image: whatsapp-api-service:1.1.0
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        - containerPort: 8081
          name: health
        env:
        - name: NODE_ENV
          value: "production"
        - name: RABBITMQ_PASSWORD
          valueFrom:
            secretKeyRef:
              name: rabbitmq-credentials
              key: password
        resources:
          requests:
            cpu: "1"
            memory: "1Gi"
          limits:
            cpu: "2"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8081
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8081
          initialDelaySeconds: 10
          periodSeconds: 5
```

---

## 8. MONITORING AND ALERTS

### 8.1 Critical Alerts

#### 8.1.1 Service Down
```yaml
alert: ServiceDown
expr: up{job="whatsapp-api-service"} == 0
for: 1m
severity: critical
message: "WhatsApp API Service is down"
```

#### 8.1.2 High Error Rate
```yaml
alert: HighErrorRate
expr: |
  rate(messages_failed_total[5m]) / rate(messages_consumed_total[5m]) > 0.05
for: 5m
severity: warning
message: "Error rate > 5% for WhatsApp API Service"
```

#### 8.1.3 Queue Depth Growing
```yaml
alert: QueueDepthHigh
expr: rabbitmq_queue_messages{queue="outbound-processed"} > 1000
for: 10m
severity: warning
message: "Outbound queue depth > 1000 messages"
```

#### 8.1.4 Credential Fetch Failures
```yaml
alert: CredentialFetchFailures
expr: |
  increase(tenant_service_errors_total[5m]) > 10
for: 5m
severity: critical
message: "Multiple credential fetch failures from Tenant Service"
```

---

## 9. APPENDIX

### 9.1 Meta API Rate Limits by Tier

| Tier | Messages/Second | Messages/Day | Registration |
|------|----------------|--------------|--------------|
| Tier 1 | 20 | 1,000 | Default |
| Tier 2 | 80 | 10,000 | Verified Business |
| Tier 3 | 200 | 100,000 | High Volume |
| Tier 4 | 400 | 1,000,000 | Enterprise |

### 9.2 Meta API Error Code Reference

**Complete list:** https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes

**Most Common Errors:**
- `100`: Invalid parameter
- `190`: Invalid OAuth access token
- `4`: Rate limit exceeded
- `131047`: 24-hour window expired / recipient not opted in
- `2388001`: Template does not exist
- `2388003`: Invalid phone number
- `2388054`: Phone number not registered

### 9.3 Example cURL Commands for Testing

```bash
# Test Meta API directly
curl -X POST \
  "https://graph.facebook.com/v18.0/{phone_number_id}/messages" \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "text",
    "text": { "body": "Test message" }
  }'

# Publish test message to RabbitMQ
curl -X POST \
  "http://localhost:15672/api/exchanges/whatsapp/whatsapp-exchange/publish" \
  -u "guest:guest" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {},
    "routing_key": "outbound.processed.tenant-123",
    "payload": "{\"metadata\":{\"tenantId\":\"tenant-123\",\"phoneNumberId\":\"100000001\",\"internalId\":\"msg-test-001\"},\"wabaPayload\":{\"messaging_product\":\"whatsapp\",\"to\":\"919876543210\",\"type\":\"text\",\"text\":{\"body\":\"Test message\"}}}",
    "payload_encoding": "string"
  }'
```

---

## 10. GLOSSARY

- **WABA:** WhatsApp Business Account
- **WAMID:** WhatsApp Message ID (format: `wamid.{base64}`)
- **System User Token:** Long-lived access token for Meta Graph API
- **Phone Number ID:** Meta's unique identifier for a WhatsApp business phone number
- **Graph API:** Meta's HTTP API for WhatsApp Business Platform
- **24-Hour Window:** Customer service session window (timer resets when customer messages)
- **Template Message:** Pre-approved message template (required outside 24h window)
- **ACK:** Acknowledge (remove message from queue)
- **NACK:** Negative Acknowledge (reject message, optionally requeue)
- **DLQ:** Dead Letter Queue (for permanently failed messages)
- **Circuit Breaker:** Pattern to prevent cascading failures
- **Backpressure:** Technique to slow down message consumption when downstream is overloaded

---

**Document End**