# API Gateway Service

API Gateway for WhatsApp-Genesys integration platform.

## Features

- Request routing to microservices
- Rate limiting
- CORS handling  
- Load balancing
- Health checks

## Environment Variables

```
PORT=3000
REDIS_URL=redis://localhost:6379
WEBHOOK_SERVICE_URL=http://webhook-handler:3001
INBOUND_SERVICE_URL=http://inbound-transformer:3002
OUTBOUND_SERVICE_URL=http://outbound-transformer:3003
AUTH_SERVICE_URL=http://auth-service:3004
STATE_SERVICE_URL=http://state-manager:3005
ALLOWED_ORIGINS=http://localhost:3006
```

## Running

```bash
npm install
npm start
```

## Docker

```bash
docker build -t api-gateway .
docker run -p 3000:3000 api-gateway
```
