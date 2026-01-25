# API Documentation

Complete API documentation for the WhatsApp-Genesys Cloud Integration Platform.

## Overview

This platform provides a complete integration between WhatsApp Business Platform and Genesys Cloud, enabling seamless omnichannel customer conversations.

## Interactive API Documentation

Each service provides interactive Swagger UI documentation at the `/api-docs` endpoint when running.

### Service Documentation Endpoints

| Service | Port | Swagger UI | OpenAPI Spec |
|:---|:---:|:---|:---|
| **API Gateway** | 3000 | [http://localhost:3000/api-docs](http://localhost:3000/api-docs) | [openapi.yaml](file:///d:/BKP/waba/code/claude/services/api-gateway/docs/openapi.yaml) |
| **WhatsApp Webhook** | 3001 | [http://localhost:3001/api-docs](http://localhost:3001/api-docs) | [openapi.yaml](file:///d:/BKP/waba/code/claude/services/whatsapp-webhook-service/docs/openapi.yaml) |
| **Genesys Webhook** | 3002 | [http://localhost:3002/api-docs](http://localhost:3002/api-docs) | [openapi.yaml](file:///d:/BKP/waba/code/claude/services/genesys-webhook-service/docs/openapi.yaml) |
| **WhatsApp API** | 3003 | [http://localhost:3003/api-docs](http://localhost:3003/api-docs) | [openapi.yaml](file:///d:/BKP/waba/code/claude/services/whatsapp-api-service/docs/openapi.yaml) |
| **Genesys API** | 3004 | [http://localhost:3004/api-docs](http://localhost:3004/api-docs) | [openapi.yaml](file:///d:/BKP/waba/code/claude/services/genesys-api-service/docs/openapi.yaml) |
| **Tenant Service** | 3005 | [http://localhost:3005/api-docs](http://localhost:3005/api-docs) | [openapi.yaml](file:///d:/BKP/waba/code/claude/services/tenant-service/docs/openapi.yaml) |

## Quick Start

1. **Start all services:**
   ```bash
   docker-compose up
   ```

2. **Access documentation:**
   - Open your browser to any service's `/api-docs` endpoint
   - Example: http://localhost:3000/api-docs

3. **Try the APIs:**
   - Use the "Try it out" button in Swagger UI
   - Provide required authentication tokens
   - Execute requests directly from the browser

## Service Descriptions

### API Gateway

Central entry point for all API requests. Provides:
- Request routing to microservices
- Rate limiting
- Authentication
- Request/response logging

**Key Endpoints:**
- `/webhook/meta` - WhatsApp webhook proxy
- `/webhook/genesys` - Genesys webhook proxy
- `/transform/*` - Message transformation
- `/auth/*` - Authentication

### WhatsApp Webhook Service

Receives and processes webhook events from Meta's WhatsApp Business Platform.

**Key Endpoints:**
- `GET /whatsapp` - Webhook verification (required by Meta)
- `POST /whatsapp` - Receive webhook events
- `POST /whatsapp/test` - Test endpoint (development only)

**Supported Events:**
- Incoming messages (text, media, location, contacts)
- Message status updates (sent, delivered, read, failed)
- Account notifications

### Genesys Webhook Service

Receives and processes webhook events from Genesys Cloud.

**Key Endpoints:**
- `POST /outbound` - Outbound messages from agents
- `POST /events` - Conversation events
- `POST /agent-state` - Agent state changes

### WhatsApp API Service

Wrapper service for WhatsApp Cloud API operations.

**Message Endpoints:**
- `POST /send/text` - Send text message
- `POST /send/template` - Send template message
- `POST /send/image` - Send image
- `POST /send/document` - Send document
- `POST /send/location` - Send location
- `POST /send/buttons` - Send interactive buttons
- `POST /mark-read` - Mark message as read

**Media Endpoints:**
- `GET /media/:mediaId` - Get media URL
- `GET /media/:mediaId/download` - Download media

### Genesys API Service

Wrapper service for Genesys Cloud Open Messaging API.

**Message Endpoints:**
- `POST /messages/inbound` - Send inbound message to Genesys
- `POST /receipts` - Send delivery receipts

**Conversation Endpoints:**
- `GET /conversations/:id` - Get conversation details
- `PATCH /conversations/:id` - Update conversation attributes
- `POST /conversations/:id/disconnect` - End conversation
- `POST /conversations/:id/typing` - Send typing indicator
- `GET /conversations/:id/messages` - Get message history

### Tenant Service

Multi-tenant management and configuration.

**Tenant Endpoints:**
- `POST /tenants` - Create new tenant
- `GET /tenants` - List all tenants
- `GET /tenants/:id` - Get tenant details

**WhatsApp Configuration:**
- `POST /tenants/:id/whatsapp` - Update WhatsApp config
- `GET /tenants/:id/whatsapp` - Get WhatsApp config
- `POST /api/whatsapp/signup` - WhatsApp signup callback

**Credentials:**
- `POST /tenants/:id/credentials` - Store credentials
- `GET /tenants/:id/credentials/:type` - Get credentials

## Authentication

Most endpoints require authentication. The platform supports:

### JWT Bearer Tokens

Used for internal service-to-service communication and admin operations.

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Obtain tokens via:
```bash
POST /auth/login
Content-Type: application/json

{
  "username": "admin@example.com",
  "password": "your_password"
}
```

### API Keys

Used for webhook verification and external integrations.

```http
X-API-Key: your_api_key_here
```

### Webhook Signatures

WhatsApp webhooks use SHA256 HMAC signatures:

```http
X-Hub-Signature-256: sha256=<signature>
```

## Common Schemas

### Error Response

All services return errors in a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "additional context"
  }
}
```

### Success Response

Generic success responses:

```json
{
  "success": true,
  "message": "Operation completed successfully"
}
```

## Message Flow

### Inbound (WhatsApp → Genesys)

1. WhatsApp sends webhook to **WhatsApp Webhook Service**
2. Event published to RabbitMQ queue
3. **Inbound Transformer** converts WhatsApp format → Genesys format
4. **Genesys API Service** sends message to Genesys Cloud
5. **State Manager** tracks conversation mapping

### Outbound (Genesys → WhatsApp)

1. Genesys sends webhook to **Genesys Webhook Service**
2. Event published to RabbitMQ queue
3. **Outbound Transformer** converts Genesys format → WhatsApp format
4. **WhatsApp API Service** sends message via WhatsApp Cloud API
5. Status updates flow back through webhooks

## Rate Limiting

The API Gateway implements rate limiting:

- **Default:** 100 requests per minute per IP
- **Webhook endpoints:** 1000 requests per minute
- **Authenticated requests:** Higher limits based on tenant plan

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642584900
```

## Error Codes

| Code | HTTP Status | Description |
|:---|:---:|:---|
| `BAD_REQUEST` | 400 | Invalid request payload |
| `UNAUTHORIZED` | 401 | Authentication required or invalid |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

## Validation

OpenAPI specifications can be validated using:

```bash
# Install validator
npm install -g @apidevtools/swagger-cli

# Validate specs
swagger-cli validate services/*/docs/openapi.yaml
```

## Postman Collection

Import OpenAPI specs into Postman:

1. Open Postman
2. Click "Import"
3. Select "Link" and paste the OpenAPI spec URL
4. Or upload the `openapi.yaml` file directly

## Support

For API support:
- **Documentation Issues:** Check service-specific READMEs
- **Integration Help:** See [Architecture Documentation](file:///d:/BKP/waba/code/claude/docs/architecture)
- **Deployment:** See [Deployment Guide](file:///d:/BKP/waba/code/claude/docs/deployment)
