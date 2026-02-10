#!/bin/bash

###############################################################################
# WhatsApp-Genesys Integration MVP - Service Status Script
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     WhatsApp-Genesys Integration MVP - Service Status     ║${NC}"
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

# Function to get process info
get_process_info() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        local cmd=$(ps -p $pid -o command= 2>/dev/null | cut -c1-60)
        echo "PID: $pid | $cmd"
    else
        echo "Not running"
    fi
}

# Function to check service health
check_health() {
    local port=$1
    local endpoint=$2

    if check_port $port; then
        local response=$(curl -s -w "\n%{http_code}" "http://localhost:$port$endpoint" 2>/dev/null | tail -1)
        if [ "$response" = "200" ]; then
            echo -e "${GREEN}✓ Healthy${NC}"
        else
            echo -e "${YELLOW}⚠ Running (health check failed)${NC}"
        fi
    else
        echo -e "${RED}✗ Not running${NC}"
    fi
}

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Infrastructure Services${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check infrastructure
if docker ps | grep -q whatsapp-postgres; then
    echo -e "${GREEN}✓${NC} PostgreSQL (5432)    - Running"
else
    echo -e "${RED}✗${NC} PostgreSQL (5432)    - Not running"
fi

if docker ps | grep -q whatsapp-redis; then
    echo -e "${GREEN}✓${NC} Redis (6379)         - Running"
else
    echo -e "${RED}✗${NC} Redis (6379)         - Not running"
fi

if docker ps | grep -q whatsapp-rabbitmq; then
    echo -e "${GREEN}✓${NC} RabbitMQ (5672)      - Running"
else
    echo -e "${RED}✗${NC} RabbitMQ (5672)      - Not running"
fi

if docker ps | grep -q whatsapp-minio; then
    echo -e "${GREEN}✓${NC} MinIO (9000)         - Running"
else
    echo -e "${RED}✗${NC} MinIO (9000)         - Not running"
fi

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Core Services${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -n "State Manager (3005):      "
check_health 3005 "/health"
echo "  $(get_process_info 3005)"
echo ""

echo -n "Tenant Service (3007):     "
check_health 3007 "/health"
echo "  $(get_process_info 3007)"
echo ""

echo -n "Auth Service (3004):       "
check_health 3004 "/health"
echo "  $(get_process_info 3004)"
echo ""

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Message Flow Services${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -n "WhatsApp Webhook (3009):   "
check_health 3009 "/health"
echo "  $(get_process_info 3009)"
echo ""

echo -n "Inbound Transformer (3002):"
check_health 3002 "/health"
echo "  $(get_process_info 3002)"
echo ""

echo -n "Genesys API (3010):        "
check_health 3010 "/health"
echo "  $(get_process_info 3010)"
echo ""

echo -n "Genesys Webhook (3011):    "
check_health 3011 "/health"
echo "  $(get_process_info 3011)"
echo ""

echo -n "Outbound Transformer (3003):"
check_health 3003 "/health"
echo "  $(get_process_info 3003)"
echo ""

echo -n "WhatsApp API (3008):       "
check_health 3008 "/health"
echo "  $(get_process_info 3008)"
echo ""

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Customer Portal${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -n "Portal Backend (3015):     "
check_health 3015 "/health"
echo "  $(get_process_info 3015)"
echo ""

echo -n "Portal Frontend (3014):    "
if check_port 3014; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
fi
echo "  $(get_process_info 3014)"
echo ""

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Summary${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Count running services
RUNNING=0
TOTAL=11

for port in 3002 3003 3004 3005 3007 3008 3009 3010 3011 3014 3015; do
    if check_port $port; then
        ((RUNNING++))
    fi
done

echo -e "Services running: ${GREEN}$RUNNING${NC}/${TOTAL}"
echo ""

if [ $RUNNING -eq $TOTAL ]; then
    echo -e "${GREEN}✓ All services are running!${NC}"
elif [ $RUNNING -eq 0 ]; then
    echo -e "${RED}✗ No services are running${NC}"
    echo -e "Start services with: ${BLUE}./start-mvp.sh${NC}"
else
    echo -e "${YELLOW}⚠ Some services are not running${NC}"
    echo -e "Restart all with: ${BLUE}./restart-mvp.sh${NC}"
fi

echo ""
echo -e "${YELLOW}Quick Links:${NC}"
echo -e "  • Customer Portal:   ${BLUE}http://localhost:3014${NC}"
echo -e "  • RabbitMQ UI:       ${BLUE}http://localhost:15672${NC}"
echo -e "  • MinIO Console:     ${BLUE}http://localhost:9001${NC}"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo -e "  • All logs:          ${BLUE}tail -f /tmp/*.log${NC}"
echo -e "  • Specific service:  ${BLUE}tail -f /tmp/[service-name].log${NC}"
echo ""
