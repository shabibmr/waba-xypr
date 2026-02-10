# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhatsApp-Genesys Cloud Integration - A production-ready microservices architecture for integrating Meta WhatsApp Business API with Genesys Cloud contact center. Enables bidirectional messaging between WhatsApp customers and Genesys agents with multi-tenant support.

## Common Commands

### Development Environment

```bash
# Start entire stack (infrastructure + all services)
./manage.sh start                    # Development mode
./manage.sh start --prod            # Production mode
./manage.sh start --infra-only      # Infrastructure only (Redis, RabbitMQ, PostgreSQL)
./manage.sh start --remote          # Remote deployment

# Stop services
./manage.sh stop                    # Stop without removing volumes
./manage.sh clean                   # Stop and remove volumes

# Restart services (kills port conflicts automatically)
./manage.sh restart

# Check status and logs
./manage.sh status
./manage.sh logs                    # Follow all logs
./manage.sh clear-logs             # Clear application log files
docker compose logs -f [service-name]  # Follow specific service logs
```

### Testing

```bash
# Run all tests across all services
npm test

# Run integration tests
npm run test:integration

# Run tests for specific service
cd services/[service-name]
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in the tests/ directory
cd tests
npm install
npm test
npm run test:watch
```

### Linting and Formatting

```bash
# Lint all code
npm run lint

# Format all code
npm run format
```

### Building

```bash
# Build all services
npm run build

# Build specific service
docker compose build [service-name]

# Rebuild and restart
docker compose up -d --build [service-name]
```

## Architecture

### Microservices Overview

This is a **monorepo** with 13 microservices organized in `services/`:

**Entry Point & Routing:**
- **api-gateway** (3000) - Unified entry point, routes requests to backend services, rate limiting, CORS

**Message Flow - Inbound (WhatsApp → Genesys):**
1. **whatsapp-webhook-service** (3009) - Receives webhooks from Meta, validates signatures
2. **inbound-transformer** (3002) - Converts Meta JSON → Genesys Open Messaging format
3. **state-manager** (3005) - Maps wa_id ↔ conversationId, tracks messages
4. **genesys-api-service** (3010) - Sends messages to Genesys Cloud

**Message Flow - Outbound (Genesys → WhatsApp):**
1. **genesys-webhook-service** (3011) - Receives webhooks from Genesys
2. **outbound-transformer** (3003) - Converts Genesys JSON → Meta WhatsApp format
3. **state-manager** (3005) - Retrieves wa_id from conversationId
4. **whatsapp-api-service** (3008) - Sends messages to Meta Graph API

**Supporting Services:**
- **auth-service** (3004) - OAuth 2.0 token management for Genesys Cloud
- **tenant-service** (3007) - Multi-tenant configuration and management
- **agent-portal** (3014) - **Customer Portal** - React UI for customers to manage XYPR service, Genesys OAuth, WABA setup, subscriptions, analytics
- **agent-portal-service** (3015) - Backend API for Customer Portal
- **agent-widget** (3012) - Standalone widget used in Genesys Open Message Integration (replicates Genesys agent interface)
- **admin-dashboard** (3006) - React UI for system administration and monitoring

**Infrastructure (docker-compose.infra.yml):**
- **PostgreSQL** (5432) - Persistent storage for mappings and messages
- **Redis** (6379) - Token caching, session management, rate limiting
- **RabbitMQ** (5672, 15672) - Message queue for async processing

### Shared Libraries

The `shared/` directory contains code shared across all services:

**Constants (`shared/constants/`):**
- `services.js` - Service URLs and ports
- `queues.js` - RabbitMQ queue names
- `keys.js` - Redis key patterns with TTL constants

**Usage in services:**
```javascript
const { QUEUES, SERVICES, KEYS } = require('../../shared/constants');

// Always use environment variables with shared constants as fallback
const authUrl = process.env.AUTH_SERVICE_URL || SERVICES.AUTH_SERVICE.url;
await channel.assertQueue(QUEUES.INBOUND_WHATSAPP_MESSAGES);
const tokenKey = KEYS.genesysToken('tenant-001');
```

**Middleware (`shared/middleware/`):**
- `tenantResolver.js` - Multi-tenant identification from API keys, JWT, or subdomain
- `tenantRateLimiter.js` - Per-tenant rate limiting

### Message Queues (RabbitMQ)

Critical queues defined in `shared/constants/queues.js`:
- `INBOUND_WHATSAPP_MESSAGES` - WhatsApp Webhook → Inbound Transformer
- `OUTBOUND_GENESYS_MESSAGES` - Genesys Webhook → Outbound Transformer
- `WHATSAPP_STATUS_UPDATES` - Delivery receipts from WhatsApp
- `GENESYS_STATUS_UPDATES` - Status updates from Genesys
- `TENANT_EVENTS` - Tenant configuration changes
- `ERROR_EVENTS` - System error notifications

### State Manager - Conversation Mapping

The **state-manager** service is critical for mapping WhatsApp users to Genesys conversations:

**Key Mappings:**
- Redis: `mapping:wa:{waId}` → `{conversationId, tenantId, ...}`
- Redis: `mapping:conv:{conversationId}` → `{waId, tenantId, ...}`
- Database: Persistent storage for all mappings and message tracking

**Multi-tenant Keys:**
- `tenant:{tenantId}:mapping:wa:{waId}`
- `tenant:{tenantId}:mapping:conv:{conversationId}`

### Authentication Flow

**Genesys OAuth 2.0** (handled by auth-service):
1. Client credentials grant flow
2. Tokens cached in Redis with 5-minute buffer before expiry
3. Auto-refresh before expiration
4. Per-tenant token management

**Customer Portal Authentication:**
- OAuth 2.0 with Genesys Cloud (for customer login)
- JWT tokens for session management
- Middleware: `services/agent-portal-service/src/middleware/authenticate.js`

### Multi-Tenant Architecture

Tenant resolution strategies (in order):
1. **API Key**: `X-API-Key` header
2. **JWT Token**: `Authorization: Bearer <token>` with `tenant_id` claim
3. **Subdomain**: `acme.yourdomain.com` → tenant ID `acme`

All services using tenant context should apply `tenantResolver` middleware, which populates `req.tenant` object.

## Docker Compose Configurations

- `docker-compose.infra.yml` - Infrastructure services only (PostgreSQL, Redis, RabbitMQ)
- `docker-compose.yml` - Application services (production build)
- `docker-compose.dev.yml` - Development overrides (volume mounts, hot reload)
- `docker-compose.prod.yml` - Production configuration
- `docker-compose.remote.yml` - Remote deployment

The `manage.sh` script combines these files based on flags (`--infra-only`, `--prod`, `--remote`).

## Service Ports Reference

| Service | Port | Purpose |
|---------|------|---------|
| api-gateway | 3000 | Main entry point |
| inbound-transformer | 3002 | Meta → Genesys |
| outbound-transformer | 3003 | Genesys → Meta |
| auth-service | 3004 | OAuth tokens |
| state-manager | 3005 | Conversation mapping |
| admin-dashboard | 3006 | Web UI |
| tenant-service | 3007 | Multi-tenant mgmt |
| whatsapp-api-service | 3008 | Send to Meta |
| whatsapp-webhook-service | 3009 | Receive from Meta |
| genesys-api-service | 3010 | Send to Genesys |
| genesys-webhook-service | 3011 | Receive from Genesys |
| agent-widget | 3012 | Genesys integration widget |
| agent-portal | 3014 | Customer Portal UI |
| agent-portal-service | 3015 | Customer Portal API |

## Environment Configuration

Each service has its own `.env.example`. Key variables in root `.env.example`:

**Database:**
- `DB_PASSWORD` - PostgreSQL password

**Meta WhatsApp:**
- `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_ACCESS_TOKEN`
- `META_APP_ID`, `META_CONFIG_ID`, `META_BUSINESS_ID`

**Genesys Cloud:**
- `GENESYS_CLIENT_ID`, `GENESYS_CLIENT_SECRET`
- `GENESYS_REGION` (e.g., mypurecloud.com)
- `GENESYS_BASE_URL` (e.g., https://api.mypurecloud.com)

**Auth:**
- `JWT_SECRET` - For agent portal sessions

## Testing Infrastructure

Comprehensive mocking system in `tests/` directory:

**Mock Helpers** (`tests/utils/mock-helpers.js`):
```javascript
const MockHelpers = require('./utils/mock-helpers');

// Activate/deactivate all mocks
MockHelpers.activateAll();
MockHelpers.deactivateAll();

// Reset between tests
MockHelpers.resetAll();

// Setup predefined scenarios
MockHelpers.setupScenario('happy-path');
MockHelpers.setupScenario('whatsapp-error');
```

**Available Mocks:**
- `whatsapp-api.mock.js` - Meta WhatsApp Business API
- `genesys-api.mock.js` - Genesys Cloud Platform API
- `internal-services.mock.js` - Tenant, State, Auth services
- `redis.mock.js` - Redis client
- `rabbitmq.mock.js` - RabbitMQ

**Test Data Builders** (`tests/utils/test-data-builder.js`):
```javascript
const builders = require('./utils/test-data-builder');

const tenant = builders.tenant().withId('tenant-001').build();
const message = builders.message().from('+919876543210').withText('Hello!').build();
```

## Key Architectural Patterns

### Never Hardcode Constants

**DO:**
```javascript
const { QUEUES, SERVICES } = require('../../shared/constants');
await channel.assertQueue(QUEUES.INBOUND_WHATSAPP_MESSAGES);
const url = process.env.AUTH_SERVICE_URL || SERVICES.AUTH_SERVICE.url;
```

**DON'T:**
```javascript
await channel.assertQueue('inbound-messages'); // Typo-prone
const url = 'http://localhost:3004'; // Breaks in production
```

### Service-to-Service Communication

Services communicate via:
1. **HTTP** - Synchronous requests (use shared service URLs)
2. **RabbitMQ** - Asynchronous message passing (use shared queue names)
3. **Redis** - Shared state (use shared key patterns)

### Error Handling

Each service should have:
- Global error handler middleware
- Structured logging (preferably Winston or similar)
- Health check endpoint at `/health`

## Development Workflow

### Adding a New Service

1. Create service directory in `services/`
2. Add to `package.json` workspaces
3. Create Dockerfile
4. Add to `docker-compose.yml` and `docker-compose.dev.yml`
5. Update `shared/constants/services.js` with service URL
6. Add health check endpoint
7. Create README.md with service documentation

### Modifying Message Flow

1. Update transformer logic in `inbound-transformer` or `outbound-transformer`
2. Test with mock helpers
3. Verify queue consumers are processing correctly
4. Check state-manager for proper mapping updates

### Adding a New Tenant

Use tenant-service API or admin-dashboard UI to configure:
- Genesys credentials (client ID, secret, region)
- WhatsApp credentials (phone number ID, access token)
- Rate limits and other tenant-specific settings

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker compose logs [service-name]

# Verify all dependencies are running
./manage.sh status

# Restart with clean state
./manage.sh clean
./manage.sh start
```

### Port Already in Use
```bash
# manage.sh restart automatically kills conflicting processes
./manage.sh restart
```

### Messages Not Flowing
1. Check RabbitMQ management UI: http://localhost:15672 (guest/guest)
2. Verify queue consumers are connected
3. Check transformer service logs
4. Verify state-manager has correct mappings

### Authentication Issues
```bash
# Check auth service status
curl http://localhost:3004/health

# Check token cache in Redis
docker exec whatsapp-redis redis-cli
> KEYS genesys:oauth:*
```

### Database Issues
```bash
# Check PostgreSQL connection
docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys -c "\dt"

# View connection pool status
curl http://localhost:3005/health
```

## Important Files and Directories

- `manage.sh` - Main orchestration script for all services
- `shared/` - Shared constants, middleware, and utilities
- `tests/` - Comprehensive testing infrastructure with mocks
- `docs/deployment/setup-guide.md` - Detailed deployment guide
- `services/*/README.md` - Service-specific documentation
- `.env.example` - Environment variable template

## Notes

- This is a **Node.js 20+** monorepo using npm workspaces
- All services are Docker containerized
- Services use **Express.js** for HTTP APIs
- Message transformation happens in dedicated transformer services
- State management is centralized in state-manager service
- Multi-tenancy is enforced at the middleware level
- OAuth tokens are cached in Redis with auto-refresh
