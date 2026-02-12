# Outbound Transformer Service

Transforms outbound messages from Genesys Cloud format to Meta WhatsApp API format and sends them to end users via WhatsApp.

## Overview

The Outbound Transformer is a critical component in the WhatsApp Business API integration architecture. It:

- Consumes outbound messages from RabbitMQ queue
- Transforms Genesys Cloud message format to Meta WhatsApp format
- **Fetches tenant-specific WhatsApp credentials** for each message
- Sends messages to WhatsApp users via Meta Graph API
- Tracks message state and delivery status
- Supports both text messages and template messages
- **Multi-tenant aware**: Each tenant uses their own WhatsApp Business Account

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   RabbitMQ      │────▶│   Outbound       │────▶│  Meta WhatsApp  │
│   Queue         │     │   Transformer    │     │  Graph API      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  State Manager   │
                        │  Service         │
                        └──────────────────┘
```

## Project Structure

```
src/
├── config/
│   └── index.js                    # Centralized configuration
├── controllers/
│   ├── health.controller.js        # Health check endpoint
│   ├── template.controller.js      # Template message sending
│   └── transform.controller.js     # Manual transformation endpoint
├── middleware/
│   └── error.middleware.js         # Global error handling
├── routes/
│   ├── health.routes.js            # Health check routes
│   ├── template.routes.js          # Template routes
│   ├── transform.routes.js         # Transform routes
│   └── index.js                    # Route aggregator
├── services/
│   ├── message-processor.service.js # Message processing orchestration
│   ├── rabbitmq.service.js         # RabbitMQ connection & consumption
│   ├── state.service.js            # State manager HTTP client
│   ├── transformer.service.js      # Message format transformation
│   └── whatsapp.service.js         # WhatsApp API integration
├── utils/
│   ├── signature.util.js           # Webhook signature generation
│   └── template.util.js            # Template parsing utilities
└── index.js                        # Application entry point
```

## Environment Variables

Create a `.env` file based on `.env.example`:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3003` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `RABBITMQ_URL` | RabbitMQ connection URL | `amqp://localhost` |
| `STATE_SERVICE_URL` | State manager service URL | `http://state-manager:3005` |
| `META_ACCESS_TOKEN` | Meta WhatsApp API access token | Required |
| `META_APP_SECRET` | Meta app secret for webhooks | Required |

## API Endpoints

### Health Check
```
GET /health
```
Returns service health status and RabbitMQ connection state.

### Manual Transform (Testing)
```
POST /transform/outbound
Content-Type: application/json

{
  "messageId": "msg-123",
  "conversationId": "conv-456",
  "text": "Hello from Genesys"
}
```
Manually trigger message transformation and sending.

### Send Template Message
```
POST /send/template
Content-Type: application/json

{
  "conversationId": "conv-456",
  "templateName": "welcome_message",
  "parameters": ["John", "Doe"],
  "buttonParams": "tracking-123"
}
```
Send a WhatsApp template message.

## Message Flow

### Outbound Message Processing

1. **Message Consumption**: Service consumes messages from `outbound-messages` RabbitMQ queue
2. **State Lookup**: Retrieves WhatsApp ID mapping from state-manager service
3. **Transformation**: Converts Genesys format to Meta WhatsApp format
4. **API Call**: Sends message via Meta Graph API
5. **State Update**: Stores message tracking information

### Template Message Support

The service supports template messages using special markers in the message text:

```
{{TEMPLATE:template_name}}
{{BODY:param1|param2|param3}}
{{BUTTON:button_param}}
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
docker build -t outbound-transformer .
```

Run the container:
```bash
docker run -p 3003:3003 --env-file .env outbound-transformer
```

## Dependencies

- **express**: HTTP server framework
- **amqplib**: RabbitMQ client
- **axios**: HTTP client for external APIs
- **dotenv**: Environment variable management

## Error Handling

The service implements comprehensive error handling:

- RabbitMQ connection errors trigger automatic reconnection
- Message processing errors result in message requeue after 5-second delay
- HTTP errors are logged with detailed error information
- All errors are handled by centralized error middleware

## Monitoring

Health check endpoint provides:
- Service status
- RabbitMQ connection status

Monitor logs for:
- Message processing success/failure
- Meta API errors
- RabbitMQ connection issues

## Related Services

- **State Manager**: Manages conversation and message state
- **Inbound Transformer**: Handles incoming WhatsApp messages
- **API Gateway**: Routes messages between Genesys and transformers
