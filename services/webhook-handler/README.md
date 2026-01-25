# Webhook Handler Service

Generic webhook validation and processing service for the WhatsApp-Genesys integration platform. Receives webhooks from Meta (WhatsApp) and Genesys Cloud, validates signatures, and queues messages for processing.

## Features

- **Meta Webhook Validation**: Signature verification using HMAC-SHA256
- **Webhook Verification**: Handles Meta's webhook subscription verification
- **Message Queuing**: RabbitMQ integration for asynchronous processing
- **Status Updates**: Forwards WhatsApp delivery receipts to Genesys
- **Multi-Message Type Support**: Text, images, documents, audio, video, and location
- **Immediate Response**: Returns 200 OK immediately to prevent timeouts

## Architecture

This service acts as the entry point for all external webhooks, validating and routing them to appropriate queues.

```
[Meta WhatsApp] ──> [Webhook Handler] ──> [RabbitMQ] ──> [Inbound Transformer]
                           |                   |
                           |                   └──> [Outbound Transformer]
                           v
[Genesys Cloud] ──> [State Manager]
```

## Prerequisites

- **Node.js**: v18+
- **RabbitMQ**: For message queuing
- **State Manager**: For conversation mapping
- **Auth Service**: For Genesys API authentication

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service Port | `3001` |
| `RABBITMQ_URL` | RabbitMQ Connection URL | `amqp://localhost` |
| `META_VERIFY_TOKEN` | Meta webhook verification token | *Required* |
| `META_APP_SECRET` | Meta app secret for signature verification | *Required* |
| `STATE_SERVICE_URL` | State Manager service URL | `http://state-manager:3005` |
| `AUTH_SERVICE_URL` | Auth service URL | `http://auth-service:3004` |
| `GENESYS_BASE_URL` | Genesys Cloud API base URL | *Required* |

## Installation & Running

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run in production
npm start

# Run tests
npm test
```

## API Reference

### Meta (WhatsApp) Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/webhook/meta` | Webhook verification endpoint |
| POST | `/webhook/meta` | Receive WhatsApp events |

**Webhook Verification (GET)**:
Meta sends a verification request when you configure the webhook URL.

```
GET /webhook/meta?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE_STRING
Response: CHALLENGE_STRING (if token matches)
```

**Webhook Events (POST)**:
Receives WhatsApp message events and status updates.

```json
POST /webhook/meta
Headers:
  X-Hub-Signature-256: sha256=<signature>
Body:
{
  "entry": [{
    "changes": [{
      "field": "messages",
      "value": {
        "messages": [...],
        "statuses": [...]
      }
    }]
  }]
}
```

### Genesys Cloud Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/genesys` | Receive Genesys conversation events |

**Example: Agent Message Event**
```json
POST /webhook/genesys
{
  "eventType": "agent.message",
  "conversationId": "abc123",
  "message": {
    "id": "msg456",
    "text": "Hello customer",
    "timestamp": "2024-01-14T10:30:00Z",
    "from": {
      "id": "agent789"
    }
  }
}
```

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service and RabbitMQ health status |

## Message Processing Flow

### Inbound (WhatsApp → Genesys)

1. Meta sends webhook to `/webhook/meta`
2. Service validates signature
3. Extracts message content based on type
4. Queues to `inbound-messages` queue
5. Returns 200 OK immediately

### Outbound (Genesys → WhatsApp)

1. Genesys sends webhook to `/webhook/genesys`
2. Service validates event type
3. Queues to `outbound-messages` queue
4. Returns 200 OK immediately

### Status Updates (WhatsApp → Genesys)

1. Meta sends delivery receipt
2. Service looks up conversation mapping via State Manager
3. Forwards status to Genesys Cloud API
4. Maps Meta status to Genesys format

## Supported Message Types

| Type | Meta Field | Extracted Content |
|------|-----------|-------------------|
| Text | `text.body` | Plain text message |
| Image | `image.id`, `image.caption` | Image ID and optional caption |
| Document | `document.id`, `document.filename` | Document ID and filename |
| Audio | `audio.id` | Audio file ID |
| Video | `video.id`, `video.caption` | Video ID and optional caption |
| Location | `location.*` | Latitude, longitude, name, address |

## Status Mapping

| Meta Status | Genesys Status |
|-------------|----------------|
| `sent` | `Sent` |
| `delivered` | `Delivered` |
| `read` | `Read` |
| `failed` | `Failed` |

## Security

### Signature Verification

All Meta webhooks are verified using HMAC-SHA256:

```javascript
X-Hub-Signature-256: sha256=<hmac>
```

The service computes the expected signature and compares it using timing-safe comparison to prevent timing attacks.

## Error Handling

- **Invalid Signature**: Logged and ignored (no response to Meta)
- **Missing Data**: Logged and skipped
- **Queue Errors**: Logged, message processing continues
- **State Manager Errors**: Logged, status update skipped

All webhook endpoints return `200 OK` immediately to prevent retries.

## RabbitMQ Queues

| Queue Name | Purpose | Consumer |
|------------|---------|----------|
| `inbound-messages` | WhatsApp → Genesys messages | Inbound Transformer |
| `outbound-messages` | Genesys → WhatsApp messages | Outbound Transformer |

Both queues are configured as durable for message persistence.

## Project Structure

```
src/
└── index.js        # Main service file with webhook handlers
tests/
├── api/            # API integration tests
└── setup.js        # Test configuration
```

## Dependencies

- `express`: Web framework
- `amqplib`: RabbitMQ client
- `axios`: HTTP client for API calls
- `crypto`: Signature verification
- `dotenv`: Environment configuration

## Docker

```bash
# Build image
docker build -t webhook-handler .

# Run container
docker run -p 3001:3001 \
  -e META_VERIFY_TOKEN=your_verify_token \
  -e META_APP_SECRET=your_app_secret \
  -e RABBITMQ_URL=amqp://rabbitmq:5672 \
  webhook-handler
```

## Troubleshooting

### Webhook Verification Fails

- Ensure `META_VERIFY_TOKEN` matches the token configured in Meta Developer Console
- Check that the webhook URL is publicly accessible

### Signature Validation Fails

- Verify `META_APP_SECRET` is correct
- Ensure request body is not modified before signature verification
- Check for encoding issues

### RabbitMQ Connection Issues

- Verify `RABBITMQ_URL` is correct
- Check RabbitMQ service is running
- Service will automatically retry connection every 5 seconds

## Meta Webhook Configuration

1. Go to Meta Developer Console
2. Navigate to WhatsApp → Configuration
3. Set Webhook URL: `https://your-domain.com/webhook/meta`
4. Set Verify Token: Same as `META_VERIFY_TOKEN`
5. Subscribe to `messages` field
