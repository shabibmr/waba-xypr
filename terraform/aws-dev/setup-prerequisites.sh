#!/bin/bash
set -e

# WABA AWS Prerequisites Setup Script
# Creates VPC, subnets, key pair, and generates terraform.tfvars

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if AWS CLI is configured
check_aws() {
    if ! command -v aws &> /dev/null; then
        echo "❌ AWS CLI not found. Run ./install.sh first"
        exit 1
    fi

    if ! aws sts get-caller-identity &> /dev/null; then
        echo "❌ AWS CLI not configured. Run: aws configure"
        exit 1
    fi

    log_info "✅ AWS CLI configured"
    aws sts get-caller-identity
}

# Get user's public IP
get_public_ip() {
    log_info "Getting your public IP..."
    MY_IP=$(curl -s ifconfig.me)
    if [ -z "$MY_IP" ]; then
        MY_IP=$(curl -s ipinfo.io/ip)
    fi

    if [ -z "$MY_IP" ]; then
        log_warn "Could not determine public IP automatically"
        read -p "Enter your public IP address: " MY_IP
    fi

    log_info "Your public IP: $MY_IP"
}

# Get or create VPC
setup_vpc() {
    log_info "Setting up VPC..."

    # Check for default VPC
    DEFAULT_VPC=$(aws ec2 describe-vpcs \
        --filters "Name=isDefault,Values=true" \
        --query 'Vpcs[0].VpcId' \
        --output text 2>/dev/null || echo "None")

    if [ "$DEFAULT_VPC" != "None" ]; then
        log_info "Found default VPC: $DEFAULT_VPC"
        read -p "Use default VPC? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            VPC_ID=$DEFAULT_VPC
            log_info "Using VPC: $VPC_ID"
            return 0
        fi
    fi

    # Create new VPC
    read -p "Create new VPC? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Creating new VPC..."
        VPC_ID=$(aws ec2 create-vpc \
            --cidr-block 10.0.0.0/16 \
            --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=waba-dev-vpc},{Key=Project,Value=WABA},{Key=Environment,Value=Development}]' \
            --query 'Vpc.VpcId' \
            --output text)

        log_info "Created VPC: $VPC_ID"

        # Enable DNS hostnames
        aws ec2 modify-vpc-attribute \
            --vpc-id $VPC_ID \
            --enable-dns-hostnames

        # Create Internet Gateway
        IGW_ID=$(aws ec2 create-internet-gateway \
            --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=waba-dev-igw}]' \
            --query 'InternetGateway.InternetGatewayId' \
            --output text)

        aws ec2 attach-internet-gateway \
            --vpc-id $VPC_ID \
            --internet-gateway-id $IGW_ID

        log_info "Created Internet Gateway: $IGW_ID"
    else
        echo "Please enter VPC ID manually:"
        read VPC_ID
    fi
}

# Create subnets
setup_subnets() {
    log_info "Setting up subnets..."

    # Get availability zones
    AZS=($(aws ec2 describe-availability-zones \
        --query 'AvailabilityZones[*].ZoneName' \
        --output text))

    log_info "Available AZs: ${AZS[*]}"

    # Check for existing subnets
    EXISTING_SUBNETS=$(aws ec2 describe-subnets \
        --filters "Name=vpc-id,Values=$VPC_ID" \
        --query 'Subnets[*].[SubnetId,AvailabilityZone,CidrBlock]' \
        --output text)

    if [ ! -z "$EXISTING_SUBNETS" ]; then
        log_info "Found existing subnets:"
        echo "$EXISTING_SUBNETS"
        read -p "Use existing subnets? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Use first subnet for EC2
            EC2_SUBNET=$(aws ec2 describe-subnets \
                --filters "Name=vpc-id,Values=$VPC_ID" \
                --query 'Subnets[0].SubnetId' \
                --output text)

            # Get two subnets for RDS
            SUBNET_1=$(aws ec2 describe-subnets \
                --filters "Name=vpc-id,Values=$VPC_ID" \
                --query 'Subnets[0].SubnetId' \
                --output text)

            SUBNET_2=$(aws ec2 describe-subnets \
                --filters "Name=vpc-id,Values=$VPC_ID" \
                --query 'Subnets[1].SubnetId' \
                --output text)

            log_info "Using EC2 subnet: $EC2_SUBNET"
            log_info "Using RDS subnets: $SUBNET_1, $SUBNET_2"
            return 0
        fi
    fi

    # Create new subnets
    log_info "Creating subnets in different AZs..."

    # Public subnet 1 (for EC2)
    SUBNET_1=$(aws ec2 create-subnet \
        --vpc-id $VPC_ID \
        --cidr-block 10.0.1.0/24 \
        --availability-zone ${AZS[0]} \
        --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=waba-dev-public-1},{Key=Type,Value=Public}]' \
        --query 'Subnet.SubnetId' \
        --output text)

    # Enable auto-assign public IP
    aws ec2 modify-subnet-attribute \
        --subnet-id $SUBNET_1 \
        --map-public-ip-on-launch

    log_info "Created public subnet 1: $SUBNET_1 (${AZS[0]})"

    # Public subnet 2 (for RDS multi-AZ requirement)
    SUBNET_2=$(aws ec2 create-subnet \
        --vpc-id $VPC_ID \
        --cidr-block 10.0.2.0/24 \
        --availability-zone ${AZS[1]} \
        --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=waba-dev-public-2},{Key=Type,Value=Public}]' \
        --query 'Subnet.SubnetId' \
        --output text)

    aws ec2 modify-subnet-attribute \
        --subnet-id $SUBNET_2 \
        --map-public-ip-on-launch

    log_info "Created public subnet 2: $SUBNET_2 (${AZS[1]})"

    # Create route table for internet access
    ROUTE_TABLE=$(aws ec2 create-route-table \
        --vpc-id $VPC_ID \
        --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=waba-dev-public-rt}]' \
        --query 'RouteTable.RouteTableId' \
        --output text)

    # Add route to internet gateway
    aws ec2 create-route \
        --route-table-id $ROUTE_TABLE \
        --destination-cidr-block 0.0.0.0/0 \
        --gateway-id $IGW_ID

    # Associate subnets with route table
    aws ec2 associate-route-table \
        --subnet-id $SUBNET_1 \
        --route-table-id $ROUTE_TABLE

    aws ec2 associate-route-table \
        --subnet-id $SUBNET_2 \
        --route-table-id $ROUTE_TABLE

    EC2_SUBNET=$SUBNET_1
}

# Create DB subnet group
setup_db_subnet_group() {
    log_info "Setting up RDS DB subnet group..."

    # Check if exists
    if aws rds describe-db-subnet-groups \
        --db-subnet-group-name waba-dev-db-subnet-group &> /dev/null; then
        log_warn "DB subnet group already exists"
        return 0
    fi

    aws rds create-db-subnet-group \
        --db-subnet-group-name waba-dev-db-subnet-group \
        --db-subnet-group-description "WABA Development DB Subnet Group" \
        --subnet-ids $SUBNET_1 $SUBNET_2 \
        --tags Key=Project,Value=WABA Key=Environment,Value=Development

    log_info "✅ Created DB subnet group: waba-dev-db-subnet-group"
}

# Create or get EC2 key pair
setup_key_pair() {
    log_info "Setting up SSH key pair..."

    KEY_NAME="waba-dev-key"
    KEY_FILE="$HOME/.ssh/${KEY_NAME}.pem"

    # Check if key already exists in AWS
    if aws ec2 describe-key-pairs --key-names $KEY_NAME &> /dev/null; then
        log_warn "Key pair '$KEY_NAME' already exists in AWS"

        if [ -f "$KEY_FILE" ]; then
            log_info "Local key file found: $KEY_FILE"
            return 0
        else
            log_warn "Local key file not found at $KEY_FILE"
            read -p "Delete and recreate key pair? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                aws ec2 delete-key-pair --key-name $KEY_NAME
            else
                log_info "Please ensure you have the private key file"
                return 0
            fi
        fi
    fi

    # Create new key pair
    log_info "Creating new SSH key pair..."
    mkdir -p ~/.ssh

    aws ec2 create-key-pair \
        --key-name $KEY_NAME \
        --query 'KeyMaterial' \
        --output text > $KEY_FILE

    chmod 400 $KEY_FILE

    log_info "✅ Created SSH key: $KEY_FILE"
}

# Generate terraform.tfvars
generate_tfvars() {
    log_info "Generating terraform.tfvars..."

    # Get AWS region
    AWS_REGION=$(aws configure get region || echo "us-east-1")

    cat > terraform.tfvars <<EOF
# AWS Configuration
aws_region = "$AWS_REGION"

# Project Configuration
project_name = "waba"
environment  = "dev"

# Network Configuration
vpc_id                = "$VPC_ID"
ec2_subnet_id         = "$EC2_SUBNET"
db_subnet_group_name  = "waba-dev-db-subnet-group"

# EC2 Configuration
key_pair_name = "waba-dev-key"

# Security Configuration (restricted to your IP)
ssh_allowed_ips = ["$MY_IP/32"]

# Instance Configuration
ec2_instance_type = "t3.small"

# Database Configuration
db_name     = "whatsapp_genesys"
db_username = "postgres"
EOF

    log_info "✅ Created terraform.tfvars"
}

# Display summary
show_summary() {
    echo ""
    log_info "======================================"
    log_info "Setup Summary"
    log_info "======================================"
    echo ""
    echo "AWS Region:        $AWS_REGION"
    echo "VPC ID:            $VPC_ID"
    echo "EC2 Subnet:        $EC2_SUBNET"
    echo "RDS Subnets:       $SUBNET_1, $SUBNET_2"
    echo "DB Subnet Group:   waba-dev-db-subnet-group"
    echo "SSH Key:           $HOME/.ssh/waba-dev-key.pem"
    echo "Your IP:           $MY_IP/32"
    echo ""
    log_info "✅ All prerequisites configured!"
    echo ""
    log_info "======================================"
    log_info "Next Steps"
    log_info "======================================"
    echo ""
    echo "1. Review terraform.tfvars (just created)"
    echo "2. Initialize Terraform:"
    echo "   $ terraform init"
    echo ""
    echo "3. Preview infrastructure:"
    echo "   $ terraform plan"
    echo ""
    echo "4. Deploy infrastructure (~10-15 minutes):"
    echo "   $ terraform apply"
    echo ""
    echo "5. Get deployment info:"
    echo "   $ terraform output"
    echo ""
}

# Main
main() {
    echo ""
    log_info "======================================"
    log_info "WABA AWS Prerequisites Setup"
    log_info "======================================"
    echo ""

    check_aws
    get_public_ip
    setup_vpc
    setup_subnets
    setup_db_subnet_group
    setup_key_pair
    generate_tfvars
    show_summary
}

main
