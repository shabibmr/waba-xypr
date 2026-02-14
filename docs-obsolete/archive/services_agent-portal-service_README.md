# Agent Portal Service

Backend service for the agent portal, handling authentication, WhatsApp setup, and conversation management for Genesys-licensed agents.

## Features

- **Agent Management**: Registration and profile management
- **Genesys OAuth**: Integration with Genesys Cloud for authentication
- **WhatsApp Setup**: Handle embedded signup callbacks
- **Conversation API**: Fetch conversations and message history
- **Message Sending**: Send text and template messages
- **Real-time Notifications**: Socket.io server for inbound message alerts

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **Message Queue**: RabbitMQ
- **Real-time**: Socket.io
- **Authentication**: JWT

## Environment Variables

See `.env.example` for all required configuration.

Key variables:
- `PORT`: Service port (default: 3015)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for signing JWT tokens
- `GENESYS_CLIENT_ID`: Genesys OAuth client ID
- `GENESYS_CLIENT_SECRET`: Genesys OAuth client secret

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## Database Setup

Run the migration script to create required tables:

```bash
psql -U user -d whatsapp_genesys -f ../../docker/postgres/02-agent-portal-schema.sql
```

## API Endpoints

### Authentication

- `POST /api/agents/signup` - Register new agent
- `GET /api/agents/auth/login` - Initiate Genesys OAuth
- `GET /api/agents/auth/callback` - OAuth callback handler
- `POST /api/agents/auth/logout` - Logout
- `GET /api/agents/profile` - Get agent profile (auth required)

### WhatsApp

- `POST /api/agents/whatsapp/setup` - Complete WhatsApp setup (auth required)
- `GET /api/agents/whatsapp/status` - Get WhatsApp status (auth required)

### Conversations

- `GET /api/conversations` - List conversations (auth required)
- `GET /api/conversations/:id` - Get conversation details (auth required)
- `GET /api/conversations/:id/messages` - Get message history (auth required)

### Messages

- `POST /api/messages/send` - Send text message (auth required)
- `POST /api/messages/send/template` - Send template message (auth required)
- `POST /api/messages/upload` - Upload media (auth required)

### Organization Management

- `POST /api/organization/sync-users` - Sync users from Genesys (admin only, auth required)
- `GET /api/organization/users` - List organization users (admin/supervisor, auth required)

**Example: Sync Organization Users**

Administrators can bulk import all users from their Genesys organization:

```bash
# Sync users from Genesys
curl -X POST \
  -H "Authorization: Bearer <admin-jwt-token>" \
  http://localhost:3015/api/organization/sync-users

# Response
{
  "success": true,
  "message": "Organization users synced successfully",
  "results": {
    "created": 15,
    "updated": 5,
    "skipped": 0,
    "total": 20
  }
}
```

**Example: List Organization Users**

Admins and supervisors can view all users in their organization:

```bash
curl -H "Authorization: Bearer <jwt-token>" \
  http://localhost:3015/api/organization/users

# Response
{
  "users": [
    {
      "user_id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "admin",
      "is_active": true,
      "last_login_at": "2026-01-15T12:00:00Z",
      "created_at": "2026-01-01T10:00:00Z"
    }
  ],
  "total": 20
}
```

**Role Mapping**

Users are automatically assigned roles based on their Genesys permissions:
- **Admin**: Users with "Admin" role in Genesys
- **Supervisor**: Users with "Supervisor" role in Genesys
- **Agent**: Default role for all other users

## Socket.io

Agents connect to Socket.io for real-time notifications.

**Authentication**: Pass JWT token in `socket.handshake.auth.token`

**Events**:
- `inbound-message`: Emitted when new WhatsApp message arrives

## Docker

```bash
# Build
docker build -t agent-portal-service .

# Run
docker run -p 3015:3015 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  agent-portal-service
```

## License

MIT
