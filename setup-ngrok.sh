#!/bin/bash

###############################################################################
# WhatsApp-Genesys Integration MVP - ngrok Setup Script
#
# This script sets up ngrok tunnels for webhook endpoints
###############################################################################

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

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}✗ ngrok is not installed${NC}"
    echo ""
    echo -e "${YELLOW}Installation options:${NC}"
    echo -e "  • Homebrew:  ${BLUE}brew install ngrok/ngrok/ngrok${NC}"
    echo -e "  • Download:  ${BLUE}https://ngrok.com/download${NC}"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ ngrok is installed${NC}"
echo ""

# Check if ngrok is authenticated
if ! ngrok config check &> /dev/null; then
    echo -e "${YELLOW}⚠ ngrok is not authenticated${NC}"
    echo ""
    echo -e "Please authenticate ngrok first:"
    echo -e "  1. Sign up at: ${BLUE}https://dashboard.ngrok.com/signup${NC}"
    echo -e "  2. Get your authtoken from: ${BLUE}https://dashboard.ngrok.com/get-started/your-authtoken${NC}"
    echo -e "  3. Run: ${BLUE}ngrok config add-authtoken YOUR_TOKEN${NC}"
    echo ""
    read -p "Press Enter after authenticating, or Ctrl+C to exit..."
fi

# Check if services are running
echo -e "${YELLOW}Checking if webhook services are running...${NC}"
echo ""

WHATSAPP_WEBHOOK_PORT=3009
GENESYS_WEBHOOK_PORT=3011
AGENT_WIDGET_PORT=3012

if ! lsof -ti:$WHATSAPP_WEBHOOK_PORT > /dev/null 2>&1; then
    echo -e "${RED}✗ WhatsApp Webhook service is not running (port $WHATSAPP_WEBHOOK_PORT)${NC}"
    echo -e "  Start it with: ${BLUE}cd services/whatsapp-webhook-service && npm run dev${NC}"
    echo ""
    WHATSAPP_RUNNING=false
else
    echo -e "${GREEN}✓ WhatsApp Webhook service is running${NC}"
    WHATSAPP_RUNNING=true
fi

if ! lsof -ti:$GENESYS_WEBHOOK_PORT > /dev/null 2>&1; then
    echo -e "${RED}✗ Genesys Webhook service is not running (port $GENESYS_WEBHOOK_PORT)${NC}"
    echo -e "  Start it with: ${BLUE}cd services/genesys-webhook-service && npm run dev${NC}"
    echo ""
    GENESYS_RUNNING=false
else
    echo -e "${GREEN}✓ Genesys Webhook service is running${NC}"
    GENESYS_RUNNING=true
fi

if ! lsof -ti:$AGENT_WIDGET_PORT > /dev/null 2>&1; then
    echo -e "${RED}✗ Agent Widget service is not running (port $AGENT_WIDGET_PORT)${NC}"
    echo -e "  Start it with: ${BLUE}cd services/agent-widget && npm run dev${NC}"
    echo ""
    WIDGET_RUNNING=false
else
    echo -e "${GREEN}✓ Agent Widget service is running${NC}"
    WIDGET_RUNNING=true
fi

echo ""

# Default to option 4 (All services)
echo -e "${YELLOW}Defaulting to option 4: All services (WhatsApp + Genesys + Widget)${NC}"
choice=4

case $choice in
    1)
        if [ "$WHATSAPP_RUNNING" = false ]; then
            echo -e "${RED}Error: WhatsApp Webhook service must be running first${NC}"
            exit 1
        fi
        SETUP_WHATSAPP=true
        SETUP_GENESYS=false
        ;;
    2)
        if [ "$GENESYS_RUNNING" = false ]; then
            echo -e "${RED}Error: Genesys Webhook service must be running first${NC}"
            exit 1
        fi
        SETUP_WHATSAPP=false
        SETUP_GENESYS=true
        ;;
    3)
        if [ "$WIDGET_RUNNING" = false ]; then
            echo -e "${RED}Error: Agent Widget service must be running first${NC}"
            exit 1
        fi
        SETUP_WHATSAPP=false
        SETUP_GENESYS=false
        SETUP_WIDGET=true
        ;;
    4)
        if [ "$WHATSAPP_RUNNING" = false ] || [ "$GENESYS_RUNNING" = false ] || [ "$WIDGET_RUNNING" = false ]; then
            echo -e "${RED}Error: All services must be running first${NC}"
            exit 1
        fi
        SETUP_WHATSAPP=true
        SETUP_GENESYS=true
        SETUP_WIDGET=true
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${YELLOW}Starting ngrok tunnels...${NC}"
echo ""

# Create ngrok config for multiple tunnels
NGROK_CONFIG="/tmp/ngrok-mvp.yml"

cat > $NGROK_CONFIG << 'EOF'
version: "2"
tunnels:
EOF

if [ "$SETUP_WHATSAPP" = true ]; then
    cat >> $NGROK_CONFIG << EOF
  whatsapp-webhook:
    proto: http
    addr: $WHATSAPP_WEBHOOK_PORT
    inspect: true
EOF
fi

if [ "$SETUP_GENESYS" = true ]; then
    cat >> $NGROK_CONFIG << EOF
  genesys-webhook:
    proto: http
    addr: $GENESYS_WEBHOOK_PORT
    inspect: true
EOF
fi

if [ "$SETUP_WIDGET" = true ]; then
    cat >> $NGROK_CONFIG << EOF
  agent-widget:
    proto: http
    addr: $AGENT_WIDGET_PORT
    inspect: true
EOF
fi



# Start ngrok with config
echo -e "${BLUE}Starting ngrok with custom config...${NC}"
echo ""

# Start ngrok in background and save output
# Start ngrok in background and save output
TUNNELS=""
[ "$SETUP_WHATSAPP" = true ] && TUNNELS="$TUNNELS whatsapp-webhook"
[ "$SETUP_GENESYS" = true ] && TUNNELS="$TUNNELS genesys-webhook"
[ "$SETUP_WIDGET" = true ] && TUNNELS="$TUNNELS agent-widget"

ngrok start --config=$NGROK_CONFIG $TUNNELS > /tmp/ngrok.log 2>&1 &

NGROK_PID=$!
echo -e "ngrok started with PID: ${GREEN}$NGROK_PID${NC}"
echo ""

# Wait for ngrok to be ready
echo -e "${YELLOW}Waiting for ngrok to initialize...${NC}"
sleep 3

# Get tunnel URLs from ngrok API
get_tunnel_url() {
    local name=$1
    curl -s http://localhost:4040/api/tunnels | grep -o "https://[^\"]*" | grep ngrok
}

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ ngrok tunnels are ready!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Display WhatsApp webhook info
if [ "$SETUP_WHATSAPP" = true ]; then
    WHATSAPP_URL=$(curl -s http://localhost:4040/api/tunnels/whatsapp-webhook 2>/dev/null | grep -o '"public_url":"[^"]*' | cut -d'"' -f4)

    if [ -z "$WHATSAPP_URL" ]; then
        # Fallback: get any https URL
        WHATSAPP_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*' | head -1)
    fi

    echo -e "${CYAN}📱 WhatsApp Webhook Configuration${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Public URL:${NC}"
    echo -e "  ${WHATSAPP_URL}"
    echo ""
    echo -e "${GREEN}Full Webhook URL:${NC}"
    echo -e "  ${WHATSAPP_URL}/webhook/whatsapp"
    echo ""
    echo -e "${GREEN}Verify Token:${NC}"
    echo -e "  whatsapp_webhook_verify_token_2024"
    echo ""
    echo -e "${YELLOW}Setup in Meta Developer Console:${NC}"
    echo -e "  1. Go to: ${BLUE}https://developers.facebook.com/apps/1162288675766205${NC}"
    echo -e "  2. Navigate to: ${BLUE}WhatsApp → Configuration${NC}"
    echo -e "  3. Click: ${BLUE}Edit${NC} in Webhook section"
    echo -e "  4. Callback URL: ${CYAN}${WHATSAPP_URL}/webhook/whatsapp${NC}"
    echo -e "  5. Verify Token: ${CYAN}whatsapp_webhook_verify_token_2024${NC}"
    echo -e "  6. Click: ${BLUE}Verify and Save${NC}"
    echo -e "  7. Subscribe to webhook fields:"
    echo -e "     • ${GREEN}messages${NC} ✓"
    echo -e "     • ${GREEN}message_status${NC} ✓"
    echo ""
fi

# Display Genesys webhook info
if [ "$SETUP_GENESYS" = true ]; then
    GENESYS_URL=$(curl -s http://localhost:4040/api/tunnels/genesys-webhook 2>/dev/null | grep -o '"public_url":"[^"]*' | cut -d'"' -f4)

    if [ -z "$GENESYS_URL" ]; then
        # Fallback: get second https URL if both running
        if [ "$SETUP_WHATSAPP" = true ]; then
            GENESYS_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*' | tail -1)
        else
            GENESYS_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*' | head -1)
        fi
    fi

# Display Agent Widget info


    echo -e "${CYAN}🔷 Genesys Webhook Configuration${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Public URL:${NC}"
    echo -e "  ${GENESYS_URL}"
    echo ""
    echo -e "${GREEN}Webhook URL (Outbound Notification):${NC}"
    echo -e "  ${GENESYS_URL}/webhook/genesys"
    echo ""
    echo -e "${GREEN}Integration ID:${NC}"
    echo -e "  953973be-eb1f-4a3b-8541-62b3e809c803"
    echo ""
    echo -e "${YELLOW}Setup in Genesys Cloud:${NC}"
    echo -e "  1. Go to: ${BLUE}https://apps.aps1.pure.cloud${NC}"
    echo -e "  2. Navigate to: ${BLUE}Admin → Integrations${NC}"
    echo -e "  3. Find: ${BLUE}Open Messaging${NC}"
    echo -e "  4. Select integration: ${BLUE}953973be-eb1f-4a3b-8541-62b3e809c803${NC}"
    echo -e "  5. Configuration tab:"
    echo -e "     • Outbound Notification Webhook URL: ${CYAN}${GENESYS_URL}/webhook/genesys${NC}"
    echo -e "  6. Click: ${BLUE}Save${NC}"
    echo ""
fi

# Display Agent Widget info
if [ "$SETUP_WIDGET" = true ]; then
    WIDGET_URL=$(curl -s http://localhost:4040/api/tunnels/agent-widget 2>/dev/null | grep -o '"public_url":"[^"]*' | cut -d'"' -f4)

    if [ -z "$WIDGET_URL" ]; then
        # Fallback: try to find by port if name fails match or if only one tunnel
        WIDGET_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*' | head -1)
    fi

    echo -e "${CYAN}🧩 Agent Widget Configuration${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Public URL:${NC}"
    echo -e "  ${WIDGET_URL}"
    echo ""
    echo -e "${GREEN}Updates Required:${NC}"
    echo -e "  1. Update ${BLUE}.env${NC} file:"
    echo -e "     WIDGET_PUBLIC_URL=${WIDGET_URL}"
    echo -e "  2. Update Genesys Cloud Integration:"
    echo -e "     Application URL: ${WIDGET_URL}/widget"
    echo ""
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}ngrok Management${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Web Interface:${NC}"
echo -e "  ${BLUE}http://localhost:4040${NC}"
echo -e "  (View requests, responses, and tunnel status)"
echo ""
echo -e "${GREEN}Stop ngrok:${NC}"
echo -e "  ${BLUE}kill $NGROK_PID${NC}"
echo -e "  Or: ${BLUE}pkill ngrok${NC}"
echo ""
echo -e "${GREEN}Restart ngrok:${NC}"
echo -e "  ${BLUE}./setup-ngrok.sh${NC}"
echo ""
echo -e "${YELLOW}Important Notes:${NC}"
echo -e "  • Free ngrok URLs expire when ngrok stops"
echo -e "  • You'll get new URLs each time ngrok restarts"
echo -e "  • Update webhook URLs in Meta/Genesys after restart"
echo -e "  • For permanent URLs, upgrade to ngrok paid plan"
echo ""

# Save URLs to file for easy reference
URLS_FILE="/tmp/ngrok-webhook-urls.txt"
cat > $URLS_FILE << EOF
WhatsApp-Genesys Integration MVP - ngrok Webhook URLs
Generated: $(date)

$(if [ "$SETUP_WHATSAPP" = true ]; then
    echo "WhatsApp Webhook:"
    echo "  Full URL: ${WHATSAPP_URL}/webhook/whatsapp"
    echo "  Verify Token: whatsapp_webhook_verify_token_2024"
    echo ""
fi)

$(if [ "$SETUP_GENESYS" = true ]; then
    echo "Genesys Webhook:"
    echo "  Webhook URL: ${GENESYS_URL}/webhook/genesys"
    echo "  Integration ID: 953973be-eb1f-4a3b-8541-62b3e809c803"
    echo ""
fi)

$(if [ "$SETUP_WIDGET" = true ]; then
    echo "Agent Widget:"
    echo "  Public URL: ${WIDGET_URL}"
    echo "  Widget URL: ${WIDGET_URL}/widget"
    echo ""
fi)

ngrok Web Interface: http://localhost:4040
ngrok PID: $NGROK_PID

To stop: kill $NGROK_PID
EOF

echo -e "${GREEN}Webhook URLs saved to:${NC} ${BLUE}$URLS_FILE${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop monitoring, or close this terminal${NC}"
echo -e "${YELLOW}ngrok will continue running in the background${NC}"
echo ""

# Follow ngrok logs
tail -f /tmp/ngrok.log
