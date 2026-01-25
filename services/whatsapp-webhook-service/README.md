# WhatsApp Webhook Service

A microservice that receives and processes WhatsApp webhook events from Meta's Cloud API. The service handles webhook verification, signature validation, message ingestion, and status updates, forwarding them to RabbitMQ for further processing.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The WhatsApp Webhook Service is a critical component in a multi-tenant WhatsApp Business API architecture. It:
- Receives real-time webhook events from Meta
- Validates webhook signatures for security
- Resolves tenant information from phone number IDs
- Processes inbound messages and status updates
- Queues messages to RabbitMQ for downstream processing

## Architecture

```mermaid
graph LR
    A[Meta/WhatsApp Cloud API] -->|Webhook Events| B[Webhook Service]
    B -->|Resolve Tenant| C[Tenant Service]
    B -->|Queue Messages| D[RabbitMQ]
    D -->|Inbound Messages| E[Message Transformer]
    D -->|Status Updates| F[State Manager]
    
    style B fill:#4285f4,color:#fff
    style D fill:#ff6f00,color:#fff
```

### Component Architecture

```mermaid
graph TD
    A[index.js<br/>Entry Point] --> B[Routes]
    B --> C[Controllers]
    C --> D[Services]
    D --> E[External Services]
    
    B --> F[Middleware]
    D --> G[Utilities]
    
    H[Config] -.-> A
    H -.-> D
    
    style A fill:#34a853
    style D fill:#4285f4
    style E fill:#ea4335
```

## Features

- **Webhook Verification**: Automated Meta webhook verification endpoint
- **Multi-Tenant Support**: Routes webhooks to correct tenant based on phone number ID
- **Signature Validation**: HMAC-SHA256 signature verification for security
- **Message Processing**: Handles all WhatsApp message types (text, image, video, location, etc.)
- **Status Tracking**: Processes message delivery status updates
- **Queue Integration**: Publishes to RabbitMQ for asynchronous processing
- **Health Monitoring**: Built-in health check endpoint
- **Auto-Reconnection**: Automatic RabbitMQ reconnection with exponential backoff
- **Structured Logging**: Tenant-aware logging for debugging

## Prerequisites

- **Node.js**: v18.x or higher
- **RabbitMQ**: Running instance for message queuing
- **Tenant Service**: Running tenant management service
- **Meta App**: Configured WhatsApp Business App with webhook settings

## Installation

### Local Development

```bash
# Navigate to service directory
cd services/whatsapp-webhook-service

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Configure environment variables (see Configuration section)
# Edit .env file with your values

# Start development server
npm run dev
```

### Docker Deployment

```bash
# Build Docker image
docker build -t whatsapp-webhook-service .

# Run container
docker run -p 3009:3009 \
  -e META_VERIFY_TOKEN=your_verify_token \
  -e RABBITMQ_URL=amqp://rabbitmq:5672 \
  -e TENANT_SERVICE_URL=http://tenant-service:3007 \
  whatsapp-webhook-service
```

## Configuration

### Environment Variables

Create a `.env` file in the service root:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | HTTP server port | No | `3009` |
| `META_VERIFY_TOKEN` | Token for Meta webhook verification | **Yes** | - |
| `RABBITMQ_URL` | RabbitMQ connection URL | No | `amqp://localhost` |
| `TENANT_SERVICE_URL` | URL of tenant service | No | `http://tenant-service:3007` |
| `NODE_ENV` | Environment (development/production) | No | `development` |

### Example .env

```env
PORT=3009
META_VERIFY_TOKEN=your_secret_verify_token_here
RABBITMQ_URL=amqp://user:password@rabbitmq:5672
TENANT_SERVICE_URL=http://tenant-service:3007
NODE_ENV=development
```

## API Endpoints

### Webhook Verification (GET)

**Endpoint**: `GET /webhook/whatsapp`

Used by Meta to verify the webhook URL during setup.

**Query Parameters**:
- `hub.mode` - Should be "subscribe"
- `hub.verify_token` - Must match `META_VERIFY_TOKEN`
- `hub.challenge` - Random string to echo back

**Response**: Returns the challenge string if verification succeeds, 403 otherwise.

**Example**:
```bash
curl "http://localhost:3009/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=your_token&hub.challenge=test123"
```

---

### Webhook Event Receiver (POST)

**Endpoint**: `POST /webhook/whatsapp`

Receives WhatsApp events from Meta.

**Headers**:
- `Content-Type: application/json`
- `x-hub-signature-256` - HMAC signature from Meta

**Request Body**: Meta webhook event payload

**Response**: `200 OK` (immediate response required by Meta)

**Processing**:
1. Validates webhook signature
2. Resolves tenant from phone number ID
3. Processes messages and status updates
4. Queues to RabbitMQ

---

### Health Check (GET)

**Endpoint**: `GET /health`

Returns service health status.

**Response**:
```json
{
  "status": "healthy",
  "service": "whatsapp-webhook",
  "rabbitmq": "connected",
  "timestamp": "2026-01-14T13:00:00.000Z"
}
```

---

### Test Webhook (POST)

**Endpoint**: `POST /webhook/whatsapp/test`

Development-only endpoint for testing webhook processing.

**Request Body**: Any valid webhook payload

**Response**:
```json
{
  "success": true,
  "received": { /* your payload */ }
}
```

## Development

### Project Structure

```
whatsapp-webhook-service/
├── src/
│   ├── config/
│   │   └── config.js           # Configuration management
│   ├── controllers/
│   │   └── webhook.controller.js  # Request handlers
│   ├── middleware/
│   │   ├── error-handler.js    # Error handling
│   │   └── signature-verifier.js  # Signature validation
│   ├── routes/
│   │   ├── health.routes.js    # Health check routes
│   │   └── webhook.routes.js   # Webhook routes
│   ├── services/
│   │   ├── rabbitmq.service.js    # RabbitMQ integration
│   │   ├── tenant.service.js      # Tenant resolution
│   │   └── webhook-processor.service.js  # Event processing
│   ├── utils/
│   │   ├── logger.js           # Structured logging
│   │   └── message-extractor.js   # Message content extraction
│   └── index.js                # Application entry point
├── tests/
│   ├── integration/
│   └── unit/
├── .env.example
├── Dockerfile
├── package.json
└── README.md
```

### Running Locally

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start
```

### Code Style

The service follows these conventions:
- **Modular architecture**: Separation of concerns across config, routes, controllers, services
- **Singleton services**: Shared instances for RabbitMQ and tenant services
- **Error handling**: Centralized error handling middleware
- **Logging**: Structured logging with tenant context
- **Async/await**: Modern async patterns throughout

## Testing

### Manual Testing

1. **Test Health Endpoint**:
```bash
curl http://localhost:3009/health
```

2. **Test Webhook Verification**:
```bash
curl "http://localhost:3009/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
```

3. **Test Webhook Processing** (using test endpoint):
```bash
curl -X POST http://localhost:3009/webhook/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "field": "messages",
        "value": {
          "messages": [{
            "type": "text",
            "text": {"body": "Hello"},
            "from": "1234567890",
            "id": "msg_123"
          }],
          "metadata": {
            "phone_number_id": "987654321",
            "display_phone_number": "+1234567890"
          }
        }
      }]
    }]
  }'
```

### Automated Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage
```

## Deployment

### Docker

```bash
# Build image
docker build -t whatsapp-webhook-service:latest .

# Run container
docker run -d \
  --name whatsapp-webhook \
  -p 3009:3009 \
  --env-file .env \
  whatsapp-webhook-service:latest
```

### Docker Compose

Add to your `docker-compose.yml`:

```yaml
services:
  whatsapp-webhook-service:
    build: ./services/whatsapp-webhook-service
    ports:
      - "3009:3009"
    environment:
      - PORT=3009
      - META_VERIFY_TOKEN=${META_VERIFY_TOKEN}
      - RABBITMQ_URL=amqp://rabbitmq:5672
      - TENANT_SERVICE_URL=http://tenant-service:3007
    depends_on:
      - rabbitmq
      - tenant-service
```

### Meta Configuration

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Navigate to your WhatsApp Business App
3. Go to **Webhooks** settings
4. Set callback URL: `https://your-domain.com/webhook/whatsapp`
5. Set verify token: Same as `META_VERIFY_TOKEN` in your `.env`
6. Subscribe to events: `messages` and `message_status`

## Troubleshooting

### Common Issues

**RabbitMQ Connection Failed**
- Ensure RabbitMQ is running and accessible
- Check `RABBITMQ_URL` in environment variables
- Service will auto-reconnect every 5 seconds

**Webhook Verification Failed**
- Verify `META_VERIFY_TOKEN` matches Meta settings
- Check webhook URL is publicly accessible
- Ensure HTTPS is enabled (required by Meta)

**Signature Validation Errors**
- Ensure tenant has correct `appSecret` configured
- Check that request body is not modified before validation
- Verify tenant service is returning correct credentials

**Messages Not Queuing**
- Check RabbitMQ connection status via `/health` endpoint
- Verify queue names match configuration
- Check RabbitMQ logs for queue assertion errors

### Logging

The service uses structured logging:
- Development: Full error stack traces
- Production: Error messages only
- Tenant context: All logs include tenant ID when available

Check logs for debugging:
```bash
# Docker logs
docker logs whatsapp-webhook-service -f

# Local development
# Logs printed to console
```

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review service logs
3. Verify configuration and environment variables
4. Check Meta webhook dashboard for delivery failures

## License

Internal use only - Part of WhatsApp Business API Platform
