# State Manager Service

The central nervous system of the platform. It maps WhatsApp users to Genesys conversations, maintains conversation context, and tracks message delivery states.

- **Conversation Mapping**: Maps `wa_id` (WhatsApp ID) to `conversationId` (internal/Genesys).
- **Context Persistence**: Stores active conversation state in Redis/DB.
- **Message Tracking**: Logs message status (sent, delivered, read) for reporting.
- **Statistics**: Provides real-time metrics on active conversations.

## Architecture

```
┌─────────────────┐       ┌────────────────────┐       ┌─────────────────┐
│ Webhook Handler │──────▶│   State Manager    │──────▶│   Redis / DB    │
│ / Transformers  │       │                    │       │   (Persistence) │
└─────────────────┘       └────────────────────┘       └─────────────────┘
```

## Project Structure

```
src/
├── config/
│   └── index.js         # DB/Redis config
├── controllers/
│   ├── context.controller.js    # Context API
│   ├── mapping.controller.js    # Mapping API
│   ├── message.controller.js    # Message tracking API
│   └── stats.controller.js      # Stats API
├── services/
│   ├── context.service.js       # Context logic
│   ├── mapping.service.js       # Mapping logic
│   └── message.service.js       # Message logic
├── routes/
│   └── index.js
└── index.js
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service Port | `3005` |
| `NODE_ENV` | Environment | `development` |
| `DB_HOST` | Database Host | `localhost` |
| `DB_PORT` | Database Port | `5432` |
| `DB_NAME` | Database Name | `whatsapp_genesys` |
| `DB_USER` | Database User | `postgres` |
| `DB_PASSWORD` | Database Password | `secure_password` |
| `REDIS_URL` | Redis URL | `redis://localhost:6379` |

## API Endpoints

### Mappings
```
POST /state/mapping              # Create/Update mapping
GET  /state/mapping/:waId        # Get by WhatsApp ID
GET  /state/conversation/:convId # Get by Conversation ID
```

### Context
```
POST /state/context/:conversationId # Update context
GET  /state/context/:conversationId # Get context
```

### Messages
```
POST  /state/message              # Track new message
PATCH /state/message/:messageId   # Update status (sent/read)
```

### System
```
GET /state/stats   # Active conversation stats
GET /health        # Health check
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
docker build -t state-manager .
```

Run the container:
```bash
docker run -p 3005:3005 --env-file .env state-manager
```

## Dependencies

- **express**: Web framework
- **pg**: PostgreSQL client
- **redis**: Caching client
- **uuid**: ID generation
- **dotenv**: Environment configuration
