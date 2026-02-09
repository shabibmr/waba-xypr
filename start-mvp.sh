#!/bin/bash

###############################################################################
# WhatsApp-Genesys Integration MVP - Service Startup Script
#
# This script starts all 11 MVP services in the correct order
# Logs are written to /tmp/*.log files
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="/Users/admin/code/WABA/v1/waba-xypr"
LOG_DIR="/tmp"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    WhatsApp-Genesys Integration MVP - Service Startup     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -ti:$port > /dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}  Killing existing process on port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Function to start a service
start_service() {
    local service_name=$1
    local service_dir=$2
    local port=$3
    local log_file="$LOG_DIR/${service_name}.log"

    echo -e "${BLUE}Starting $service_name on port $port...${NC}"

    # Kill any existing process on this port
    kill_port $port

    # Start the service
    cd "$PROJECT_ROOT/$service_dir"

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}  Installing dependencies for $service_name...${NC}"
        npm install > /dev/null 2>&1
    fi

    # Start the service in background
    npm run dev > "$log_file" 2>&1 &
    local pid=$!

    echo -e "  PID: $pid | Log: $log_file"
    sleep 2

    # Check if process is still running
    if ps -p $pid > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ $service_name started successfully${NC}"
        return 0
    else
        echo -e "${RED}  ✗ $service_name failed to start. Check $log_file${NC}"
        tail -10 "$log_file"
        return 1
    fi
}

# Function to check service health
check_health() {
    local name=$1
    local port=$2
    local endpoint=$3

    if check_port $port; then
        local response=$(curl -s -w "\n%{http_code}" "http://localhost:$port$endpoint" 2>/dev/null | tail -1)
        if [ "$response" = "200" ]; then
            echo -e "${GREEN}✓${NC} $name"
        else
            echo -e "${YELLOW}⚠${NC} $name (running but health check failed)"
        fi
    else
        echo -e "${RED}✗${NC} $name"
    fi
}

###############################################################################
# Main Execution
###############################################################################

echo -e "${YELLOW}Step 1: Checking infrastructure services...${NC}"
echo ""

# Check if infrastructure is running
INFRA_OK=true

if ! docker ps | grep -q whatsapp-postgres; then
    echo -e "${RED}✗ PostgreSQL is not running${NC}"
    INFRA_OK=false
else
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
fi

if ! docker ps | grep -q whatsapp-redis; then
    echo -e "${RED}✗ Redis is not running${NC}"
    INFRA_OK=false
else
    echo -e "${GREEN}✓ Redis is running${NC}"
fi

if ! docker ps | grep -q whatsapp-rabbitmq; then
    echo -e "${RED}✗ RabbitMQ is not running${NC}"
    INFRA_OK=false
else
    echo -e "${GREEN}✓ RabbitMQ is running${NC}"
fi

if ! docker ps | grep -q whatsapp-minio; then
    echo -e "${RED}✗ MinIO is not running${NC}"
    INFRA_OK=false
else
    echo -e "${GREEN}✓ MinIO is running${NC}"
fi

if [ "$INFRA_OK" = false ]; then
    echo ""
    echo -e "${RED}Infrastructure services are not running!${NC}"
    echo -e "Please start them first with: ${BLUE}docker compose -f docker-compose.infra.yml up -d${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Starting core services...${NC}"
echo ""

# Core Services (must start first)
start_service "state-manager" "services/state-manager" 3005 || exit 1
start_service "tenant-service" "services/tenant-service" 3007 || exit 1
start_service "auth-service" "services/auth-service" 3004 || exit 1

echo ""
echo -e "${YELLOW}Step 3: Starting message flow services...${NC}"
echo ""

# Message Flow Services (can start in parallel)
start_service "whatsapp-webhook" "services/whatsapp-webhook-service" 3009 || exit 1
start_service "inbound-transformer" "services/inbound-transformer" 3002 || exit 1
start_service "genesys-api" "services/genesys-api-service" 3010 || exit 1
start_service "genesys-webhook" "services/genesys-webhook-service" 3011 || exit 1
start_service "outbound-transformer" "services/outbound-transformer" 3003 || exit 1
start_service "whatsapp-api" "services/whatsapp-api-service" 3008 || exit 1

echo ""
echo -e "${YELLOW}Step 4: Starting customer portal...${NC}"
echo ""

# Customer Portal (frontend + backend)
start_service "agent-portal-service" "services/agent-portal-service" 3015 || exit 1
start_service "agent-portal" "services/agent-portal" 3014 || exit 1

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}All services started successfully!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Wait a bit for services to fully initialize
echo -e "${YELLOW}Waiting 5 seconds for services to initialize...${NC}"
sleep 5

echo ""
echo -e "${YELLOW}Step 5: Verifying service health...${NC}"
echo ""

check_health "State Manager      (3005)" 3005 "/health"
check_health "Tenant Service     (3007)" 3007 "/health"
check_health "Auth Service       (3004)" 3004 "/health"
check_health "WhatsApp Webhook   (3009)" 3009 "/health"
check_health "Inbound Transformer(3002)" 3002 "/health"
check_health "Genesys API        (3010)" 3010 "/health"
check_health "Genesys Webhook    (3011)" 3011 "/health"
check_health "Outbound Transform (3003)" 3003 "/health"
check_health "WhatsApp API       (3008)" 3008 "/health"
check_health "Portal Backend     (3015)" 3015 "/health"
check_health "Portal Frontend    (3014)" 3014 "/"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ MVP System is ready!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Service URLs:${NC}"
echo -e "  • Customer Portal:    ${BLUE}http://localhost:3014${NC}"
echo -e "  • Portal Backend API: ${BLUE}http://localhost:3015${NC}"
echo -e "  • Auth Service:       ${BLUE}http://localhost:3004${NC}"
echo -e "  • State Manager:      ${BLUE}http://localhost:3005${NC}"
echo -e "  • Tenant Service:     ${BLUE}http://localhost:3007${NC}"
echo ""
echo -e "${YELLOW}Infrastructure UIs:${NC}"
echo -e "  • RabbitMQ:          ${BLUE}http://localhost:15672${NC} (admin/admin123)"
echo -e "  • MinIO:             ${BLUE}http://localhost:9001${NC} (admin/admin123)"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo -e "  • View all logs:     ${BLUE}tail -f $LOG_DIR/*.log${NC}"
echo -e "  • View specific log: ${BLUE}tail -f $LOG_DIR/[service-name].log${NC}"
echo ""
echo -e "${YELLOW}Management:${NC}"
echo -e "  • Stop all services: ${BLUE}./stop-mvp.sh${NC}"
echo -e "  • Restart services:  ${BLUE}./restart-mvp.sh${NC}"
echo -e "  • View status:       ${BLUE}./status-mvp.sh${NC}"
echo ""
