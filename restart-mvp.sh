#!/bin/bash

###############################################################################
# WhatsApp-Genesys Integration MVP - Service Restart Script
###############################################################################

# Colors for output
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Restarting WhatsApp-Genesys Integration MVP        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Step 1: Stopping all services...${NC}"
./stop-mvp.sh

echo ""
echo -e "${YELLOW}Step 2: Waiting 3 seconds...${NC}"
sleep 3

echo ""
echo -e "${YELLOW}Step 3: Starting all services...${NC}"
./start-mvp.sh
