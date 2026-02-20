#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║            WhatsApp-Genesys MVP - ngrok Setup             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Kill any existing ngrok processes
if pgrep -x "ngrok" > /dev/null; then
    echo -e "${YELLOW}⚠ Stopping existing ngrok processes...${NC}"
    pkill ngrok
    sleep 2
    echo -e "${GREEN}✓ Existing ngrok processes stopped${NC}"
    echo ""
fi

API_GATEWAY_PORT=3000

echo -e "${YELLOW}Starting ngrok tunnel for API Gateway (Port $API_GATEWAY_PORT)...${NC}"
echo ""

ngrok http $API_GATEWAY_PORT > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!
echo -e "ngrok started with PID: ${GREEN}$NGROK_PID${NC}"
echo ""

# Wait for ngrok to be ready
echo -e "${YELLOW}Waiting for ngrok to initialize...${NC}"
sleep 3

# Get tunnel URL from ngrok API
PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o "https://[^\"]*" | grep ngrok | head -1)

if [ -z "$PUBLIC_URL" ]; then
    echo -e "${RED}✗ Failed to get ngrok URL. Check /tmp/ngrok.log${NC}"
    exit 1
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ ngrok tunnel is ready!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Unified Public URL:${NC}"
echo -e "  ${PUBLIC_URL}"
echo ""

echo -e "${CYAN}�� WhatsApp Webhook Configuration${NC}"
echo -e "  Webhook URL: ${CYAN}${PUBLIC_URL}/webhook/whatsapp${NC}"
echo -e "  Verify Token: ${CYAN}whatsapp_webhook_verify_token_2024${NC}"
echo ""

echo -e "${CYAN}🔷 Genesys Webhook Configuration${NC}"
echo -e "  Webhook URL (Outbound Notification): ${CYAN}${PUBLIC_URL}/webhook/genesys${NC}"
echo -e "  Integration ID: 953973be-eb1f-4a3b-8541-62b3e809c803"
echo ""

echo -e "${CYAN}🧩 Agent Widget Configuration${NC}"
echo -e "  Application URL: ${CYAN}${PUBLIC_URL}/widget${NC}"
echo ""

URLS_FILE="/tmp/ngrok-webhook-urls.txt"
cat > $URLS_FILE << URLS
Unified Public URL: ${PUBLIC_URL}

WhatsApp Webhook: ${PUBLIC_URL}/webhook/whatsapp
Genesys Webhook: ${PUBLIC_URL}/webhook/genesys
Agent Widget: ${PUBLIC_URL}/widget
URLS

echo -e "${GREEN}Webhook URLs saved to:${NC} ${BLUE}$URLS_FILE${NC}"
tail -f /tmp/ngrok.log
