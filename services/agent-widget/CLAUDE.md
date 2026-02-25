# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Service Overview

The Agent Widget Service provides an embeddable WhatsApp interaction widget for Genesys Cloud agents. It serves a static HTML/JavaScript frontend that integrates with the Genesys Client Apps SDK and acts as a lightweight proxy/facade to the agent-portal-service backend.

**Port:** 3012
**Role:** UI widget + API proxy layer between Genesys Agent Desktop and agent-portal-service

## Common Commands

```bash
# Development
npm run dev          # Start with nodemon (hot reload)
npm start           # Start production mode

# Testing
npm test            # Run all tests
npm test -- --watch # Watch mode
npm test -- --coverage # Generate coverage report (80% threshold)

# Docker (from repo root)
docker compose up -d agent-widget
docker compose logs -f agent-widget
docker compose build agent-widget
```

## Architecture

### Service Pattern: Facade/Proxy

This service follows a **facade pattern** - it does NOT contain business logic. All data operations are forwarded to `agent-portal-service:3015`. The widget service:

1. Serves the static HTML widget (`src/public/index.html`)
2. Proxies API calls to agent-portal-service
3. Handles file uploads via multer (16MB limit)
4. Manages multi-tenant context via `X-Tenant-ID` header

**Do NOT add business logic here.** Business logic belongs in agent-portal-service or other backend services.

### Request Flow

```
Genesys Agent Desktop (iframe)
    ↓ (Genesys Client SDK)
Widget Frontend (index.html + Socket.IO)
    ↓ (fetch /widget/api/*)
Widget Controller (widget.controller.js)
    ↓ (axios to agent-portal-service:3015)
Agent Portal Service
    ↓ (various backend services)
Tenant/State/WhatsApp services
```

### CORS Configuration

The service uses **callback-based CORS** that allows:
- All Genesys Cloud regions (via regex: `*.mypurecloud.*` and `*.pure.cloud`)
- Local development: `http://localhost:3014` (agent-portal), `http://localhost:3000` (api-gateway)
- Custom origins: Set `ALLOWED_ORIGINS=https://custom1.com,https://custom2.com` to append additional origins

Custom origins APPEND to defaults (not replace), preventing accidental breakage of Genesys iframe embedding.

When adding custom origins in production:
```bash
# Correct: Adds custom origin while keeping all Genesys regions
ALLOWED_ORIGINS=https://tenant.example.com,https://tenant2.example.com

# The widget will accept requests from:
# - All Genesys regions (*.mypurecloud.*, *.pure.cloud)
# - Local development (localhost:3000, localhost:3014)
# - Custom origins (tenant.example.com, tenant2.example.com)
```

### Static File Serving Priority

Middleware order ensures API routes take precedence over static files:

1. **Explicit route**: `GET /widget` → serves `index.html` (bypasses proxy redirects)
2. **API routes**: `/widget/api/*` → handled by controllers (highest priority)
3. **Static middleware**: `/widget/*` → serves CSS/JS/images (fallback)

**Important**: Never create files under `/public/api/` directory as they would conflict with API routes. If you need to serve additional assets (CSS, JS, images), place them directly in `/public/` or create subdirectories like `/public/css/`, `/public/js/`, `/public/assets/`.

### Multi-Tenant Architecture

Tenant resolution happens in two ways:

1. **Static context** - `X-Tenant-ID` header from frontend (obtained via initial `/api/resolve-tenant?conversationId=...` call)
2. **Dynamic resolution** - Widget service calls agent-portal-service → tenant-service to resolve tenantId from Genesys `integrationId`

All downstream calls to agent-portal-service MUST include `X-Tenant-ID` header.

### CORS Configuration

The service has **hardcoded Genesys Cloud origin whitelist** for iframe embedding (`server.js:24-39`):

- All Genesys regions: `.mypurecloud.com`, `.mypurecloud.ie`, `.pure.cloud` (multiple regions)
- Local development: `http://localhost:3014` (agent-portal), `http://localhost:3000` (api-gateway)

When adding new allowed origins, update `corsOptions.origin` in `src/server.js`.

## Key Implementation Details

### Widget Initialization Flow

The frontend calls **unified init endpoint** to reduce round-trips:

```javascript
// Frontend calls: GET /widget/api/init?conversationId=xyz
// Returns: { tenantId, customerData, messageHistory }
```

This endpoint (`initWidgetData` in controller):
1. Resolves tenantId from conversationId via agent-portal-service
2. Fetches conversation details and message history in parallel
3. Returns all data in one response

### Media Upload Pattern (Two-Step)

Media messages use a **two-step process**:

1. **Upload:** `POST /widget/api/upload-media` (multer → agent-portal-service → MinIO) → returns `{ url, mimeType, fileSize }`
2. **Send:** `POST /widget/api/send-message` with `{ mediaUrl, mediaType, caption }`

Alternatively, use **one-step:** `POST /widget/api/send-media` (uploads + sends in single call).

### Message Metadata Parsing

The `extractMediaInfo()` method in `widget.service.js` handles rich content types:

- Standard media: image/video/audio/document (via `mediaUrl` + MIME type)
- Location messages: latitude/longitude with Google Maps link
- Contacts: vCard data
- Interactive: button/list replies
- Stickers: static/animated

When adding new WhatsApp message types, update this method to extract relevant metadata.

### Ngrok Free-Tier Bypass

The service sets `ngrok-skip-browser-warning: true` header (`server.js:18-21`) to bypass ngrok's interstitial page. This is required for iframe embedding during development with ngrok tunnels.

## Configuration

Environment variables (`.env` or passed via Docker):

```bash
PORT=3012                                      # Service port
AGENT_PORTAL_SERVICE_URL=http://agent-portal-service:3015  # Backend API
PUBLIC_URL=http://localhost:3012               # Widget's public URL
GENESYS_CLIENT_ID=...                          # OAuth client ID for Genesys SDK
GENESYS_REGION=mypurecloud.com                 # Genesys region
ALLOWED_ORIGINS=https://custom-origin.com      # Additional CORS origins (comma-separated)
```

## Testing

Tests use Jest with the following structure:

- `tests/unit/` - Unit tests for services/controllers
- `tests/api/` - API integration tests
- `tests/setup.js` - Global test setup
- Coverage threshold: 80% (branches, functions, lines, statements)

Mock agent-portal-service responses in tests since this service has no business logic of its own.

## Integration Points

### Genesys Client Apps SDK

The frontend (`index.html`) integrates with Genesys via:
- **Client Apps SDK v2.6.3** - Loaded from `https://sdk-cdn.mypurecloud.com/client-apps/2.6.3/purecloud-client-app-sdk.js`
- Receives conversation context from parent Genesys window
- Can notify Genesys of widget events

### Socket.IO (Real-Time Updates)

The widget connects to Socket.IO server hosted by agent-portal-service for real-time message updates:
- Socket.IO Client v4.6.0 loaded from CDN
- Connects to agent-portal-service namespaces (tenant/conversation-specific)
- Receives `inbound_message` and `status_update` events

### Agent Portal Service Dependencies

All endpoints proxy to agent-portal-service. If agent-portal-service changes API contracts, update:
1. `widgetService` method calls (URLs/payloads)
2. Response transformations in controller
3. Frontend JavaScript (if response shape changes)

## Common Development Tasks

### Adding a New API Endpoint

1. Add route in `src/routes/widget.routes.js`
2. Add controller method in `src/controllers/widget.controller.js`
3. Add service method in `src/services/widget.service.js` that calls agent-portal-service
4. Add tests in `tests/api/` or `tests/unit/`

**Remember:** No business logic in this service. If complex logic is needed, implement it in agent-portal-service.

### Updating the Widget UI

Edit `src/public/index.html`. The file contains:
- HTML structure
- Inline CSS styles
- Inline JavaScript (Genesys SDK integration, Socket.IO, API calls)

For significant changes, consider extracting JavaScript into separate files served as static assets.

### Debugging CORS Issues

1. Check browser console for CORS errors
2. Verify origin is in `corsOptions.origin` whitelist (`src/server.js:41-46`)
3. For Genesys iframe: ensure parent window origin matches one of `GENESYS_ORIGINS`
4. For local testing: add your development URL to `ALLOWED_ORIGINS` env var

### Troubleshooting Tenant Resolution

If tenant resolution fails (returns 'default'):
1. Check that conversationId is valid in Genesys
2. Verify agent-portal-service is running and accessible
3. Check agent-portal-service logs for tenant lookup errors
4. Ensure integrationId exists in tenant-service database

Fallback to 'default' is intentional to prevent widget crashes, but may cause permission/data isolation issues.
