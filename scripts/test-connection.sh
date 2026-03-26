#!/bin/bash

# Test connection to EC2 server
# Run this from your LOCAL machine

echo "========================================"
echo "Testing Connection to EC2 Server"
echo "========================================"
echo ""

HOST="ec2-16-112-132-107.ap-south-2.compute.amazonaws.com"
IP="16.112.132.107"
USER="ec2-user"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Server Details:${NC}"
echo "  Hostname: $HOST"
echo "  IP:       $IP"
echo "  User:     $USER"
echo "  Region:   ap-south-2 (Hyderabad)"
echo ""

# Test 1: Ping
echo -e "${YELLOW}[1/4] Testing ICMP (ping)...${NC}"
if ping -c 2 $IP > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is reachable via ping${NC}"
else
    echo -e "${RED}✗ Cannot ping server (ICMP may be blocked)${NC}"
fi
echo ""

# Test 2: SSH port
echo -e "${YELLOW}[2/4] Testing SSH connection (port 22)...${NC}"
if timeout 5 bash -c "cat < /dev/null > /dev/tcp/$IP/22" 2>/dev/null; then
    echo -e "${GREEN}✓ SSH port (22) is open${NC}"
else
    echo -e "${RED}✗ Cannot connect to SSH port${NC}"
    echo "  Check if:"
    echo "  - EC2 instance is running"
    echo "  - Security group allows SSH from your IP"
    echo "  - Network ACLs allow traffic"
fi
echo ""

# Test 3: DNS resolution
echo -e "${YELLOW}[3/4] Testing DNS resolution...${NC}"
if host $HOST > /dev/null 2>&1; then
    RESOLVED_IP=$(host $HOST | grep "has address" | awk '{print $4}')
    echo -e "${GREEN}✓ DNS resolves to: $RESOLVED_IP${NC}"

    if [ "$RESOLVED_IP" = "$IP" ]; then
        echo -e "${GREEN}✓ IP matches expected address${NC}"
    else
        echo -e "${YELLOW}⚠ IP mismatch: expected $IP, got $RESOLVED_IP${NC}"
    fi
else
    echo -e "${RED}✗ Cannot resolve hostname${NC}"
fi
echo ""

# Test 4: SSH key authentication
echo -e "${YELLOW}[4/4] Testing SSH authentication...${NC}"
echo "Attempting SSH connection (will prompt for key if configured)..."
echo ""

if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 [path-to-ssh-key]${NC}"
    echo ""
    echo "Example:"
    echo "  $0 ~/.ssh/my-key.pem"
    echo "  $0 /path/to/keypair.pem"
    echo ""
    echo "Or test manually:"
    echo "  ssh -i your-key.pem $USER@$IP"
else
    SSH_KEY="$1"

    if [ ! -f "$SSH_KEY" ]; then
        echo -e "${RED}✗ SSH key not found: $SSH_KEY${NC}"
        exit 1
    fi

    # Set correct permissions
    chmod 600 "$SSH_KEY"

    echo "Testing with key: $SSH_KEY"

    if ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$USER@$IP" "echo 'Connection successful'" 2>/dev/null; then
        echo -e "${GREEN}✓ SSH authentication successful${NC}"
        echo ""
        echo -e "${GREEN}All tests passed! You can connect with:${NC}"
        echo -e "${YELLOW}ssh -i $SSH_KEY $USER@$IP${NC}"
    else
        echo -e "${RED}✗ SSH authentication failed${NC}"
        echo "  Check if:"
        echo "  - SSH key is correct"
        echo "  - Key has correct permissions (chmod 600)"
        echo "  - Key is authorized on the server"
    fi
fi

echo ""
echo "========================================"
echo "Service Port Tests"
echo "========================================"
echo ""

PORTS=(
    "3000:API Gateway"
    "3009:WhatsApp Webhook"
    "3011:Genesys Webhook"
    "3014:Agent Portal"
    "3006:Admin Dashboard"
    "15672:RabbitMQ UI"
    "9001:MinIO Console"
)

echo -e "${YELLOW}Testing if ports are accessible from your location...${NC}"
echo "(Services must be running for these to succeed)"
echo ""

for port_info in "${PORTS[@]}"; do
    IFS=':' read -r port service <<< "$port_info"

    if timeout 2 bash -c "cat < /dev/null > /dev/tcp/$IP/$port" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Port $port ($service)"
    else
        echo -e "${RED}✗${NC} Port $port ($service) - not accessible"
    fi
done

echo ""
echo "========================================"
echo "Next Steps"
echo "========================================"
echo ""
echo "1. Connect to server:"
echo -e "   ${YELLOW}ssh -i your-key.pem $USER@$IP${NC}"
echo ""
echo "2. Run setup script:"
echo -e "   ${YELLOW}curl -o setup.sh RAW_URL_TO_setup-amazon-linux.sh${NC}"
echo -e "   ${YELLOW}chmod +x setup.sh && ./setup.sh${NC}"
echo ""
echo "3. Follow deployment guide:"
echo -e "   ${YELLOW}See DEPLOY_TO_YOUR_SERVER.md${NC}"
echo ""
