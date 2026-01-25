# Inbound Transformer Service

The Inbound Transformer service is a critical component in the WhatsApp-to-Genesys messaging pipeline. It transforms incoming WhatsApp messages from Meta's format to Genesys Open Messaging format and routes them to the appropriate conversation.

## Architecture

### Components

- **Config**: Centralized configuration for RabbitMQ and external services
- **Consumers**: RabbitMQ message consumer for processing inbound messages
- **Controllers**: Request handlers for API endpoints
- **Routes**: Express route definitions
- **Services**: Business logic for transformation, Genesys integration, and state management
- **Utils**: Message formatting utilities

### Message Flow

1. Message arrives in `inbound-messages` queue from webhook service
2. Consumer picks up message and calls transformer service
3. Transformer service:
   - Gets/creates conversation mapping from state manager
   - Transforms message to Genesys format
   - Sends message to Genesys Cloud
   - Tracks message in state manager

## Folder Structure

```
inbound-transformer/
├── src/
│   ├── config/
│   │   ├── rabbitmq.js          # RabbitMQ connection config
│   │   └── services.js          # External service URLs
│   ├── consumers/
│   │   └── inboundConsumer.js   # RabbitMQ message consumer
│   ├── controllers/
│   │   ├── healthController.js  # Health check logic
│   │   └── transformController.js # Transform request handlers
│   ├── routes/
│   │   ├── health.js            # Health check routes
│   │   └── transform.js         # Transform routes
│   ├── services/
│   │   ├── genesysService.js    # Genesys API integration
│   │   ├── stateService.js      # State manager integration
│   │   └── transformerService.js # Core transformation logic
│   ├── utils/
│   │   └── messageFormatter.js  # Message formatting utilities
│   └── index.js                 # Main application entry
├── tests/
├── .env.example
├── Dockerfile
├── package.json
└── README.md
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `3002` |
| `RABBITMQ_URL` | RabbitMQ connection URL | `amqp://localhost` |
| `STATE_SERVICE_URL` | State manager service URL | `http://state-manager:3005` |
| `AUTH_SERVICE_URL` | Auth service URL | `http://auth-service:3004` |
| `GENESYS_BASE_URL` | Genesys Cloud base URL | (required) |

## API Endpoints

### Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "rabbitmq": "connected"
}
```

### Manual Transform (Testing)
```
POST /transform/inbound
```

**Request Body:** Meta WhatsApp message format

**Response:**
```json
{
  "success": true,
  "message": "Message transformed and sent"
}
```

## Message Formats

### Supported Message Types

- Text messages
- Images (with optional caption)
- Documents
- Audio/Voice messages
- Videos (with optional caption)
- Location sharing

### Transformation Logic

Messages are transformed from Meta's WhatsApp format to Genesys Open Messaging format:

- **New conversations**: Creates new Genesys conversation with user profile
- **Existing conversations**: Appends to existing conversation thread
- **Metadata preservation**: Maintains WhatsApp-specific metadata for correlation

## Running the Service

### Local Development

```bash
npm install
npm run dev
```

### Production

```bash
npm start
```

### Docker

```bash
docker build -t inbound-transformer .
docker run -p 3002:3002 --env-file .env inbound-transformer
```

## Error Handling

- **Message processing errors**: Messages are requeued with 5-second delay
- **Connection errors**: Automatic reconnection with exponential backoff
- **API errors**: Logged and propagated to caller

## Dependencies

- **express**: Web framework for API endpoints
- **amqplib**: RabbitMQ client
- **axios**: HTTP client for service communication
- **dotenv**: Environment variable management

## Related Services

- **whatsapp-webhook-service**: Receives webhooks from Meta
- **state-manager**: Manages conversation and message state
- **auth-service**: Provides Genesys authentication
- **outbound-transformer**: Handles Genesys-to-WhatsApp transformations
