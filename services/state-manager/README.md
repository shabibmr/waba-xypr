# State Manager Service

The State Manager Service handles conversation state, mappings between WhatsApp and Genesys Cloud, and message tracking.

## Features

- **Conversation Mapping**: Maps WhatsApp user IDs (wa_id) to internal conversation IDs and Genesys interactions.
- **Context Management**: Stores contextual information for active conversations.
- **Message Tracking**: Tracks message delivery status and direction.
- **Statistics**: Provides basic stats on active conversations and messages.

## Project Structure

```
src/
├── config/         # Database and Redis configuration
├── controllers/    # Request handlers
├── services/       # Business logic
├── routes/         # Route definitions
├── utils/          # Utility functions
├── index.js        # Entry point
```

## API Endpoints

### Mappings
- `POST /state/mapping`: Create or update a conversation mapping.
- `GET /state/mapping/:waId`: Get mapping by WhatsApp ID.
- `GET /state/conversation/:conversationId`: Get mapping by conversation ID.

### Context
- `POST /state/context/:conversationId`: Update conversation context.
- `GET /state/context/:conversationId`: Get conversation context.

### Message Tracking
- `POST /state/message`: Track a new message.
- `PATCH /state/message/:messageId`: Update message status.

### System
- `GET /state/stats`: System statistics.
- `GET /health`: Health check.

## Environment Variables

| Variable | Description |
|----------|-------------|
| PORT | Server port (default: 3005) |
| DB_HOST | PostgreSQL host |
| DB_PORT | PostgreSQL port |
| DB_NAME | Database name |
| DB_USER | Database user |
| DB_PASSWORD | Database password |
| REDIS_URL | Redis connection URL |

## Running the Service

```bash
npm start
```
