# WhatsApp-Genesys Cloud Integration

[![CI](https://github.com/your-org/whatsapp-genesys-integration/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/whatsapp-genesys-integration/actions/workflows/ci.yml)
[![Docker Build](https://github.com/your-org/whatsapp-genesys-integration/actions/workflows/docker-build.yml/badge.svg)](https://github.com/your-org/whatsapp-genesys-integration/actions/workflows/docker-build.yml)
[![Security](https://github.com/your-org/whatsapp-genesys-integration/actions/workflows/security.yml/badge.svg)](https://github.com/your-org/whatsapp-genesys-integration/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Production-ready microservices architecture for integrating Meta WhatsApp Business API with Genesys Cloud contact center.


## 🚀 Features

- **Microservices Architecture** - 13 independent, scalable services
- **Multi-Tenant Support** - Serve multiple organizations from single deployment
- **Bidirectional Messaging** - WhatsApp ↔ Genesys real-time communication
- **Rich Media Support** - Images, documents, videos, locations
- **Agent Widget** - Enhanced customer context for agents
- **Template Messages** - Pre-approved WhatsApp message templates
- **Delivery Tracking** - Real-time status updates and receipts
- **OAuth 2.0** - Secure Genesys Cloud authentication
- **Message Queuing** - RabbitMQ for reliable async processing
- **Caching Layer** - Redis for performance optimization
- **Comprehensive Documentation** - See [Documentation](#-documentation) and [Troubleshooting](docs/TROUBLESHOOTING.md)


## 📁 Project Structure

```
whatsapp-genesys-integration/
├── services/              # Microservices
│   ├── api-gateway/
│   ├── whatsapp-webhook-service/
│   ├── whatsapp-api-service/
│   ├── genesys-webhook-service/
│   ├── genesys-api-service/
│   ├── inbound-transformer/
│   ├── outbound-transformer/
│   ├── auth-service/
│   ├── state-manager/
│   ├── tenant-service/
│   ├── agent-widget/
│   └── admin-dashboard/
├── shared/                # Shared libraries
├── scripts/               # Setup and utility scripts
├── docs/                  # Documentation
├── tests/                 # Integration tests
└── config/                # Environment configs
```

## 🛠️ Prerequisites

- **Docker** & Docker Compose
- **Node.js** 20+ (for local development)
- **Meta Business Account** with WhatsApp Business API access
- **Genesys Cloud** organization with API credentials

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd whatsapp-genesys-integration
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required credentials:
- Meta: `APP_SECRET`, `VERIFY_TOKEN`, `ACCESS_TOKEN`
- Genesys: `CLIENT_ID`, `CLIENT_SECRET`, `REGION`

### 3. Start Infrastructure Services

```powershell
# Add Docker to PATH (Windows)
$env:PATH = "E:\docker\resources\bin;$env:PATH"

# Start PostgreSQL, Redis, and RabbitMQ
docker compose -f docker-compose.infra.yml up -d

# Verify services are healthy
docker compose -f docker-compose.infra.yml ps
```

### 4. Start All Microservices

```powershell
# Development mode (with hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Production mode
docker compose -f docker-compose.prod.yml up -d

# Or use the build script
.\scripts\build-all.ps1 -Environment development
```

### 5. Verify Health

```powershell
# Check all services
.\scripts\health-check.ps1

# Or manually check API Gateway
curl http://localhost:3000/health
```

## 📊 Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| API Gateway | 3000 | Main entry point |
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
| Agent Widget | 3012 | Agent interface |

## 📖 Documentation

### Getting Started
- [Quick Start Guide](#-quick-start) - Get up and running in minutes
- [Setup Guide](docs/deployment/setup-guide.md) - Detailed installation instructions
- [Multi-Tenant Guide](docs/deployment/multi-tenant-guide.md) - Configure multi-tenant deployment
- [Infrastructure Quick Start](INFRASTRUCTURE_QUICKSTART.md) - Fast infrastructure setup

### Development
- [Development Guide](docs/DEVELOPMENT.md) - Local development workflow and best practices
- [Contributing Guidelines](CONTRIBUTING.md) - How to contribute to the project
- [Shared Libraries](shared/README.md) - Documentation for shared constants and middleware
- [Scripts Documentation](scripts/README.md) - Utility scripts reference

### Architecture & Design
- [Architecture Overview](docs/architecture/README.md) - System design and data flows
- [Service Startup Order](docs/service-startup-order.md) - Dependency order and startup sequence
- [API Documentation](docs/api-documentation.md) - Complete API reference with OpenAPI specs

### Operations
- [CI/CD Pipeline](docs/CI-CD.md) - Automated testing, building, and deployment
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Deployment Guide](docs/deployment/refined-setup-guide.md) - Production deployment instructions
- [Testing Guide](tests/README.md) - Testing infrastructure and mock usage

### Service Documentation
Each service has its own README with detailed information:
- [API Gateway](services/api-gateway/README.md)
- [Auth Service](services/auth-service/README.md)
- [Webhook Handler](services/webhook-handler/README.md)
- [State Manager](services/state-manager/README.md)
- [Tenant Service](services/tenant-service/README.md)
- [WhatsApp API Service](services/whatsapp-api-service/README.md)
- [Genesys API Service](services/genesys-api-service/README.md)
- [And 6 more services...](services/)


## 🧪 Testing

```bash
# Run all tests
npm test

# Integration tests
npm run test:integration
```

## 🔧 Development

```powershell
# Start in development mode (with hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Rebuild containers
.\scripts\build-all.ps1 -NoCache

# Stop all services
docker compose -f docker-compose.yml down

# View logs
docker compose -f docker-compose.yml logs -f [service-name]
```

## 🐳 Docker Commands

### Infrastructure Only
```powershell
# Start infrastructure (PostgreSQL, Redis, RabbitMQ)
docker compose -f docker-compose.infra.yml up -d

# Stop infrastructure
docker compose -f docker-compose.infra.yml down

# View infrastructure logs
docker compose -f docker-compose.infra.yml logs -f
```

### All Services
```powershell
# Development (with hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Production
docker compose -f docker-compose.prod.yml up -d

# Stop all services
docker compose down

# Rebuild specific service
docker compose build [service-name]

# View service logs
docker compose logs -f [service-name]

# Execute command in container
docker exec -it [container-name] sh
```

### Utility Scripts
```powershell
# Build all services
.\scripts\build-all.ps1 -Environment production

# Health check
.\scripts\health-check.ps1

# Deploy to production
.\scripts\deploy.ps1 -Action start -Build

# Database migrations
.\scripts\db-migrate.ps1 -Action up
```

## 📦 Production Deployment

See [Deployment Guide](docs/deployment/refined-setup-guide.md) for detailed production setup instructions.

## 🏗️ Architecture

The system uses a microservices architecture with:
- **API Gateway** for routing and load balancing
- **Message Queue** (RabbitMQ) for async processing
- **Database** (PostgreSQL) for persistent storage
- **Cache** (Redis) for performance
- **Independent services** for WhatsApp and Genesys integration

See [Architecture Documentation](docs/architecture/) for detailed diagrams and flows.

## 🔐 Security

- Webhook signature validation
- OAuth 2.0 token management
- Rate limiting
- Environment-based secrets
- Network isolation

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Support

### Documentation
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Development Guide](docs/DEVELOPMENT.md) - Development workflow and best practices
- [API Documentation](docs/api-documentation.md) - Complete API reference
- [Architecture Overview](docs/architecture/README.md) - System design and flows

### Getting Help
- **Issues**: Open a GitHub issue with detailed information
- **Questions**: Check documentation first, then ask in discussions
- **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines

