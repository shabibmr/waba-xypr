#!/bin/bash

# Setup script for Amazon Linux 2/2023
# EC2 Server: ec2-16-112-132-107.ap-south-2.compute.amazonaws.com
# User: ec2-user

set -e

echo "================================================"
echo "WABA Setup for Amazon Linux"
echo "Server: ec2-16-112-132-107.ap-south-2"
echo "Region: ap-south-2 (Hyderabad, India)"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect Amazon Linux version
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_VERSION=$VERSION_ID
    echo -e "${BLUE}Detected OS: $NAME $VERSION${NC}"
else
    echo -e "${RED}Cannot detect OS version${NC}"
    exit 1
fi

# Update system
echo -e "${YELLOW}Step 1/7: Updating system packages...${NC}"
sudo yum update -y
echo -e "${GREEN}✓ System updated${NC}"
echo ""

# Install Docker
echo -e "${YELLOW}Step 2/7: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    sudo yum install -y docker
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -a -G docker ec2-user
    echo -e "${GREEN}✓ Docker installed${NC}"
else
    echo -e "${GREEN}✓ Docker already installed${NC}"
fi
docker --version
echo ""

# Install Docker Compose
echo -e "${YELLOW}Step 3/7: Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✓ Docker Compose already installed${NC}"
fi
docker-compose --version
echo ""

# Install PostgreSQL client
echo -e "${YELLOW}Step 4/7: Installing PostgreSQL client...${NC}"
if ! command -v psql &> /dev/null; then
    # Amazon Linux 2023 uses postgresql15
    if [[ "$VERSION_ID" == "2023" ]]; then
        sudo yum install -y postgresql15
    else
        # Amazon Linux 2
        sudo amazon-linux-extras install -y postgresql14
    fi
    echo -e "${GREEN}✓ PostgreSQL client installed${NC}"
else
    echo -e "${GREEN}✓ PostgreSQL client already installed${NC}"
fi
psql --version
echo ""

# Install Git
echo -e "${YELLOW}Step 5/7: Installing Git...${NC}"
if ! command -v git &> /dev/null; then
    sudo yum install -y git
    echo -e "${GREEN}✓ Git installed${NC}"
else
    echo -e "${GREEN}✓ Git already installed${NC}"
fi
git --version
echo ""

# Install additional tools
echo -e "${YELLOW}Step 6/7: Installing additional tools...${NC}"
sudo yum install -y \
    htop \
    vim \
    curl \
    wget \
    jq \
    net-tools \
    bind-utils
echo -e "${GREEN}✓ Additional tools installed${NC}"
echo ""

# Configure firewall (if firewalld is running)
echo -e "${YELLOW}Step 7/7: Configuring firewall...${NC}"
if systemctl is-active --quiet firewalld; then
    echo "Firewalld is active, opening ports..."

    # Application ports
    sudo firewall-cmd --permanent --add-port=3000/tcp   # API Gateway
    sudo firewall-cmd --permanent --add-port=3002/tcp   # Inbound Transformer
    sudo firewall-cmd --permanent --add-port=3003/tcp   # Outbound Transformer
    sudo firewall-cmd --permanent --add-port=3004/tcp   # Auth Service
    sudo firewall-cmd --permanent --add-port=3005/tcp   # State Manager
    sudo firewall-cmd --permanent --add-port=3006/tcp   # Admin Dashboard
    sudo firewall-cmd --permanent --add-port=3007/tcp   # Tenant Service
    sudo firewall-cmd --permanent --add-port=3008/tcp   # WhatsApp API Service
    sudo firewall-cmd --permanent --add-port=3009/tcp   # WhatsApp Webhook
    sudo firewall-cmd --permanent --add-port=3010/tcp   # Genesys API Service
    sudo firewall-cmd --permanent --add-port=3011/tcp   # Genesys Webhook
    sudo firewall-cmd --permanent --add-port=3012/tcp   # Agent Widget
    sudo firewall-cmd --permanent --add-port=3014/tcp   # Agent Portal
    sudo firewall-cmd --permanent --add-port=3015/tcp   # Agent Portal Service

    # Infrastructure ports
    sudo firewall-cmd --permanent --add-port=15672/tcp  # RabbitMQ UI
    sudo firewall-cmd --permanent --add-port=9001/tcp   # MinIO Console

    # Reload firewall
    sudo firewall-cmd --reload
    echo -e "${GREEN}✓ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠ Firewalld not running, skipping firewall configuration${NC}"
    echo -e "${YELLOW}  Make sure AWS Security Group allows required ports${NC}"
fi
echo ""

# Optimize system for Docker
echo -e "${YELLOW}Optimizing system settings...${NC}"

# Increase file limits
sudo tee -a /etc/sysctl.conf > /dev/null <<EOF

# WABA Docker Optimizations
fs.file-max = 65536
vm.max_map_count = 262144
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 2048
EOF

sudo sysctl -p
echo -e "${GREEN}✓ System optimized${NC}"
echo ""

# Create application directory
echo -e "${YELLOW}Creating application directory...${NC}"
mkdir -p ~/waba-xypr
cd ~/waba-xypr
echo -e "${GREEN}✓ Application directory ready: $(pwd)${NC}"
echo ""

echo "================================================"
echo -e "${GREEN}Setup Complete!${NC}"
echo "================================================"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Logout and login again to apply Docker group permissions:"
echo -e "   ${BLUE}exit${NC}"
echo -e "   ${BLUE}ssh ec2-user@ec2-16-112-132-107.ap-south-2.compute.amazonaws.com${NC}"
echo ""
echo "2. Clone your repository:"
echo -e "   ${BLUE}cd ~/waba-xypr${NC}"
echo -e "   ${BLUE}git clone YOUR_REPO_URL .${NC}"
echo ""
echo "3. Copy and configure environment file:"
echo -e "   ${BLUE}cp .env.aws-server .env${NC}"
echo -e "   ${BLUE}nano .env${NC}"
echo "   - Update DB_HOST with your RDS endpoint"
echo "   - Update DB_PASSWORD with your RDS password"
echo "   - Update Meta WhatsApp credentials"
echo "   - Update Genesys credentials"
echo "   - Update JWT_SECRET"
echo ""
echo "4. Deploy the application:"
echo -e "   ${BLUE}chmod +x scripts/*.sh${NC}"
echo -e "   ${BLUE}./scripts/deploy-aws-dev.sh${NC}"
echo ""
echo -e "${YELLOW}Server Information:${NC}"
echo "  Public IP:    16.112.132.107"
echo "  Region:       ap-south-2 (Hyderabad)"
echo "  User:         ec2-user"
echo "  Home:         /home/ec2-user"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "  Make sure your AWS Security Group allows inbound traffic on:"
echo "  - Port 22 (SSH)"
echo "  - Ports 3000-3015 (Application services)"
echo "  - Port 15672 (RabbitMQ UI)"
echo "  - Port 9001 (MinIO Console)"
echo ""
