# WhatsApp Webhook Service

Receives real-time events from Meta's Cloud API. It acts as the ingress port for all WhatsApp traffic, validating signatures and routing messages to the processing pipeline.

- **Webhook Verification**: Handles Meta's challenge-response verification.
- **Signature Validation**: Verifies `X-Hub-Signature-256` to ensure security.
- **Tenant Resolution**: Routes messages to the correct tenant based on `phone_number_id`.
- **Event Queuing**: Publishes validated messages to RabbitMQ for asynchronous processing.

## Architecture

```
┌────────────────────┐      ┌─────────────────────────┐      ┌─────────────────┐
│  Meta Cloud API    │─────▶│ WhatsApp Webhook Service│─────▶│    RabbitMQ     │
│  (Webhook Events)  │      └───────────┬─────────────┘      │ (Inbound Queue) │
└────────────────────┘                  │                    └─────────────────┘
                                        ▼
                               ┌──────────────────┐
                               │  Tenant Service  │
                               │  (Resolve Context)│
                               └──────────────────┘
```

## Project Structure

```
src/
├── config/
│   └── index.js
├── controllers/
│   └── webhook.controller.js  # Webhook ingress
├── services/
│   ├── processor.service.js   # Event processing
│   ├── signature.service.js   # HMAC validation
│   └── rabbitmq.service.js    # Queue publishing
├── routes/
│   └── index.js
└── index.js
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service Port | `3009` |
| `NODE_ENV` | Environment | `development` |
| `RABBITMQ_URL` | RabbitMQ URL | `amqp://localhost` |
| `META_VERIFY_TOKEN` | Verification Token | *Required* |
| `TENANT_SERVICE_URL` | Tenant Service URL | `http://tenant-service:3007` |

## API Endpoints

### Webhooks
```
GET  /webhook/whatsapp       # Meta Verification Handshake
POST /webhook/whatsapp       # Event Ingestion
```

### System
```
GET /health                  # Health check
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
docker build -t whatsapp-webhook-service .
```

Run the container:
```bash
docker run -p 3009:3009 --env-file .env whatsapp-webhook-service
```

## Dependencies

- **express**: Web framework
- **amqplib**: RabbitMQ client
- **crypto**: Signature verification
- **minio**: Media storage (optional)
- **axios**: HTTP client
