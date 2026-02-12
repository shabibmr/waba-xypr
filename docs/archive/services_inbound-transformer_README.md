# Inbound Transformer Service

Transforms incoming WhatsApp messages (Meta format) into Genesys Open Messaging format. This service acts as the translation layer for customer-to-agent communication.

- **Message Transformation**: Converts WhatsApp JSON to Genesys JSON.
- **Media Support**: Handles images, audio, video, and documents.
- **State Management**: Creates or updates conversation contexts in the State Manager.
- **Routing**: Sends transformed messages to the Genesys API Service.

## Architecture

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│   RabbitMQ      │──────▶│ Inbound Transformer  │──────▶│   Genesys API   │
│ (Inbound Queue) │       │ Service              │       │   Service       │
└─────────────────┘       └──────────────────────┘       └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │  State Manager  │
                            └─────────────────┘
```

## Project Structure

```
src/
├── config/
│   └── index.js             # Configuration
├── consumers/
│   └── inboundConsumer.js   # RabbitMQ consumer
├── services/
│   ├── transformer.service.js # Translation logic
│   ├── genesys.service.js     # API integration
│   └── state.service.js       # Context management
├── controllers/
│   └── transform.controller.js # Manual transform API
├── routes/
│   └── index.js
└── index.js
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service Port | `3002` |
| `NODE_ENV` | Environment | `development` |
| `RABBITMQ_URL` | RabbitMQ URL | `amqp://localhost` |
| `STATE_SERVICE_URL` | State Manager URL | `http://state-manager:3005` |
| `GENESYS_API_URL` | Genesys API Service URL | `http://genesys-api:3010` |

## API Endpoints

### System
```
POST /transform/inbound   # Manual transformation trigger
GET  /health              # Health check
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
docker build -t inbound-transformer .
```

Run the container:
```bash
docker run -p 3002:3002 --env-file .env inbound-transformer
```

## Dependencies

- **express**: Web framework
- **amqplib**: RabbitMQ client
- **axios**: HTTP client
- **dotenv**: Environment configuration
