# Genesys Webhook Service

Receives and processes notifications from Genesys Cloud. Handles agent messages, conversation events, and state changes, translating them into actions for the WhatsApp integration.

- **Outbound Messaging**: Captures agent messages and queues them for WhatsApp delivery.
- **Event Handling**: Processes typing indicators, disconnects, and participant changes.
- **Media Handling**: Downloads and stores media files from Genesys before sending to WhatsApp.
- **Tenant Resolution**: Identifies the correct tenant context from incoming webhooks.

## Architecture

```
┌─────────────────┐       ┌────────────────────┐       ┌─────────────────┐
│  Genesys Cloud  │──────▶│   Genesys Webhook  │──────▶│    RabbitMQ     │
│  Notification   │       │   Service          │       │ (Outbound Queue)│
└─────────────────┘       └────────────────────┘       └─────────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │      MinIO      │
                          │ (Media Storage) │
                          └─────────────────┘
```

## Project Structure

```
src/
├── config/
│   └── index.js        # Config for RMQ, MinIO, Services
├── controllers/
│   └── webhook.controller.js # Webhook ingress
├── services/
│   ├── event-processor.service.js # Event logic
│   ├── media.service.js           # MinIO integration
│   └── rabbitmq.service.js        # Queue publishing
├── routes/
│   └── index.js
└── index.js
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service Port | `3011` |
| `NODE_ENV` | Environment | `development` |
| `RABBITMQ_URL` | RabbitMQ URL | `amqp://localhost` |
| `TENANT_SERVICE_URL` | Tenant Service URL | `http://tenant-service:3007` |
| `STATE_SERVICE_URL` | State Manager URL | `http://state-manager:3005` |
| `MINIO_ENDPOINT` | MinIO Host | `minio` |
| `MINIO_PORT` | MinIO Port | `9000` |
| `MINIO_ACCESS_KEY` | MinIO User | `admin` |
| `MINIO_SECRET_KEY` | MinIO Password | `admin123` |
| `MINIO_BUCKET` | Media Bucket | `whatsapp-media` |

## API Endpoints

### Webhooks
```
POST /webhook/genesys             # Unified endpoint (recommended)
POST /webhook/genesys/agent-state # Agent presence updates
POST /webhook/genesys/test        # Test endpoint
```

> **Note:** Genesys Open Messaging sends all events to a single URL. The unified endpoint routes internally based on `eventType`.

### System
```
GET /health
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
docker build -t genesys-webhook-service .
```

Run the container:
```bash
docker run -p 3011:3011 --env-file .env genesys-webhook-service
```

## Dependencies

- **express**: Web framework
- **amqplib**: RabbitMQ client
- **minio**: Object storage client
- **mime-types**: File type detection
- **axios**: HTTP client
