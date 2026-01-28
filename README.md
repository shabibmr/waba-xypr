# WhatsApp-Genesys Cloud Integration

Production-ready microservices architecture for integrating Meta WhatsApp Business API with Genesys Cloud contact center.

## 🚀 Features

- **Microservices Architecture**: 13 independent, scalable services
- **Multi-Tenant Support**: Serve multiple organizations from single deployment
- **Bidirectional Messaging**: WhatsApp ↔ Genesys real-time communication
- **Rich Media Support**: Images, documents, videos, locations
- **Agent Widget**: Enhanced customer context for agents
- **Template Messages**: Pre-approved WhatsApp message templates
- **Delivery Tracking**: Real-time status updates and receipts
- **OAuth 2.0**: Secure Genesys Cloud authentication
- **Message Queuing**: RabbitMQ for reliable async processing
- **Caching Layer**: Redis for performance optimization

## 📁 Project Structure

```
whatsapp-genesys-integration/
├── services/              # Microservices
│   ├── api-gateway/               # Entry point
│   ├── auth-service/              # Token management
│   ├── tenant-service/            # Configuration
│   ├── state-manager/             # Conversation state
│   ├── webhook-handler/           # Ingress webhook
│   ├── whatsapp-webhook-service/  # Meta ingestion
│   ├── whatsapp-api-service/      # Meta outbound
│   ├── genesys-webhook-service/   # Genesys ingestion
│   ├── genesys-api-service/       # Genesys outbound
│   ├── inbound-transformer/       # Logic adapter
│   ├── outbound-transformer/      # Logic adapter
│   ├── agent-portal/              # Agent UI
│   └── admin-dashboard/           # Admin UI
├── shared/                # Shared libraries
├── scripts/               # Setup and utility scripts
├── docs/                  # Documentation
└── config/                # Environment configs
```

## 🛠️ Prerequisites

- **Docker** & Docker Desktop (Must be running)
- **Node.js** 20+ (for local development)
- **Meta Business Account** with WhatsApp Business API access
- **Genesys Cloud** organization with API credentials

## 🚀 Quick Start

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 2. Start All Services

The recommended way to start the entire stack (Infrastructure + Application):

```powershell
.\start-all.ps1
```

This script will:
1. Check if Docker is running
2. Start infrastructure (Redis, RabbitMQ, PostgreSQL)
3. Wait for infrastructure health
4. Build and start all 13 microservices
5. Verify health of all services

### 3. Verify Health

```powershell
.\scripts\health-check.ps1
```

Or visit: `http://localhost:3000/health`

## 📊 Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| API Gateway | 3000 | Main entry point |
| Webhook Handler | 3001 | Generic webhook ingress |
| Inbound Transformer | 3002 | Meta → Genesys |
| Outbound Transformer | 3003 | Genesys → Meta |
| Auth Service | 3004 | OAuth tokens |
| State Manager | 3005 | Conversation mapping |
| Admin Dashboard | 3006 | Web UI |
| Tenant Service | 3007 | Multi-tenant mgmt |
| WhatsApp API | 3008 | Send to Meta |
| WhatsApp Webhook | 3009 | Receive from Meta |
| Genesys API | 3010 | Send to Genesys |
| Genesys Webhook | 3011 | Receive from Genesys |
| Agent Widget | 3012 | Agent interface WebSocket |
| Agent Portal | 3014 | Agent UI |

## 📖 Service Documentation

- [API Gateway](services/api-gateway/README.md)
- [Auth Service](services/auth-service/README.md)
- [Tenant Service](services/tenant-service/README.md)
- [State Manager](services/state-manager/README.md)
- [Webhook Handler](services/webhook-handler/README.md)
- [WhatsApp Webhook Service](services/whatsapp-webhook-service/README.md)
- [WhatsApp API Service](services/whatsapp-api-service/README.md)
- [Genesys Webhook Service](services/genesys-webhook-service/README.md)
- [Genesys API Service](services/genesys-api-service/README.md)
- [Inbound Transformer](services/inbound-transformer/README.md)
- [Outbound Transformer](services/outbound-transformer/README.md)
- [Agent Portal](services/agent-portal/README.md)
- [Admin Dashboard](services/admin-dashboard/README.md)

## 🐳 Docker Commands

```powershell
# Development (with hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Stop all services
docker compose down

# Rebuild specific service
docker compose build [service-name]

# View service logs
docker compose logs -f [service-name]
```

## 📝 License

MIT License - See LICENSE file for details
