# Tenant Service

Manages multi-tenant configuration, credentials, and WhatsApp Business API settings for the WhatsApp-Genesys integration platform. This service allows the system to serve multiple organizations securely from a single deployment.

- **Tenant Management**: Create, list, and retrieve tenant configurations.
- **WhatsApp Onboarding**: Handle "Embedded Signup" flow and credentials.
- **Credential Vault**: Secure storage for external system secrets (Genesys, Meta).
- **Context Provider**: Supplies configuration context to other microservices.

## Architecture Overview

The Tenant Service is part of a larger microservices-based middleware platform that integrates WhatsApp Business API (WABA) with Genesys Cloud. The system uses an event-driven architecture with asynchronous processing to ensure scalability, tenant isolation, and resilience.

### Key Architectural Principles

- **Multi-tenancy by design** (tenant resolution, isolation, rate limits, credentials)
- **Async, event-driven processing** via RabbitMQ queues
- **Centralized auth, state, and tenancy services**
- **Clear separation of inbound vs outbound flows**

### High-Level Message Flows

#### Inbound (WhatsApp → Genesys)

```
WhatsApp Cloud → WhatsApp Webhook Service → MinIO + RabbitMQ 
              → Inbound Transformer → State Manager 
              → Genesys API Service → Genesys Cloud
```

1. WhatsApp Cloud sends webhook to WhatsApp Webhook Service
2. Payload validated, tenant resolved, stored in MinIO
3. Event enqueued to RabbitMQ
4. Inbound Transformer formats payload for Genesys
5. State Manager resolves/creates conversation mapping
6. Genesys API Service delivers message to Genesys Cloud

#### Outbound (Genesys → WhatsApp)

```
Genesys Cloud → Genesys Webhook Service → MinIO + RabbitMQ 
             → Outbound Transformer → State Manager 
             → WhatsApp API Service → WhatsApp Cloud
```

1. Genesys Cloud sends webhook to Genesys Webhook Service
2. Payload validated, tenant resolved, stored in MinIO
3. Event enqueued to RabbitMQ
4. Outbound Transformer formats payload for WhatsApp
5. State Manager resolves conversation & media URLs
6. WhatsApp API Service delivers message to WhatsApp Cloud

### System Architecture

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│  Admin          │──────▶│   Tenant         │◀──────│  WhatsApp       │
│  Dashboard      │       │   Service        │       │  Webhook        │
└─────────────────┘       └──────────────────┘       └─────────────────┘
                                  │                   
                                  ▼                   
                           ┌──────────────┐     ┌─────────────────┐
                           │  PostgreSQL  │◀────│  State Manager  │
                           │   (Tenants)  │     │  (Mappings)     │
                           └──────────────┘     └─────────────────┘
                                  ▲                        ▲
                                  │                        │
                           ┌──────▼──────┐         ┌──────▼──────┐
                           │    Redis    │         │    MinIO    │
                           │   (Cache)   │         │  (Storage)  │
                           └─────────────┘         └─────────────┘
```

### Integration Points

The Tenant Service provides critical configuration and credentials to:

- **WhatsApp Webhook Service**: Tenant resolution by `phone_number_id`
- **Genesys Webhook Service**: Tenant resolution by `integration_id`
- **Auth Service**: OAuth credentials for Genesys Cloud
- **WhatsApp API Service**: WhatsApp access tokens and phone numbers
- **State Manager**: Tenant-scoped conversation mappings

### Performance & Caching

The service uses **Redis caching** extensively to minimize database queries:

- **Tenant config cache**: 99%+ hit rate (1 hour TTL)
- **OAuth token cache**: 95%+ hit rate (55 minutes TTL with 5-min buffer)
- **WhatsApp token cache**: 98%+ hit rate (24 hour TTL)

Expected latency:
- Cache hit: **10-50ms**
- Cache miss: **100-500ms** (includes DB query)

## Detailed Documentation

For comprehensive sequence diagrams and flow details, see:

- [Inbound Message Sequence](docs/inbound-message-sequence.md) - Complete WhatsApp → Genesys flow
- [Outbound Message Sequence](docs/outbound-message-sequence.md) - Complete Genesys → WhatsApp flow
- [Backend Services Architecture](docs/backend_services_architecture_document.md) - All microservices overview

## Project Structure

```
src/
├── config/
│   └── index.js            # Database and Redis config
├── controllers/
│   ├── credential.controller.js # Credential management
│   ├── tenant.controller.js     # Tenant CRUD operations
│   └── whatsapp.controller.js   # WhatsApp configuration
├── middleware/
│   └── auth.middleware.js       # Request authentication
├── routes/
│   ├── credential.routes.js     # Credential routes
│   ├── tenant.routes.js         # Tenant routes
│   └── whatsapp.routes.js       # WhatsApp routes
├── services/
│   ├── credential.service.js    # Credential logic
│   ├── tenant.service.js        # Tenant logic
│   └── whatsapp.service.js      # WhatsApp logic
├── utils/
│   └── encryption.util.js       # Credential encryption
├── app.js                       # Express app setup
└── server.js                    # Service entry point
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `3007` |
| `NODE_ENV` | Environment | `development` |
| `DB_HOST` | PostgreSQL Host | `localhost` |
| `DB_PORT` | PostgreSQL Port | `5432` |
| `DB_NAME` | Database Name | `whatsapp_genesys` |
| `DB_USER` | Database User | `postgres` |
| `DB_PASSWORD` | Database Password | `secure_password` |
| `REDIS_URL` | Redis Connection URL | `redis://localhost:6379` |
| `META_APP_ID` | Meta App ID for Onboarding | *Required* |
| `META_APP_SECRET` | Meta App Secret for Onboarding | *Required* |

## API Endpoints

### Tenants
```
GET /api/tenants
POST /api/tenants
GET /api/tenants/:tenantId
```

### Credentials
```
// Store Genesys Credentials
PUT /api/tenants/:tenantId/genesys/credentials
Content-Type: application/json
{
    "clientId": "...",
    "clientSecret": "...",
    "region": "mypurecloud.com"
}

// Get Credentials (Masked)
GET /api/tenants/:tenantId/genesys/credentials
```

### WhatsApp Configuration
```
// Update WhatsApp Config
POST /api/tenants/:tenantId/whatsapp
Content-Type: application/json
{
    "wabaId": "...",
    "phoneNumberId": "..."
}

// Signup Callback
POST /api/whatsapp/signup
```

## Development

### Installation
```bash
npm install
```

### Running Locally
```bash
npm run dev
```

### Running in Production
```bash
npm start
```

### Testing
```bash
npm test
```

## Docker Deployment

Build the image:
```bash
docker build -t tenant-service .
```

Run the container:
```bash
docker run -p 3007:3007 --env-file .env tenant-service
```

## Infrastructure Dependencies

| Component | Purpose | Used By |
|-----------|---------|---------|
| **PostgreSQL** | Persistent storage for tenant configurations, credentials, conversation history | Tenant Service, State Manager |
| **Redis** | Caching layer for tenant configs, OAuth tokens, conversation mappings, rate limiting | All backend services |
| **MinIO** | Object storage for webhook payloads and media files | WhatsApp/Genesys Webhooks, State Manager |
| **RabbitMQ** | Message queue for async processing between webhooks and transformers | WhatsApp Webhook → Inbound Transformer<br/>Genesys Webhook → Outbound Transformer |

## Service Dependencies

- **express**: Web server framework
- **pg**: PostgreSQL client
- **redis**: Caching layer
- **axios**: HTTP client
- **dotenv**: Environment configuration

## Security Features

- **Credential Encryption**: All OAuth credentials and API keys encrypted at rest
- **Tenant Isolation**: Strict tenant boundaries enforced across all queries
- **Webhook Signature Validation**: HMAC SHA256 validation for Meta webhooks
- **Token Caching**: Reduces external API calls and credential exposure
- **Rate Limiting**: Tenant-scoped rate limits via Redis

## Observability

The service supports tenant-scoped:
- Logging (structured JSON logs)
- Metrics (tenant-specific message counts, latencies)
- Tracing (conversation-level distributed tracing)
