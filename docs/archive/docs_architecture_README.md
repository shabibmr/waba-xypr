# Architecture Overview

High-level architecture documentation for the WhatsApp-Genesys Cloud Integration Platform.

## System Architecture

The platform uses a **microservices architecture** with event-driven communication to integrate WhatsApp Business Platform with Genesys Cloud contact center.

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Systems                          │
├──────────────────────┬──────────────────────────────────────────┤
│  Meta WhatsApp API   │       Genesys Cloud Platform             │
└──────────┬───────────┴────────────────┬─────────────────────────┘
           │                            │
           │ Webhooks                   │ Webhooks
           ▼                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                         API Gateway (3000)                        │
│              Request Routing | Rate Limiting | CORS              │
└──────────┬───────────────────────────────────┬───────────────────┘
           │                                   │
    ┌──────▼──────┐                     ┌─────▼──────┐
    │  WhatsApp   │                     │  Genesys   │
    │   Webhook   │                     │  Webhook   │
    │   (3009)    │                     │   (3011)   │
    └──────┬──────┘                     └─────┬──────┘
           │                                   │
           │ Publish                           │ Publish
           ▼                                   ▼
    ┌─────────────────────────────────────────────────┐
    │            RabbitMQ Message Queues              │
    │  inbound-messages  |  outbound-messages         │
    └──────┬──────────────────────────┬───────────────┘
           │                          │
    ┌──────▼──────┐            ┌──────▼──────┐
    │  Inbound    │            │  Outbound   │
    │ Transformer │            │ Transformer │
    │   (3002)    │            │   (3003)    │
    └──────┬──────┘            └──────┬──────┘
           │                          │
    ┌──────▼──────┐            ┌──────▼──────┐
    │  Genesys    │            │  WhatsApp   │
    │ API Service │            │ API Service │
    │   (3010)    │            │   (3008)    │
    └──────┬──────┘            └──────┬──────┘
           │                          │
           └──────────┬───────────────┘
                      │
           ┌──────────▼───────────┐
           │   State Manager      │
           │      (3005)          │
           │  Conversation State  │
           └──────────┬───────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐   ┌───▼────┐   ┌───▼────┐
   │  Auth   │   │ Tenant │   │ Redis  │
   │ Service │   │Service │   │ Cache  │
   │ (3004)  │   │ (3007) │   │        │
   └─────────┘   └────┬───┘   └────────┘
                      │
                 ┌────▼────┐
                 │PostgreSQL│
                 │ Database │
                 └──────────┘
```

## Core Components

### 1. API Gateway (Port 3000)
**Role**: Single entry point for all external traffic

**Responsibilities**:
- Route requests to appropriate microservices
- Rate limiting per tenant
- CORS handling
- Request/response logging
- Load balancing

### 2. Webhook Services

#### WhatsApp Webhook (Port 3009)
- Receives webhooks from Meta
- Validates HMAC signatures
- Publishes to `inbound-messages` queue

#### Genesys Webhook (Port 3011)
- Receives webhooks from Genesys Cloud
- Validates authentication
- Publishes to `outbound-messages` queue

### 3. Transformer Services

#### Inbound Transformer (Port 3002)
- Consumes from `inbound-messages` queue
- Transforms WhatsApp JSON → Genesys Open Messaging format
- Handles media downloads and conversions
- Routes to Genesys API Service

#### Outbound Transformer (Port 3003)
- Consumes from `outbound-messages` queue
- Transforms Genesys JSON → WhatsApp API format
- Handles template messages and interactive buttons
- Routes to WhatsApp API Service

### 4. API Services

#### WhatsApp API Service (Port 3008)
- Wrapper for Meta Graph API
- Sends messages to WhatsApp
- Handles media uploads
- Retrieves tenant credentials

#### Genesys API Service (Port 3010)
- Wrapper for Genesys Cloud API
- Creates/manages conversations
- Sends inbound messages
- Handles typing indicators and receipts

### 5. Core Services

#### State Manager (Port 3005)
- Manages conversation mappings (WhatsApp ↔ Genesys)
- Stores message context
- Tracks conversation state
- PostgreSQL for persistence, Redis for caching

#### Auth Service (Port 3004)
- OAuth 2.0 token management for Genesys
- Token caching and refresh
- Multi-tenant credential management

#### Tenant Service (Port 3007)
- Multi-tenant configuration
- Stores WhatsApp and Genesys credentials
- Tenant onboarding and management
- PostgreSQL for storage

### 6. Frontend Services

#### Admin Dashboard (Port 3006)
- Web UI for configuration
- Tenant management
- System monitoring
- Analytics and reporting

#### Agent Widget (Port 3012)
- Embedded in Genesys Agent Desktop
- Shows customer context
- WhatsApp conversation history
- Customer profile information

## Data Flow

### Inbound Message Flow (WhatsApp → Genesys)

```
1. Customer sends WhatsApp message
   ↓
2. Meta sends webhook to WhatsApp Webhook Service
   ↓
3. Webhook validates signature, publishes to RabbitMQ
   ↓
4. Inbound Transformer consumes message
   ↓
5. Transformer converts WhatsApp format → Genesys format
   ↓
6. State Manager checks for existing conversation
   ↓
7. Genesys API Service creates/updates conversation
   ↓
8. State Manager stores mapping
   ↓
9. Message appears in Genesys Agent Desktop
```

### Outbound Message Flow (Genesys → WhatsApp)

```
1. Agent sends message in Genesys
   ↓
2. Genesys sends webhook to Genesys Webhook Service
   ↓
3. Webhook publishes to RabbitMQ
   ↓
4. Outbound Transformer consumes message
   ↓
5. Transformer converts Genesys format → WhatsApp format
   ↓
6. State Manager retrieves WhatsApp number from mapping
   ↓
7. WhatsApp API Service sends via Meta Graph API
   ↓
8. Customer receives message on WhatsApp
   ↓
9. Delivery receipts flow back through webhooks
```

## Multi-Tenant Architecture

The platform supports multiple organizations (tenants) from a single deployment.

### Tenant Isolation

- **Database**: Tenant ID in all tables, row-level security
- **Redis**: Namespaced keys (`tenant:${tenantId}:*`)
- **RabbitMQ**: Tenant ID in message metadata
- **API**: Tenant resolution via API key, JWT, or subdomain

### Tenant Resolution

```javascript
// 1. API Key
X-API-Key: tenant-001-api-key-xyz

// 2. JWT Token
Authorization: Bearer eyJ...  // Contains tenant_id claim

// 3. Subdomain
acme.yourdomain.com → tenant_id: "acme"
```

## Technology Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: JavaScript (ES6+)

### Data Storage
- **Database**: PostgreSQL 15 (tenant config, conversation state)
- **Cache**: Redis 7 (tokens, mappings, rate limits)
- **Message Queue**: RabbitMQ 3.12 (async processing)

### External APIs
- **Meta WhatsApp**: Graph API v18
- **Genesys Cloud**: Open Messaging API v2

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Reverse Proxy**: Nginx (production)

## Scalability Considerations

### Horizontal Scaling

**Stateless Services** (can scale freely):
- API Gateway
- Webhook Services
- Transformer Services
- API Services

**Stateful Services** (require coordination):
- State Manager (use Redis for distributed locking)
- Auth Service (shared Redis cache)

### Message Queue Scaling

- Multiple consumers per queue
- Prefetch limits to prevent overload
- Dead letter queues for failed messages

### Database Scaling

- Read replicas for State Manager queries
- Connection pooling
- Indexed queries on tenant_id and conversation_id

### Caching Strategy

- **L1 Cache**: In-memory (service-level)
- **L2 Cache**: Redis (shared)
- **TTL**: 1 hour for mappings, 23 hours for tokens

## Security Architecture

### Authentication
- OAuth 2.0 for Genesys Cloud
- API keys for tenant identification
- JWT tokens for internal services

### Authorization
- Tenant-level isolation
- Role-based access control (RBAC) in Admin Dashboard
- Service-to-service authentication

### Data Protection
- Webhook signature validation (HMAC-SHA256)
- TLS/SSL for all external communication
- Environment-based secrets management
- No credentials in logs or responses

### Network Security
- Docker network isolation
- Firewall rules for external access
- Rate limiting per tenant
- DDoS protection via API Gateway

## Monitoring & Observability

### Health Checks
- `/health` endpoint on all services
- Redis connectivity checks
- RabbitMQ connection monitoring
- Database connection pools

### Logging
- Structured JSON logs
- Tenant ID in all log entries
- Centralized log aggregation
- Log levels: ERROR, WARN, INFO, DEBUG

### Metrics
- Message processing latency
- Queue depths
- API response times
- Error rates per tenant

## Deployment Architecture

### Development
```
docker-compose.yml + docker-compose.dev.yml
- Hot reload enabled
- Debug ports exposed
- Local infrastructure (PostgreSQL, Redis, RabbitMQ)
```

### Production
```
docker-compose.prod.yml
- Optimized builds
- Resource limits
- Health checks
- Restart policies
- External infrastructure
```

## Design Patterns

### Event-Driven Architecture
- Asynchronous message processing
- Decoupled services
- Eventual consistency

### API Gateway Pattern
- Single entry point
- Request routing
- Cross-cutting concerns (auth, rate limiting)

### Strangler Fig Pattern
- Gradual migration from monolith (if applicable)
- Service-by-service replacement

### Circuit Breaker
- Fail fast on external API errors
- Graceful degradation

## Related Documentation

- [Service Startup Order](service-startup-order.md)
- [API Documentation](api-documentation.md)
- [Multi-Tenant Guide](deployment/multi-tenant-guide.md)
- [Deployment Guide](deployment/refined-setup-guide.md)
