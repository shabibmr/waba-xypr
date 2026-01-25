# Tenant Service

The Tenant Service is responsible for managing multi-tenant data, including tenant creation, configuration, and credential management. It also handles WhatsApp Business API configurations and authentication.

## Service Structure

- **src/config**: Configuration for Database (PostgreSQL) and Redis.
- **src/controllers**: HTTP Request handlers.
- **src/routes**: API Route definitions.
- **src/services**: Business logic and database interactions.
- **src/utils**: Utility functions (masking, etc.).
- **src/app.js**: Express application setup.
- **src/server.js**: Server entry point and initialization.

## Key Features

- **Tenant Management**: Create, list, and retrieve tenant details.
- **WhatsApp Configuration**: Manage WABA ID, Phone Number ID, and Access Tokens.
- **Credentials Management**: Store and retrieve external system credentials securely.
- **WhatsApp Onboarding**: Handle embedded signup callbacks.

## API Endpoints

### Tenants

- `POST /tenants`: Create a new tenant.
- `GET /tenants`: List all tenants.
- `GET /tenants/:tenantId`: Get specific tenant details.

### WhatsApp Configuration

- `POST /tenants/:tenantId/whatsapp`: Update/Create WhatsApp config.
- `GET /tenants/:tenantId/whatsapp`: Get masked WhatsApp config.
- `POST /api/whatsapp/signup`: Handle WhatsApp signup callback.

### Credentials

- `POST /tenants/:tenantId/credentials`: Store credentials.
- `GET /tenants/:tenantId/credentials/:type`: Get credentials by type.

### Genesys OAuth Credentials

- `PUT /tenants/:tenantId/genesys/credentials`: Set Genesys OAuth credentials
- `GET /tenants/:tenantId/genesys/credentials`: Get Genesys OAuth credentials (masked)

**Example: Set Genesys Credentials**

```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "7c513299-40e9-4c51-a34f-935bd56cfb56",
    "clientSecret": "-Yn-vPj1HCDq8HvYeadbLVBAx0I5wVkvcVKdS1MqRXo",
    "region": "aps1.mypurecloud.com"
  }' \
  http://localhost:3007/api/tenants/acme_corp/genesys/credentials
```

**Example: Get Genesys Credentials (Masked)**

```bash
curl http://localhost:3007/api/tenants/acme_corp/genesys/credentials

# Response
{
  "configured": true,
  "clientId": "7c513299-40e9-4c51-a34f-935bd56cfb56",
  "clientSecret": "***RXo",
  "region": "aps1.mypurecloud.com"
}
```

## Environment Variables

Ensure the following environment variables are set:

- `PORT`: Service port (default: 3007)
- `DB_HOST`: Database host
- `DB_PORT`: Database port
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `REDIS_URL`: Redis connection URL
- `META_APP_ID`: Meta App ID for WhatsApp Onboarding
- `META_APP_SECRET`: Meta App Secret for WhatsApp Onboarding

## Running the Service

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Start in production mode
npm start
```
