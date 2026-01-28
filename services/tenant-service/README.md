# Tenant Service

Manages multi-tenant configuration, credentials, and WhatsApp Business API settings for the WhatsApp-Genesys integration platform. This service allows the system to serve multiple organizations securely from a single deployment.

- **Tenant Management**: Create, list, and retrieve tenant configurations.
- **WhatsApp Onboarding**: Handle "Embedded Signup" flow and credentials.
- **Credential Vault**: Secure storage for external system secrets (Genesys, Meta).
- **Context Provider**: Supplies configuration context to other microservices.

## Architecture

```
┌─────────────────┐       ┌──────────────────┐
│  Admin          │──────▶│   Tenant         │
│  Dashboard      │       │   Service        │
└─────────────────┘       └──────────────────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │  PostgreSQL  │
                          │   (Tenants)  │
                          └──────────────┘
```

## Project Structure

```
src/
├── config/
│   └── index.js            # Database and Redis config
├── controllers/
│   ├── credential.controller.js # Credential management
│   ├── tenant.controller.js     # Tenant CRUD operations
│   └── whatsapp.controller.js   # WhatsApp configuration
├── middleware/
│   └── auth.middleware.js       # Request authentication
├── routes/
│   ├── credential.routes.js     # Credential routes
│   ├── tenant.routes.js         # Tenant routes
│   └── whatsapp.routes.js       # WhatsApp routes
├── services/
│   ├── credential.service.js    # Credential logic
│   ├── tenant.service.js        # Tenant logic
│   └── whatsapp.service.js      # WhatsApp logic
├── utils/
│   └── encryption.util.js       # Credential encryption
├── app.js                       # Express app setup
└── server.js                    # Service entry point
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `3007` |
| `NODE_ENV` | Environment | `development` |
| `DB_HOST` | PostgreSQL Host | `localhost` |
| `DB_PORT` | PostgreSQL Port | `5432` |
| `DB_NAME` | Database Name | `whatsapp_genesys` |
| `DB_USER` | Database User | `postgres` |
| `DB_PASSWORD` | Database Password | `secure_password` |
| `REDIS_URL` | Redis Connection URL | `redis://localhost:6379` |
| `META_APP_ID` | Meta App ID for Onboarding | *Required* |
| `META_APP_SECRET` | Meta App Secret for Onboarding | *Required* |

## API Endpoints

### Tenants
```
GET /api/tenants
POST /api/tenants
GET /api/tenants/:tenantId
```

### Credentials
```
// Store Genesys Credentials
PUT /api/tenants/:tenantId/genesys/credentials
Content-Type: application/json
{
    "clientId": "...",
    "clientSecret": "...",
    "region": "mypurecloud.com"
}

// Get Credentials (Masked)
GET /api/tenants/:tenantId/genesys/credentials
```

### WhatsApp Configuration
```
// Update WhatsApp Config
POST /api/tenants/:tenantId/whatsapp
Content-Type: application/json
{
    "wabaId": "...",
    "phoneNumberId": "..."
}

// Signup Callback
POST /api/whatsapp/signup
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
docker build -t tenant-service .
```

Run the container:
```bash
docker run -p 3007:3007 --env-file .env tenant-service
```

## Dependencies

- **express**: Web server framework
- **pg**: PostgreSQL client
- **redis**: Caching layer
- **axios**: HTTP client
- **dotenv**: Environment configuration
