# Genesys Webhook Service

Service responsible for handling incoming webhooks from Genesys Cloud and orchestrating message flows.

## Features

- **Outbound Messages**: Handles agent messages (`agent.message`) and queues them for delivery to customers via WhatsApp.
- **Event Handling**: Processes conversation events (typing indicators, participant joins/leaves, disconnects).
- **Tenant Resolution**: Resolves tenant context from Conversation ID or Integration ID.
- **State Management**: Updates conversation status in the State Manager service.

## Architecture

- **Worker Pattern**: Queues tasks in RabbitMQ for asynchronous processing by other services (like `outbound-transformer`).
- **REST API**: Exposes endpoints for Genesys webhook configuration.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `3011` |
| `NODE_ENV` | Environment | `development` |
| `RABBITMQ_URL` | RabbitMQ connection URL | `amqp://localhost` |
| `TENANT_SERVICE_URL` | Tenant Service URL | `http://tenant-service:3007` |
| `STATE_SERVICE_URL` | State Manager Service URL | `http://state-manager:3005` |

## API Endpoints

### POST /webhook/genesys/outbound
Handles outbound messages from Genesys agents.

### POST /webhook/genesys/events
Handles Genesys conversation events.

### POST /webhook/genesys/agent-state
Handles agent presence/state changes.

### GET /health
Service health check.

## Running Locally

```bash
npm install
npm start
```
