# Genesys API Service

Genesys Cloud API integration service for WhatsApp-Genesys integration platform.

## Features

- Send inbound messages to Genesys Cloud
- Send delivery receipts and status updates
- Manage conversations (get, update, disconnect)
- Send typing indicators
- Retrieve conversation messages
- Multi-tenant support with tenant-specific credentials
- OAuth token management

## Environment Variables

```
PORT=3010
TENANT_SERVICE_URL=http://tenant-service:3007
AUTH_SERVICE_URL=http://auth-service:3004
NODE_ENV=development
```

## API Endpoints

### Messages
- `POST /genesys/messages/inbound` - Send inbound message to Genesys
- `POST /genesys/receipts` - Send delivery receipt

### Conversations
- `GET /genesys/conversations/:conversationId` - Get conversation details
- `PATCH /genesys/conversations/:conversationId` - Update conversation attributes
- `POST /genesys/conversations/:conversationId/disconnect` - Disconnect conversation
- `POST /genesys/conversations/:conversationId/typing` - Send typing indicator
- `GET /genesys/conversations/:conversationId/messages` - Get conversation messages

### Organization & Users

- `GET /genesys/organization` - Get organization details
- `GET /genesys/organization/users` - Get all users in organization (paginated)
- `GET /genesys/users/:userId` - Get specific user details

**Example: Get Organization Users**

```bash
# Get first page of users (100 per page)
curl -H "X-Tenant-ID: tenant-123" \
  http://localhost:3010/genesys/organization/users?pageSize=100&pageNumber=1

# Response
{
  "users": [
    {
      "id": "genesys-user-id",
      "name": "John Doe",
      "email": "john@example.com",
      "authorization": {
        "roles": [
          { "name": "Admin" }
        ]
      }
    }
  ],
  "pageCount": 3,
  "total": 250,
  "tenantId": "tenant-123"
}
```

**Example: Get Organization Details**

```bash
curl -H "X-Tenant-ID: tenant-123" \
  http://localhost:3010/genesys/organization

# Response
{
  "organization": {
    "id": "org-id",
    "name": "Acme Corporation",
    "domain": "acme.mypurecloud.com"
  },
  "tenantId": "tenant-123"
}
```

### Health
- `GET /health` - Service health check

## Running

```bash
npm install
npm start
```

## Development

```bash
npm run dev
```

## Docker

```bash
docker build -t genesys-api-service .
docker run -p 3010:3010 genesys-api-service
```

## Architecture

```
src/
├── config/          # Configuration management
├── controllers/     # Request/response handlers
├── routes/          # Route definitions
├── services/        # Business logic
├── middleware/      # Express middleware
├── utils/           # Utility functions
└── index.js         # Application entry point
```
