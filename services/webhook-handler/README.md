# Webhook Handler Service

A generic entry point for handling various external webhooks. While `whatsapp-webhook-service` is specialized for Meta, this service provides a flexible foundation for other integrations or legacy webhook flows.

- **Unified Validation**: Validates signatures for configured providers.
- **Provider Routing**: Routes events based on source.
- **Queue Integration**: Buffers events to RabbitMQ.
- **Response Management**: Ensures immediate 200 OK responses.

## Architecture

```
┌────────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│  External Provider │─────▶│   Webhook Handler    │─────▶│     RabbitMQ     │
│                    │      └──────────────────────┘      │                  │
└────────────────────┘                                    └──────────────────┘
```

## Project Structure

```
src/
├── config/
│   └── index.js
├── controllers/
│   └── webhook.controller.js
├── services/
│   ├── validation.service.js
│   └── queue.service.js
├── routes/
│   └── index.js
└── index.js
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service Port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `RABBITMQ_URL` | RabbitMQ URL | `amqp://localhost` |
| `META_VERIFY_TOKEN` | Meta Token | *Required* |
| `META_APP_SECRET` | Meta Secret | *Required* |
| `STATE_SERVICE_URL` | State Service | `http://state-manager:3005` |
| `AUTH_SERVICE_URL` | Auth Service | `http://auth-service:3004` |
| `GENESYS_BASE_URL` | Genesys URL | *Required* |

## API Endpoints

### Meta
```
GET  /webhook/meta          # Verification
POST /webhook/meta          # Events (Legacy/Direct)
```

### Genesys
```
POST /webhook/genesys       # Genesys Event Bridge
```

### System
```
GET /health                 # Health check
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
docker build -t webhook-handler .
```

Run the container:
```bash
docker run -p 3001:3001 --env-file .env webhook-handler
```

## Dependencies

- **express**: Web framework
- **amqplib**: RabbitMQ client
- **axios**: HTTP client
- **dotenv**: Environment configuration
