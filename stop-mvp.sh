#!/bin/bash

###############################################################################
# WhatsApp-Genesys Integration MVP - Service Stop Script
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Stopping WhatsApp-Genesys Integration MVP         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Ports used by MVP services
PORTS=(3002 3003 3004 3005 3007 3008 3009 3010 3011 3014 3015)

echo -e "${YELLOW}Stopping all services...${NC}"
echo ""

for port in "${PORTS[@]}"; do
    pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo -e "${BLUE}Stopping service on port $port (PID: $pid)...${NC}"
        kill -9 $pid 2>/dev/null || true
        echo -e "${GREEN}✓ Port $port stopped${NC}"
    else
        echo -e "${YELLOW}⚠ No service running on port $port${NC}"
    fi
done

echo ""
echo -e "${GREEN}All services stopped!${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} Infrastructure services (PostgreSQL, Redis, RabbitMQ, MinIO) are still running."
echo -e "To stop infrastructure: ${BLUE}docker compose -f docker-compose.infra.yml down${NC}"
echo ""
