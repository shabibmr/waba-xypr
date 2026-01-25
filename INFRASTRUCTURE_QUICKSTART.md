# Quick Start - Infrastructure Services

## Start All Services

```powershell
# Add Docker to PATH (required for your installation)
$env:PATH = "E:\docker\resources\bin;$env:PATH"

# Navigate to project directory
cd d:\BKP\waba\code\claude

# Start infrastructure services
docker compose -f docker-compose.infra.yml up -d
```

## Verify Services

```powershell
# Check all services are running
docker compose -f docker-compose.infra.yml ps

# Should show all 3 services as "healthy"
```

## Service Access

### PostgreSQL
- **Host:** localhost:5432
- **Database:** whatsapp_genesys
- **User:** postgres
- **Password:** secure_password_123

### Redis
- **Host:** localhost:6379
- **Password:** None

### RabbitMQ
- **AMQP:** localhost:5672
- **Management UI:** http://localhost:15672
- **User:** admin
- **Password:** admin123

## Stop Services

```powershell
docker compose -f docker-compose.infra.yml down
```

## View Logs

```powershell
# All services
docker compose -f docker-compose.infra.yml logs -f

# Specific service
docker compose -f docker-compose.infra.yml logs -f postgres
```
