#!/bin/bash

# AWS Deployment Script for WABA Integration
# This script deploys the entire stack on EC2 with RDS PostgreSQL

set -e

echo "=================================="
echo "WABA AWS Deployment Script"
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
    echo "Running migration: $(basename $migration)"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f "$migration"
done
echo -e "${GREEN}✓ Database schema initialized${NC}"

# Build all services
echo -e "${YELLOW}Building Docker images...${NC}"
docker-compose -f docker-compose.aws.yml build --parallel
echo -e "${GREEN}✓ Docker images built${NC}"

# Start infrastructure services first
echo -e "${YELLOW}Starting infrastructure services...${NC}"
docker-compose -f docker-compose.aws.yml up -d redis rabbitmq minio
echo "Waiting for infrastructure services to be healthy..."
sleep 15

# Initialize RabbitMQ queues
echo -e "${YELLOW}Initializing RabbitMQ queues...${NC}"
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=inbound.enriched durable=true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=genesys.outbound.ready durable=true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=correlation-events durable=true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=outboundQueue durable=true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=statusQueue durable=true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=outbound-processed durable=true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=outbound-ready durable=true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=inbound-transformer-dlq durable=true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=genesys-api.dlq durable=true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=outbound-transformer-dlq durable=true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=outbound-failed durable=true
docker exec whatsapp-rabbitmq rabbitmqadmin declare queue name=state-manager-dlq durable=true
echo -e "${GREEN}✓ RabbitMQ queues initialized${NC}"

# Initialize MinIO buckets
echo -e "${YELLOW}Initializing MinIO buckets...${NC}"
docker exec whatsapp-minio mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
docker exec whatsapp-minio mc mb --ignore-existing local/media-outbound
docker exec whatsapp-minio mc policy set download local/media-outbound
echo -e "${GREEN}✓ MinIO buckets initialized${NC}"

# Start all application services
echo -e "${YELLOW}Starting all services...${NC}"
docker-compose -f docker-compose.aws.yml up -d
echo "Waiting for services to be healthy..."
sleep 30

# Health check
echo -e "${YELLOW}Running health checks...${NC}"
SERVICES=(
    "api-gateway:3000"
    "tenant-service:3007"
    "auth-service:3004"
    "state-manager:3005"
    "whatsapp-webhook-service:3009"
    "whatsapp-api-service:3008"
    "inbound-transformer:3002"
    "outbound-transformer:3003"
    "genesys-webhook-service:3011"
    "genesys-api-service:3010"
    "agent-portal:3014"
    "agent-portal-service:3015"
    "agent-widget:3012"
)

FAILED=0
for service in "${SERVICES[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if curl -sf http://localhost:$port/health > /dev/null 2>&1 || \
       curl -sf http://localhost:$port/api/v1/health > /dev/null 2>&1 || \
       curl -sf http://localhost:$port/health/live > /dev/null 2>&1 || \
       curl -sf http://localhost:$port > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name (port $port)${NC}"
    else
        echo -e "${RED}✗ $name (port $port)${NC}"
        FAILED=1
    fi
done

echo ""
echo "=================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}Deployment Successful!${NC}"
else
    echo -e "${YELLOW}Deployment completed with some warnings${NC}"
    echo "Run: docker-compose -f docker-compose.aws.yml logs -f"
fi
echo "=================================="
echo ""
echo "Service URLs:"
echo "  API Gateway:        http://$(curl -s ifconfig.me):3000"
echo "  Agent Portal:       http://$(curl -s ifconfig.me):3014"
echo "  Admin Dashboard:    http://$(curl -s ifconfig.me):3006"
echo "  RabbitMQ UI:        http://$(curl -s ifconfig.me):15672 (user: $RABBITMQ_USER)"
echo "  MinIO Console:      http://$(curl -s ifconfig.me):9001 (user: $MINIO_ROOT_USER)"
echo ""
echo "Webhook URLs (configure in Meta/Genesys):"
echo "  WhatsApp Webhook:   http://$(curl -s ifconfig.me):3009/webhook"
echo "  Genesys Webhook:    http://$(curl -s ifconfig.me):3011/webhook"
echo ""
echo "To view logs: docker-compose -f docker-compose.aws.yml logs -f [service-name]"
echo "To stop: docker-compose -f docker-compose.aws.yml down"
