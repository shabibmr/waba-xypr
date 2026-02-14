# WhatsApp-Genesys Cloud Integration - Setup Guide

## Architecture Overview

This production-ready microservices architecture integrates WhatsApp (Meta) with Genesys Cloud using a robust middleware layer.

### Components

1. **API Gateway** - Load balancing, rate limiting, request routing
2. **WhatsApp Webhook Service** - Receives and validates webhooks from Meta
3. **Genesys Webhook Service** - Receives and validates webhooks from Genesys
4. **Inbound Transformer** - Converts Meta JSON → Genesys Open Messaging format
4. **Outbound Transformer** - Converts Genesys JSON → Meta WhatsApp format
5. **Auth Service** - OAuth 2.0 token management for Genesys
6. **State Manager** - Conversation mapping (wa_id ↔ conversation_id)
7. **Admin Dashboard** - Monitoring and configuration UI

### Infrastructure

- **PostgreSQL** - Persistent storage for mappings and message tracking
- **Redis** - Token caching and session management
- **RabbitMQ** - Message queue for async processing

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- Meta Business Account with WhatsApp Business API access
- Genesys Cloud organization with API credentials

## Quick Start

### 1. Clone and Setup

```bash
# Create project structure
mkdir whatsapp-genesys-integration
cd whatsapp-genesys-integration

# Create service directories
mkdir -p api-gateway inbound-transformer \
         outbound-transformer auth-service state-manager admin-dashboard
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Required credentials:
- **Meta**: APP_SECRET, VERIFY_TOKEN, ACCESS_TOKEN
- **Genesys**: CLIENT_ID, CLIENT_SECRET, REGION

### 3. Deploy with Docker

```bash
# Build and start all services
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Configure Meta Webhook

1. Go to Meta App Dashboard → WhatsApp → Configuration
2. Set Webhook URL: `https://yourdomain.com/webhook/meta`
3. Set Verify Token: (from your .env)
4. Subscribe to: `messages`, `message_status`

### 5. Configure Genesys Webhook

1. Genesys Cloud Admin → Integrations → Open Messaging
2. Create new integration
3. Set Outbound Webhook: `https://yourdomain.com/webhook/genesys`
4. Configure message routing in Architect

## Service Endpoints

| Service | Port | Endpoints |
|---------|------|-----------|
| API Gateway | 3000 | `/health`, `/webhook/*`, `/transform/*`, `/auth/*`, `/state/*` |
| WhatsApp Webhook | 3009 | `/webhook/whatsapp`, `/health` |
| Genesys Webhook | 3011 | `/webhook/genesys/*`, `/health` |
| Inbound Transformer | 3002 | `/transform/inbound`, `/health` |
| Outbound Transformer | 3003 | `/transform/outbound`, `/send/template`, `/health` |
| Auth Service | 3004 | `/auth/token`, `/auth/refresh`, `/auth/validate`, `/health` |
| State Manager | 3005 | `/state/mapping`, `/state/conversation`, `/state/context`, `/health` |
| Admin Dashboard | 3006 | Web UI |

## Message Flow

### Inbound (Customer → Agent)

1. Customer sends WhatsApp message
2. Meta posts to `/webhook/meta`
3. Webhook Handler validates signature, queues message
4. Inbound Transformer converts format
5. State Manager maps wa_id → conversation_id
6. Auth Service provides OAuth token
7. POST to Genesys Open Message API
8. Message routed to agent

### Outbound (Agent → Customer)

1. Agent sends message in Genesys
2. Genesys posts to `/webhook/genesys`
3. Webhook Handler queues message
4. Outbound Transformer converts format
5. State Manager retrieves wa_id
6. POST to Meta Graph API
7. Message delivered to customer
8. Delivery receipts flow back

## Testing

### Health Checks

```bash
# Check all services
curl http://localhost:3000/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
```

### Test Webhook Verification

```bash
# Meta webhook verification (GET)
curl "http://localhost:3009/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
```

### Test Message Transformation

```bash
# Test inbound transformation
curl -X POST http://localhost:3002/transform/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "test123",
    "from": "1234567890",
    "contactName": "Test User",
    "timestamp": "1704067200",
    "type": "text",
    "content": {"text": "Hello from test"}
  }'
```

## Monitoring

Access the Admin Dashboard:
```
http://localhost:3006
```

Features:
- Real-time service health monitoring
- Conversation statistics
- Message tracking
- System information

## Production Deployment

### Security Best Practices

1. **Use HTTPS**: Deploy behind reverse proxy (Nginx/Traefik)
2. **Rate Limiting**: Configured in API Gateway
3. **Signature Validation**: All webhooks validated
4. **Environment Variables**: Never commit secrets
5. **Network Isolation**: Use Docker networks

### Scaling

```yaml
# Scale transformer services
docker-compose up -d --scale inbound-transformer=3 --scale outbound-transformer=3
```

### Database Backups

```bash
# Backup PostgreSQL
docker exec whatsapp-postgres pg_dump -U postgres whatsapp_genesys > backup.sql

# Restore
docker exec -i whatsapp-postgres psql -U postgres whatsapp_genesys < backup.sql
```

## Troubleshooting

### Service Not Starting

```bash
# Check logs
docker-compose logs [service-name]

# Restart specific service
docker-compose restart [service-name]
```

### Connection Issues

- Verify all services are running: `docker-compose ps`
- Check network connectivity: `docker network inspect whatsapp_genesys_network`
- Verify environment variables: `docker-compose config`

### Message Not Delivered

1. Check webhook service logs: `docker-compose logs whatsapp-webhook` or `docker-compose logs genesys-webhook`
2. Verify RabbitMQ queue: http://localhost:15672 (user: admin)
3. Check transformer logs for errors
4. Verify State Manager has correct mappings

### OAuth Token Issues

```bash
# Check token status
curl http://localhost:3004/auth/info

# Force token refresh
curl -X POST http://localhost:3004/auth/refresh
```

## API Reference

### State Manager API

```bash
# Create/get mapping
POST /state/mapping
{
  "waId": "1234567890",
  "contactName": "John Doe",
  "phoneNumberId": "123456",
  "displayPhoneNumber": "+1234567890"
}

# Get mapping by WhatsApp ID
GET /state/mapping/:waId

# Get mapping by conversation ID
GET /state/conversation/:conversationId

# Track message
POST /state/message
{
  "metaMessageId": "msg_123",
  "genesysMessageId": "conv_456",
  "conversationId": "conv_789",
  "direction": "inbound"
}

# Get statistics
GET /state/stats
```

### Outbound Transformer API

```bash
# Send template message
POST /transform/outbound/send/template
{
  "conversationId": "conv_123",
  "templateName": "welcome_message",
  "parameters": ["John", "2024"],
  "buttonParams": "https://example.com"
}
```

## Maintenance

### Update Services

```bash
# Pull latest images
docker-compose pull

# Rebuild and restart
docker-compose up -d --build
```

### Clear Caches

```bash
# Clear Redis cache
docker exec whatsapp-redis redis-cli FLUSHALL

# Restart services
docker-compose restart
```

## Support

- Check logs: `docker-compose logs -f`
- Service health: http://localhost:3006
- RabbitMQ management: http://localhost:15672

## License

MIT License - Production ready for commercial use