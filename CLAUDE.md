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

This is a **monorepo** with 14 microservices organized in `services/`. Each service with a FRD has its canonical spec at `services/<name>/docs/*-frd.md`.

**Entry Point & Routing:**
- **api-gateway** (3000) - Unified entry point, routes requests to backend services, rate limiting, CORS

**Message Flow - Inbound (WhatsApp → Genesys):**
1. **whatsapp-webhook-service** (3009) - Receives webhooks from Meta, validates signatures, publishes to RabbitMQ
2. **state-manager** (3005) - Identity resolution: maps wa_id → conversationId, creates/retrieves conversation mappings, tracks messages, publishes enriched payload to `inbound-processed` queue
3. **inbound-transformer** (3002) - Stateless, deterministic transformer: consumes enriched WhatsApp payloads, converts to Genesys Open Messaging format, dispatches to Genesys API Service
4. **genesys-api-service** (3010) - Stateless, queue-driven gateway: consumes from `inbound-processed`, authenticates via OAuth, delivers to Genesys Cloud Open Messaging API, publishes conversation correlation events to `correlation-events` queue

**Message Flow - Outbound (Genesys → WhatsApp):**
1. **genesys-webhook-service** (3011) - Sole ingress for Genesys Cloud webhooks: validates HMAC-SHA256 signatures, resolves tenant by integrationId, classifies events, relays media via MinIO, publishes to `outboundQueue` / `statusQueue`
2. **state-manager** (3005) - Reverse identity resolution: maps conversationId → wa_id, enriches payload, publishes to `outbound-processed` queue
3. **outbound-transformer** (3003) - Stateless transformer: consumes from `outbound-processed`, converts Genesys JSON → WhatsApp Graph API format, validates media URLs/MIME types, publishes to `outbound-ready` queue
4. **whatsapp-api-service** (3008) - Egress gateway to Meta Cloud API: consumes transformed messages, delivers via `POST graph.facebook.com/v18.0/{phoneNumberId}/messages`, per-tenant rate limiting and circuit breakers

**Supporting Services:**
- **auth-service** (3004) - Centralized token authority and OAuth lifecycle manager (see [Auth Service](#auth-service) below)
- **tenant-service** (3007) - Multi-tenant configuration, credential storage, WhatsApp signup flow
- **agent-portal** (3014) - Customer Portal: React UI for onboarding, Genesys OAuth, WABA setup, analytics, conversation management (see [Agent Portal](#agent-portal) below)
- **agent-portal-service** (3015) - Backend API for Customer Portal (auth, onboarding, analytics, settings endpoints)
- **agent-widget** (3012) - React micro-frontend for real-time WhatsApp interactions, embeddable in Genesys Agent Desktop (iframe) or Customer Portal (standalone) (see [Agent Widget](#agent-widget) below)
- **admin-dashboard** (3006) - React UI for system administration and monitoring

**Infrastructure (docker-compose.infra.yml):**
- **PostgreSQL** (5432) - Persistent storage for conversation mappings, message tracking, tenant config
- **Redis** (6379) - Token caching, conversation mapping cache, deduplication, distributed locks, rate limiting
- **RabbitMQ** (5672, 15672) - Message queue for async processing between all pipeline services
- **MinIO** - Object storage for media files (outbound media relay)

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

---

## Service Details (from FRDs)

### State Manager

**FRD:** `services/state-manager/docs/state-manager-frd.md`

The transactional core of the middleware. Single source of truth for conversation state and message lifecycle.

**Core Data Model:**
- `conversation_mappings` table - Links wa_id ↔ conversationId (unique constraint: one active conversation per wa_id)
- `message_tracking` table - Audit trail for every message, keyed by `wamid` (idempotent via `ON CONFLICT DO NOTHING`)

**Key Operations:**
1. **Inbound Identity Resolution** - Receives WhatsApp message, acquires distributed lock (`lock:mapping:{wa_id}`), creates or retrieves mapping, tracks message, forwards enriched payload
2. **Outbound Identity Resolution** - Receives Genesys message, resolves wa_id from conversationId, tracks message, forwards enriched payload
3. **Message Status Updates** - Validates state machine transitions (queued→sent→delivered→read; received→processed), idempotent, rejects regressions
4. **Conversation ID Correlation** - Updates mapping with conversationId returned by Genesys after conversation creation
5. **Auto-Expiry** - Background job every 5 minutes expires conversations inactive >24 hours

**Redis Cache Keys:**
- `mapping:wa:{wa_id}` → `{conversation_id, internal_mapping_id, last_activity_at}` (TTL: 24h)
- `mapping:conv:{conversation_id}` → `{wa_id, internal_mapping_id}` (TTL: 24h)
- `lock:mapping:{wa_id}` → Distributed lock (TTL: 5s, 3 retries with 100ms backoff)

**API Endpoints:**
- `GET /mapping/wa/:waId` - Lookup by WhatsApp ID
- `GET /mapping/conv/:conversationId` - Lookup by Genesys conversation ID
- `POST /messages` - Manual message tracking
- `PATCH /messages/:wamid` - Update message status (validates state transitions)
- `GET /health` - Health check (DB + Redis + RabbitMQ)

**Message Status State Machine:**
- Outbound: `queued → sent → delivered → read` (failed from any state)
- Inbound: `received → processed` (failed from any state)
- Forward-only, idempotent duplicate updates, rejects invalid transitions

**Concurrency Controls:**
- Redis distributed locks (prevent duplicate mapping creation)
- DB unique partial index: `UNIQUE (wa_id) WHERE status = 'active'`
- Idempotent message logging: `UNIQUE (wamid)` with `ON CONFLICT DO NOTHING`
- Optimistic locking for status updates: `WHERE status = $current_status`

---

### Auth Service

**FRD:** `services/auth-service/docs/auth-frd.md`

Centralized token authority. Never stores credentials locally - fetches encrypted credentials from Tenant Service on-demand.

**Supported Flows:**
1. **Genesys OAuth 2.0 (Client Credentials)** - Fetches credentials from Tenant Service → exchanges for JWT via Genesys OAuth endpoint → caches with 60s safety buffer
2. **WhatsApp Static Token** - Retrieves system user token from Tenant Service → caches with 24h TTL
3. **Genesys SSO JWT Validation** - Validates signature via JWKS → extracts userId, orgId, roles → JWKS keys cached 6h per region

**API Endpoints:**
- `POST /api/v1/token` - Retrieve access token `{ tenantId, type: 'genesys'|'whatsapp', forceRefresh? }` → `{ accessToken, expiresIn, tokenType, source }`
- `POST /api/v1/validate/jwt` - Validate Genesys SSO JWT `{ token, region }` → `{ isValid, userId, orgId, roles }`
- `GET /api/v1/health` - Health check

**Redis Keys:**
- `auth:token:{provider}:{tenantId}` - Cached access tokens
- `auth:lock:{provider}:{tenantId}` - Request collapsing locks (30s TTL, prevents thundering herd)
- `auth:jwks:{region}` - JWKS key cache (6h TTL)

**Degraded Mode (Redis down):** Skips caching, fetches tokens directly from IdP, applies in-memory per-tenant rate limiting (10 req/min).

---

### Inbound Transformer

**FRD:** `services/inbound-transformer/docs/inbound-transformer-frd.md`

Stateless, deterministic transformer. Same input always produces same output.

**Input (from RabbitMQ):** Two types:
- **User Message** (type: "message") - Contains `tenantId`, `waId`, `wamid`, `conversationId`, `payload.body`, optional `payload.media`
- **Status Event** (type: "event") - Contains `tenantId`, `waId`, `wamid`, `status` (sent|delivered|read|failed)

**Output (to Genesys API Service via REST):**
- `POST /genesys/messages/inbound` - Genesys Open Messaging format with channel info, text, optional attachments
- `POST /genesys/events/inbound` - Receipt events (status mapping: sent→Published, delivered→Delivered, read→Read, failed→Failed)

**Key Behaviors:**
- Idempotency via Redis/in-memory cache (24h TTL). Messages: `internalId` as key. Events: `SHA256(wamid|status|timestamp)`
- Timestamp conversion: Unix epoch → ISO 8601 UTC
- Media URL validation: HTTPS only, rejects private IPs (SSRF protection)
- Configurable: `IGNORE_SENT_STATUS=true` skips "sent" status events
- Retry: Exponential backoff with jitter (base 1s, max 32s, max 5 attempts) → DLQ on exhaustion
- Headers to Genesys: `X-Tenant-ID`, `X-Correlation-ID`, `X-Message-Source: inbound-transformer`

**Health Endpoints:** `GET /health/live` (liveness), `GET /health/ready` (readiness: RabbitMQ + Genesys API)

---

### Genesys API Service

**FRD:** `services/genesys-api-service/docs/genesys-api-frd.md`

Stateless, queue-driven, multi-tenant gateway to Genesys Cloud.

**What it does:** Consume from `inbound-processed` → authenticate → deliver to `POST https://api.{region}.genesys.cloud/api/v2/conversations/messages/inbound/open` → publish correlation event
**What it does NOT do:** Transform messages, resolve identities, generate tokens, store state

**Message Delivery:**
- Timeout: 5 seconds (configurable)
- On success: extract conversationId + communicationId → publish to `correlation-events` queue
- On 401: invalidate token cache, retry once with fresh token
- On 429: respect `Retry-After` header, minimum 60s backoff, NACK for requeue
- On 5xx/timeout: retry with exponential backoff + jitter (base 1s, max 32s, max 5 attempts)
- On 400/403/404: permanent failure → DLQ (`genesys-api.dlq`)

**Rate Limiting (multi-level):**
- Per-tenant: Token bucket (default 300 req/min, burst 50)
- Global: Service-wide (500 req/min, burst 100)
- Genesys-imposed: 429 handling with backoff manager

**Deduplication:** Redis key `genesys:dedupe:{tenantId}:{whatsapp_message_id}` (24h TTL). Fail-open if Redis unavailable.

**Circuit Breaker:** Per-region, opens after 10 consecutive failures, 60s recovery timeout, closes after 3 successes.

---

### Genesys Webhook Service

**FRD:** `services/genesys-webhook-service/docs/genesys-webhook-frd.md`

Sole ingress point for Genesys Cloud webhook events. Security-critical.

**Endpoint:** `POST /webhook` with `x-hub-signature-256` header

**Processing Pipeline:**
1. Extract raw body for signature validation
2. Parse JSON, extract `integrationId` from `channel.from.id`
3. Resolve tenant: `GET /api/v1/tenants/by-integration/{integrationId}` → Tenant Service
4. Validate HMAC-SHA256 signature (constant-time comparison using tenant's `webhookSecret`)
5. Check for echo events (filter middleware-injected messages: prefixes `mw-`, `middleware-`, `injected-`)
6. Classify: `outbound_message` | `status_event` | `health_check`
7. If media attachment: stream download from Genesys (OAuth) → stream upload to MinIO `media-outbound` bucket → generate 7-day presigned URL
8. Publish to `outboundQueue` (messages) or `statusQueue` (status events)

**Must respond within 5 seconds** (Genesys SLA). Media processing: 30s download + 30s upload timeout, 20MB max.

**Dependencies:** Tenant Service (tenant resolution), Auth Service (OAuth for media download), RabbitMQ, MinIO

---

### Outbound Transformer

**FRD:** `services/outbound-transformer/docs/outbound-tranformer-frd.md`

Stateless transformer: Genesys format → WhatsApp Graph API format.

**Input (from `outbound-processed` queue):**
```json
{ "internalId", "tenantId", "conversationId", "genesysId", "waId", "phoneNumberId", "timestamp", "type": "message", "payload": { "text?", "media?": { "url", "mime_type", "filename?" } } }
```

**Output (to `outbound-ready` queue or REST):**
```json
{ "metadata": { "tenantId", "phoneNumberId", "internalId", "correlationId" }, "wabaPayload": { "messaging_product": "whatsapp", "recipient_type": "individual", "to", "type": "text|image|video|document|audio", ... } }
```

**Transformation Rules:**
- Text: max 4096 chars → `{ type: "text", text: { body } }`
- Image (JPEG/PNG/WebP, 5MB): → `{ type: "image", image: { link, caption? } }`
- Video (MP4/3GPP, 16MB): → `{ type: "video", video: { link, caption? } }`
- Document (PDF/Office/TXT, 100MB): → `{ type: "document", document: { link, filename, caption? } }`
- Audio (AAC/MP3/M4A/AMR/OGG, 16MB): → `{ type: "audio", audio: { link } }` (no captions)
- Audio + text: configurable via `AUDIO_TEXT_BEHAVIOR` (separate_message | discard_text | text_only)
- Unsupported MIME: configurable via `UNSUPPORTED_MIME_BEHAVIOR` (reject | convert_to_document | text_fallback)

**Media URL Validation:** HTTPS only, block private IPs (SSRF), convert internal storage URLs to signed/public URLs

**Idempotency:** Redis key `idempotency:outbound:{internalId}` (24h TTL, SETNX)

---

### WhatsApp API Service

**FRD:** `services/whatsapp-api-service/docs/whatsapp-api-frd.md`

Egress gateway to Meta's Cloud API.

**Delivery:** `POST https://graph.facebook.com/v18.0/{phoneNumberId}/messages` with Bearer token (System User Access Token)

**Credentials:** Fetched from Tenant Service `GET /api/v1/tenants/{tenantId}/credentials?type=whatsapp`, cached 15min in-memory, invalidated on 401/403.

**Rate Limiting by Meta WABA Tier:**
- Tier 2: 80 msg/s, 10K/day
- Tier 3: 200 msg/s, 100K/day
- Tier 4: 400 msg/s, 1M/day

**Per-tenant isolation:** Independent credential caches, circuit breakers (threshold: 5 failures, 1min timeout), rate limiters (token bucket). One tenant's failure does not block others.

**Error Handling:**
- 131047 (WINDOW_EXPIRED): ACK, notify Genesys (24h window closed)
- 2388005 (MEDIA_DOWNLOAD_FAILED): retry once
- 190 (INVALID_TOKEN): invalidate cache, retry once, alert
- 429: NACK with backoff
- 5xx: NACK with exponential backoff (max 5 retries)
- DLQ: `outbound-failed` (24h TTL)

---

### Agent Portal (Customer Portal)

**FRD:** `services/agent-portal/docs/customer-portal-frd.md`

React 18 web app. Control plane for managing Genesys-WhatsApp-XYPR integration.

**Tech Stack:** React 18 + React Router 6 + React Query 5 + React Hook Form + Zod + Tailwind CSS + Radix UI + Recharts + Axios + Vite 5

**Routes:**
- `/login` - Genesys SSO entry point
- `/callback` - OAuth2 callback handler
- `/` - Dashboard (KPI metrics, message volume charts, token status indicators, auto-refresh 30s)
- `/onboarding` - 5-step wizard: Organization Profile → Genesys Credentials → WhatsApp Config → Connectivity Test → Webhook Deployment
- `/conversations` - Paginated list with search/filter, detail drawer (embedded agent-widget, audit trail, delivery logs, CSV export)
- `/settings` - Credential management, secret rotation, regional settings

**Authentication:** Genesys OAuth2 with PKCE → session JWT stored in memory (AuthContext, NOT localStorage) → HTTP-only cookies for backend persistence → auto-refresh 5min before expiry

**State Management:** AuthContext (session), React Query (server data), component state (UI)

**Backend:** agent-portal-service (3015) via api-gateway (3000). Headers: `X-Tenant-ID`, `Authorization: Bearer <jwt>`

---

### Agent Widget

**FRD:** `services/agent-widget/docs/agent-widget-frd.md`

React micro-frontend for real-time WhatsApp interactions.

**Deployment Modes:**
- **Genesys Cloud:** Iframe in Agent Desktop, context from Genesys SDK (`window.Genesys`), SSO token auth, Lightning theme
- **Customer Portal:** Standalone/embedded, context from URL params (conversationId, tenantId), Bearer/cookie auth, Portal theme

**Context Resolution:** `GET /api/v1/widget/context/{conversationId}` → validates and returns `{ valid, tenantId, wa_id }`

**Real-Time:** Socket.IO WebSocket on namespace `/tenant/{tenantId}/conv/{conversationId}`. Events: `inbound_message`, `status_update` (sent/delivered/read → gray/blue tick indicators)

**Message Send:** `POST /api/v1/widget/send` → validates, publishes to RabbitMQ → State Manager resolves wa_id → WhatsApp delivery

**Supported:** Text, media attachments (JPG/PNG/PDF/MP4), emojis, read receipts, inline previews. Fallback to direct middleware send if Genesys unavailable.

---

## Message Queues (RabbitMQ)

### Pipeline Queues

| Queue | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `inbound-processed` | State Manager / Inbound Transformer | Genesys API Service | Enriched inbound messages ready for Genesys delivery |
| `correlation-events` | Genesys API Service | State Manager | Link WhatsApp messageId to Genesys conversationId |
| `outboundQueue` | Genesys Webhook Service | State Manager | Outbound agent messages from Genesys |
| `statusQueue` | Genesys Webhook Service | State Manager | Delivery receipts and status events from Genesys |
| `outbound-processed` | State Manager | Outbound Transformer | Enriched outbound messages with wa_id resolved |
| `outbound-ready` | Outbound Transformer | WhatsApp API Service | Transformed WhatsApp-format messages |

### Dead Letter Queues

| DLQ | Source Service | Routing Reasons |
|-----|---------------|-----------------|
| `inbound-transformer-dlq` | Inbound Transformer | Max retries exhausted, invalid payload |
| `genesys-api.dlq` | Genesys API Service | Permanent client errors (400/403/404), invalid schema |
| `outbound-transformer-dlq` | Outbound Transformer | Max retries, unsupported MIME (if reject mode), validation errors |
| `outbound-failed` | WhatsApp API Service | Permanent failures (invalid phone, expired window), max retries |
| `state-manager-dlq` | State Manager | Lock timeout, mapping not found, invalid payload |

### Shared Queue Constants

Defined in `shared/constants/queues.js`:
- `INBOUND_WHATSAPP_MESSAGES` - WhatsApp Webhook → State Manager
- `OUTBOUND_GENESYS_MESSAGES` - Genesys Webhook → State Manager
- `WHATSAPP_STATUS_UPDATES` - Delivery receipts from WhatsApp
- `GENESYS_STATUS_UPDATES` - Status updates from Genesys
- `TENANT_EVENTS` - Tenant configuration changes
- `ERROR_EVENTS` - System error notifications

---

## Authentication & Token Management

### Genesys OAuth 2.0 (handled by auth-service)
1. Client Credentials grant flow (per-tenant)
2. Credentials fetched from Tenant Service on-demand (never stored in auth-service)
3. Tokens cached in Redis (`auth:token:genesys:{tenantId}`) with 60-second safety buffer before expiry
4. Request collapsing via distributed locks prevents thundering herd on cache miss
5. Auto-refresh before expiration; manual refresh via `forceRefresh: true`
6. Degraded mode when Redis unavailable: direct IdP calls, in-memory rate limiting

### WhatsApp Tokens (handled by auth-service)
- Static System User Access Tokens from Tenant Service
- Cached in Redis (`auth:token:whatsapp:{tenantId}`) with 24h TTL
- Invalidated on 401/403 from Meta API

### Customer Portal Authentication
- Genesys OAuth 2.0 with PKCE (via agent-portal frontend)
- Session JWT validated by `POST /api/v1/validate/jwt` on auth-service
- JWKS keys cached per Genesys region (6h TTL)
- Middleware: `services/agent-portal-service/src/middleware/authenticate.js`

### Multi-Tenant Architecture

Tenant resolution strategies (in order):
1. **API Key**: `X-API-Key` header
2. **JWT Token**: `Authorization: Bearer <token>` with `tenant_id` claim
3. **Subdomain**: `acme.yourdomain.com` → tenant ID `acme`

All services using tenant context should apply `tenantResolver` middleware, which populates `req.tenant` object.

---

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
| inbound-transformer | 3002 | WhatsApp → Genesys transformation |
| outbound-transformer | 3003 | Genesys → WhatsApp transformation |
| auth-service | 3004 | Centralized token authority |
| state-manager | 3005 | Conversation mapping & message tracking |
| admin-dashboard | 3006 | Admin web UI |
| tenant-service | 3007 | Multi-tenant config & credentials |
| whatsapp-api-service | 3008 | Egress to Meta Graph API |
| whatsapp-webhook-service | 3009 | Ingress from Meta webhooks |
| genesys-api-service | 3010 | Egress to Genesys Cloud API |
| genesys-webhook-service | 3011 | Ingress from Genesys webhooks |
| agent-widget | 3012 | Real-time WhatsApp interaction widget |
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

### Idempotency

All pipeline services implement idempotency:
- **State Manager:** `ON CONFLICT (wamid) DO NOTHING` for message tracking
- **Inbound Transformer:** Redis/in-memory cache keyed by `internalId` (messages) or `SHA256(wamid|status|timestamp)` (events), 24h TTL
- **Genesys API Service:** Redis dedup `genesys:dedupe:{tenantId}:{whatsapp_message_id}`, 24h TTL, fail-open
- **Outbound Transformer:** Redis `idempotency:outbound:{internalId}`, 24h TTL, SETNX
- **WhatsApp API Service:** Deduplication before Meta API call

### Resilience Patterns

- **Circuit Breakers:** Genesys API Service (per-region), WhatsApp API Service (per-tenant)
- **Retry with Backoff:** All pipeline services use exponential backoff with jitter
- **Dead Letter Queues:** Every consumer has a DLQ for permanent failures
- **Graceful Degradation:** Auth-service operates without Redis; State Manager falls back to DB when Redis unavailable
- **Rate Limiting:** Per-tenant token bucket at Genesys API Service and WhatsApp API Service

### Error Handling

Each service should have:
- Global error handler middleware
- Structured JSON logging with correlation IDs
- Health check endpoint at `/health` (some have `/health/live` + `/health/ready`)

## Development Workflow

### Adding a New Service

1. Create service directory in `services/`
2. Add to `package.json` workspaces
3. Create Dockerfile
4. Add to `docker-compose.yml` and `docker-compose.dev.yml`
5. Update `shared/constants/services.js` with service URL
6. Add health check endpoint
7. Create FRD in `services/<name>/docs/<name>-frd.md`

### Modifying Message Flow

1. Update transformer logic in `inbound-transformer` or `outbound-transformer`
2. Test with mock helpers
3. Verify queue consumers are processing correctly
4. Check state-manager for proper mapping updates
5. Verify idempotency and DLQ routing

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
2. Verify queue consumers are connected and queue depth is not growing
3. Check transformer service logs for validation/transformation errors
4. Verify state-manager has correct mappings (`GET /mapping/wa/:waId`)
5. Check DLQs for permanently failed messages
6. Verify auth tokens are valid (`GET /api/v1/health` on auth-service)

### Authentication Issues
```bash
# Check auth service status
curl http://localhost:3004/api/v1/health

# Check token cache in Redis
docker exec whatsapp-redis redis-cli
> KEYS auth:token:*
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
- `services/*/docs/*-frd.md` - Canonical functional requirements per service
- `docs/deployment/setup-guide.md` - Detailed deployment guide
- `.env.example` - Environment variable template

## Notes

- This is a **Node.js 20+** monorepo using npm workspaces
- All services are Docker containerized
- Services use **Express.js** for HTTP APIs
- Message transformation happens in dedicated stateless transformer services
- State management is centralized in state-manager service
- Multi-tenancy is enforced at the middleware level
- OAuth tokens are cached in Redis with auto-refresh
- All pipeline services are idempotent and retry-safe
- Services without FRDs: api-gateway, admin-dashboard, tenant-service, whatsapp-webhook-service, agent-portal-service
