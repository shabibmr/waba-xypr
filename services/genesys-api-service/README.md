# Genesys API Service

Genesys Cloud API integration service. Manages all outbound communication to Genesys Cloud, including message sending, conversation management, and user retrieval.

- **Message Sending**: Delivers inbound WhatsApp messages to Genesys Open Messaging.
- **Conversation Management**: Handles disconnects, typing indicators, and attribute updates.
- **Organization Sync**: Retrieves agent and queue details for the Agent Portal.
- **Multi-Tenant**: Orchestrates API calls using tenant-specific OAuth credentials.

## Architecture

```
┌────────────────────┐      ┌─────────────────────┐      ┌─────────────────┐
│  Transformers /    │─────▶│ Genesys API Service │─────▶│  Genesys Cloud  │
│  Agent Portal      │      └─────────────────────┘      │  Public API     │
└────────────────────┘                 │                 └─────────────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │  Tenant Service  │
                              │ (Get OAuth Creds)│
                              └──────────────────┘
```

## Project Structure

```
src/
├── config/
│   └── index.js         # Configuration
├── controllers/
│   ├── conversation.controller.js # Conversation actions
│   ├── message.controller.js      # Message sending
│   └── organization.controller.js # User/Queue sync
├── services/
│   ├── genesys.service.js   # Core API logic
│   └── auth.service.js      # Token handling
├── routes/
│   └── index.js         # Route definitions
└── index.js             # Entry point
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service Port | `3010` |
| `NODE_ENV` | Environment | `development` |
| `TENANT_SERVICE_URL` | Tenant Service URL | `http://tenant-service:3007` |
| `AUTH_SERVICE_URL` | Auth Service URL | `http://auth-service:3004` |

## API Endpoints

### Messages
```
POST /genesys/messages/inbound  # Send message to Genesys
POST /genesys/receipts          # Send delivery receipt
```

### Conversations
```
GET   /genesys/conversations/:conversationId            # Get details
PATCH /genesys/conversations/:conversationId            # Update attributes
POST  /genesys/conversations/:conversationId/disconnect # End conversation
POST  /genesys/conversations/:conversationId/typing     # Send typing
GET   /genesys/conversations/:conversationId/messages   # Get history
```

### Organization
```
GET /genesys/organization         # Get org details
GET /genesys/organization/users   # List agents
GET /genesys/users/:userId        # Get specific agent
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
docker build -t genesys-api-service .
```

Run the container:
```bash
docker run -p 3010:3010 --env-file .env genesys-api-service
```

## Dependencies

- **express**: Web framework
- **axios**: HTTP client
- **amqplib**: RabbitMQ integration (if used for async events)
- **dotenv**: Environment configuration
