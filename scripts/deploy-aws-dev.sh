#!/bin/bash

# AWS Development/Testing Deployment Script for WABA Integration
# Minimal specs for cost-effective testing

set -e

echo "=================================="
echo "WABA AWS Dev Deployment Script"
echo "Minimal Specs - Testing Mode"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create .env file with RDS connection details"
    exit 1
fi

# Load environment variables
source .env

# Verify RDS connection
echo -e "${YELLOW}Verifying RDS connection...${NC}"
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL client..."
    sudo apt-get update
    sudo apt-get install -y postgresql-client
fi

# Test RDS connectivity
if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ RDS connection successful${NC}"
else
    echo -e "${RED}✗ Failed to connect to RDS${NC}"
    echo "Please check DB_HOST, DB_USER, DB_PASSWORD in .env"
    exit 1
fi

# Initialize database schema
echo -e "${YELLOW}Initializing database schema...${NC}"
for migration in database/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "Running migration: $(basename $migration)"
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f "$migration" 2>&1 | grep -v "already exists" || true
    fi
done
echo -e "${GREEN}✓ Database schema initialized${NC}"

# Build all services (with build cache for faster rebuilds)
echo -e "${YELLOW}Building Docker images (dev mode)...${NC}"
docker-compose -f docker-compose.aws-dev.yml build
echo -e "${GREEN}✓ Docker images built${NC}"

# Start infrastructure services first
echo -e "${YELLOW}Starting infrastructure services...${NC}"
docker-compose -f docker-compose.aws-dev.yml up -d redis rabbitmq minio
echo "Waiting for infrastructure services to be healthy..."
sleep 10

# Initialize RabbitMQ queues
echo -e "${YELLOW}Initializing RabbitMQ queues...${NC}"
sleep 5  # Give RabbitMQ more time to fully start

# Wait for RabbitMQ to be fully ready
until docker exec whatsapp-rabbitmq rabbitmqctl status > /dev/null 2>&1; do
    echo "Waiting for RabbitMQ..."
    sleep 2
done

# Declare queues
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=inbound.enriched durable=true || true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=genesys.outbound.ready durable=true || true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=correlation-events durable=true || true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=outboundQueue durable=true || true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=statusQueue durable=true || true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=outbound-processed durable=true || true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=outbound-ready durable=true || true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=inbound-transformer-dlq durable=true || true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=genesys-api.dlq durable=true || true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=outbound-transformer-dlq durable=true || true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=outbound-failed durable=true || true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=state-manager-dlq durable=true || true
echo -e "${GREEN}✓ RabbitMQ queues initialized${NC}"

# Initialize MinIO buckets
echo -e "${YELLOW}Initializing MinIO buckets...${NC}"
sleep 2
docker exec whatsapp-minio mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD 2>/dev/null || true
docker exec whatsapp-minio mc mb --ignore-existing local/media-outbound 2>/dev/null || true
docker exec whatsapp-minio mc policy set download local/media-outbound 2>/dev/null || true
echo -e "${GREEN}✓ MinIO buckets initialized${NC}"

# Start all application services
echo -e "${YELLOW}Starting all services (development mode)...${NC}"
docker-compose -f docker-compose.aws-dev.yml up -d
echo "Waiting for services to be healthy..."
sleep 20

# Health check
echo -e "${YELLOW}Running health checks...${NC}"
SERVICES=(
    "api-gateway:3000:/health"
    "tenant-service:3007:/health"
    "auth-service:3004:/api/v1/health"
    "state-manager:3005:/health"
    "whatsapp-webhook-service:3009:/health"
    "whatsapp-api-service:3008:/health"
    "inbound-transformer:3002:/health/live"
    "outbound-transformer:3003:/health"
    "genesys-webhook-service:3011:/health"
    "genesys-api-service:3010:/health"
    "agent-portal:3014:/"
    "agent-portal-service:3015:/health"
    "agent-widget:3012:/health"
)

FAILED=0
for service in "${SERVICES[@]}"; do
    IFS=':' read -r name port path <<< "$service"
    # Give services time to start
    sleep 1
    if curl -sf http://localhost:$port$path > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name${NC}"
    else
        echo -e "${YELLOW}⚠ $name (port $port) - may still be starting${NC}"
        FAILED=1
    fi
done

echo ""
echo "=================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}Development Deployment Successful!${NC}"
else
    echo -e "${YELLOW}Deployment completed - some services may still be starting${NC}"
    echo "Wait 30 seconds and run: ./scripts/manage-aws.sh health"
fi
echo "=================================="
echo ""
echo -e "${YELLOW}Development Mode Features:${NC}"
echo "  • Debug logging enabled (LOG_LEVEL=debug)"
echo "  • Dev login enabled for Agent Portal"
echo "  • Lower memory limits for cost savings"
echo "  • Faster build times with caching"
echo ""
echo -e "${YELLOW}Service URLs:${NC}"
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_ELASTIC_IP")
echo "  API Gateway:        http://$PUBLIC_IP:3000"
echo "  Agent Portal:       http://$PUBLIC_IP:3014"
echo "  Admin Dashboard:    http://$PUBLIC_IP:3006"
echo "  RabbitMQ UI:        http://$PUBLIC_IP:15672 (user: $RABBITMQ_USER)"
echo "  MinIO Console:      http://$PUBLIC_IP:9001 (user: $MINIO_ROOT_USER)"
echo ""
echo -e "${YELLOW}Webhook URLs (configure in Meta/Genesys):${NC}"
echo "  WhatsApp:           http://$PUBLIC_IP:3009/webhook"
echo "  Genesys:            http://$PUBLIC_IP:3011/webhook"
echo ""
echo -e "${YELLOW}Management Commands:${NC}"
echo "  View logs:          ./scripts/manage-aws.sh logs"
echo "  Health check:       ./scripts/manage-aws.sh health"
echo "  Monitor:            ./scripts/manage-aws.sh monitor"
echo "  Stop:               docker-compose -f docker-compose.aws-dev.yml down"
echo ""
echo -e "${GREEN}Estimated Cost: ~\$35/month (dev specs)${NC}"
