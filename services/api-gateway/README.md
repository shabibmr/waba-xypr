# API Gateway Service

The central entry point for the WhatsApp-Genesys integration platform. It routes incoming requests to appropriate microservices, handles rate limiting, and manages cross-origin resource sharing (CORS).

- **Unified Entry Point**: Single domain for all API interactions.
- **Service Routing**: Dynamic proxying to backend microservices.
- **Rate Limiting**: Protects system from abuse.
- **Security**: Centralized CORS and header management.

## Architecture

```
                                  ┌──────────────────┐
                              ┌──▶│  Auth Service    │
                              │   └──────────────────┘
┌──────────────┐    ┌─────────┴────────┐    ┌──────────────────┐
│  Client /    │───▶│   API Gateway    │───▶│  Tenant Service  │
│  Webhook     │    └─────────┬────────┘    └──────────────────┘
└──────────────┘              │
                              │   ┌──────────────────┐
                              └──▶│  Transformers    │
                                  └──────────────────┘
```

## Project Structure

```
src/
├── config/
│   └── config.js           # Configuration loader
├── middleware/
│   ├── errorHandler.js     # Global error handling
│   ├── rateLimiter.js      # Rate limiting logic
│   └── security.js         # Security headers (Helix, CORS)
├── routes/
│   ├── gateway.js          # Service routing rules
│   └── health.js           # Health check endpoint
├── utils/
│   └── proxyFactory.js     # Proxy creation utility
└── index.js                # App entry point
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Gateway Port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `REDIS_URL` | Redis for Rate Limiting | `redis://localhost:6379` |
| `ALLOWED_ORIGINS` | CORS Allowed Origins | `http://localhost:3006,http://localhost:3014` |
| `AUTH_SERVICE_URL` | Auth Service URL | `http://auth-service:3004` |
| `TENANT_SERVICE_URL` | Tenant Service URL | `http://tenant-service:3007` |
| `STATE_SERVICE_URL` | State Manager URL | `http://state-manager:3005` |
| `WHATSAPP_WEBHOOK_URL`| WhatsApp Webhook URL | `http://whatsapp-webhook:3009` |
| `GENESYS_WEBHOOK_URL`| Genesys Webhook URL | `http://genesys-webhook:3011` |
| `GENESYS_API_URL` | Genesys API URL | `http://genesys-api:3010` |

## API Endpoints

### System
```
GET /health
```

### Routing Map

| path | Target Service |
|------|----------------|
| `/auth/*` | **Auth Service** |
| `/api/tenants/*` | **Tenant Service** |
| `/genesys/*` | **Genesys API Service** |
| `/webhook/meta` | **WhatsApp Webhook Service** |
| `/webhook/genesys` | **Genesys Webhook Service** |
| `/transform/inbound` | **Inbound Transformer** |
| `/transform/outbound` | **Outbound Transformer** |
| `/state/*` | **State Manager** |
| `/api/agents/*` | **Agent Portal Service** |

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
docker build -t api-gateway .
```

Run the container:
```bash
docker run -p 3000:3000 --env-file .env api-gateway
```

## Dependencies

- **express**: Web framework
- **http-proxy-middleware**: Proxying requests
- **express-rate-limit**: Rate limiting
- **cors**: CORS support
- **helmet**: Security headers
