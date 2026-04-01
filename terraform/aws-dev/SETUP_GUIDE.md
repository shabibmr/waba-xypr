# AWS CLI & Terraform Installation Guide

Complete guide to install and configure AWS CLI and Terraform for WABA deployment.

## Step 1: Install AWS CLI

### macOS
```bash
# Using Homebrew (recommended)
brew install awscli

# Or using official installer
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Verify installation
aws --version
```

### Linux (Ubuntu/Debian)
```bash
# Download installer
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip

# Install
sudo ./aws/install

# Verify installation
aws --version
```

### Windows
```powershell
# Download and run the installer from:
# https://awscli.amazonaws.com/AWSCLIV2.msi

# Or using Chocolatey
choco install awscli

# Verify installation
aws --version
```

## Step 2: Install Terraform

### macOS
```bash
# Using Homebrew (recommended)
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Verify installation
terraform --version
```

### Linux (Ubuntu/Debian)
```bash
# Add HashiCorp GPG key
wget -O- https://apt.releases.hashicorp.com/gpg | \
    gpg --dearmor | \
    sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg

# Add HashiCorp repository
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] \
    https://apt.releases.hashicorp.com $(lsb_release -cs) main" | \
    sudo tee /etc/apt/sources.list.d/hashicorp.list

# Update and install
sudo apt update
sudo apt install terraform

# Verify installation
terraform --version
```

### Windows
```powershell
# Using Chocolatey
choco install terraform

# Or download from:
# https://www.terraform.io/downloads

# Verify installation
terraform --version
```

## Step 3: Configure AWS CLI

### Get AWS Credentials

You need:
- **AWS Access Key ID**
- **AWS Secret Access Key**

**Get from AWS Console:**
1. Go to: https://console.aws.amazon.com/iam/
2. Click: **Users** → Your username → **Security credentials**
3. Click: **Create access key** → **Command Line Interface (CLI)**
4. Download or copy the credentials

### Configure AWS CLI

```bash
# Interactive configuration
aws configure

# Enter your credentials:
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-east-1
Default output format [None]: json
```

### Verify AWS Configuration

```bash
# Test connection
aws sts get-caller-identity

# Should output:
# {
#     "UserId": "AIDAI...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/your-username"
# }

# List regions
aws ec2 describe-regions --output table
```

## Step 4: Set Up AWS Prerequisites

### 4.1 Get Your Public IP

```bash
# Get your current public IP
MY_IP=$(curl -s ifconfig.me)
echo "Your Public IP: $MY_IP"

# You'll use this for SSH security group rules
```

### 4.2 Create or Get VPC Information

```bash
# Option A: Use default VPC (easiest)
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query 'Vpcs[0].VpcId' \
  --output text)

echo "Default VPC ID: $VPC_ID"

# Option B: Create new VPC (optional)
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=waba-dev-vpc},{Key=Project,Value=WABA}]' \
  --query 'Vpc.VpcId' \
  --output text)

echo "New VPC ID: $VPC_ID"
```

### 4.3 Get Subnet Information

```bash
# Get public subnets from your VPC
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[*].[SubnetId,AvailabilityZone,CidrBlock,MapPublicIpOnLaunch]' \
  --output table

# Get first public subnet for EC2
EC2_SUBNET=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[0].SubnetId' \
  --output text)

echo "EC2 Subnet: $EC2_SUBNET"

# Get two subnets for RDS (needs 2 AZs)
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[0:2].[SubnetId,AvailabilityZone]' \
  --output text > subnets.txt

SUBNET_1=$(sed -n '1p' subnets.txt | awk '{print $1}')
SUBNET_2=$(sed -n '2p' subnets.txt | awk '{print $1}')

echo "RDS Subnet 1: $SUBNET_1"
echo "RDS Subnet 2: $SUBNET_2"
```

### 4.4 Create DB Subnet Group

```bash
# Create DB subnet group (required for RDS)
aws rds create-db-subnet-group \
  --db-subnet-group-name waba-dev-db-subnet-group \
  --db-subnet-group-description "WABA Development DB Subnet Group" \
  --subnet-ids $SUBNET_1 $SUBNET_2 \
  --tags Key=Project,Value=WABA Key=Environment,Value=Development

echo "DB Subnet Group: waba-dev-db-subnet-group"
```

### 4.5 Create EC2 Key Pair

```bash
# Create new SSH key pair
aws ec2 create-key-pair \
  --key-name waba-dev-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/waba-dev-key.pem

# Set correct permissions
chmod 400 ~/.ssh/waba-dev-key.pem

echo "Key created: ~/.ssh/waba-dev-key.pem"

# Verify key exists
aws ec2 describe-key-pairs --key-names waba-dev-key
```

## Step 5: Create terraform.tfvars

Now create your Terraform variables file with the values you gathered:

```bash
cd terraform/aws-dev

# Create terraform.tfvars with your values
cat > terraform.tfvars <<EOF
# AWS Configuration
aws_region = "us-east-1"

# Project Configuration
project_name = "waba"
environment  = "dev"

# Network Configuration
vpc_id                = "$VPC_ID"
ec2_subnet_id         = "$EC2_SUBNET"
db_subnet_group_name  = "waba-dev-db-subnet-group"

# EC2 Configuration
key_pair_name = "waba-dev-key"

# Security Configuration (your IP only for SSH)
ssh_allowed_ips = ["$MY_IP/32"]

# Instance Configuration
ec2_instance_type = "t3.small"

# Database Configuration
db_name     = "whatsapp_genesys"
db_username = "postgres"
EOF

echo "✅ terraform.tfvars created"
cat terraform.tfvars
```

## Step 6: Verify Everything is Ready

```bash
# Check AWS CLI
echo "1. AWS CLI Version:"
aws --version

# Check Terraform
echo -e "\n2. Terraform Version:"
terraform --version

# Check AWS credentials
echo -e "\n3. AWS Account:"
aws sts get-caller-identity

# Check VPC
echo -e "\n4. VPC ID:"
echo $VPC_ID

# Check Subnet
echo -e "\n5. EC2 Subnet:"
echo $EC2_SUBNET

# Check DB Subnet Group
echo -e "\n6. DB Subnet Group:"
aws rds describe-db-subnet-groups \
  --db-subnet-group-name waba-dev-db-subnet-group \
  --query 'DBSubnetGroups[0].[DBSubnetGroupName,Subnets[*].SubnetIdentifier]' \
  --output text

# Check Key Pair
echo -e "\n7. SSH Key Pair:"
ls -lh ~/.ssh/waba-dev-key.pem
aws ec2 describe-key-pairs --key-names waba-dev-key

# Check terraform.tfvars
echo -e "\n8. Terraform Variables:"
cat terraform.tfvars

echo -e "\n✅ All prerequisites verified!"
```

## Step 7: Deploy with Terraform

```bash
# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Preview changes
terraform plan

# Deploy infrastructure (~10-15 minutes)
terraform apply

# Save outputs
terraform output -json > deployment-info.json

# Get SSH command
terraform output ssh_command

# Get database credentials (SAVE THESE!)
terraform output -json db_password | jq -r
```

## Troubleshooting

### AWS CLI Issues

**Error: "Unable to locate credentials"**
```bash
# Check configuration
cat ~/.aws/credentials
cat ~/.aws/config

# Reconfigure
aws configure
```

**Error: "Access Denied"**
```bash
# Check your IAM permissions - you need:
# - AmazonEC2FullAccess
# - AmazonRDSFullAccess
# - AmazonVPCFullAccess

# Verify permissions
aws iam get-user
aws iam list-attached-user-policies --user-name YOUR_USERNAME
```

### Terraform Issues

**Error: "No valid credential sources found"**
```bash
# Terraform uses AWS CLI credentials
aws configure

# Or set environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"
```

**Error: "DBSubnetGroupDoesNotCoverEnoughAZs"**
```bash
# RDS needs subnets in at least 2 different AZs
# List subnets by AZ
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[*].[SubnetId,AvailabilityZone]' \
  --output table

# Recreate DB subnet group with subnets from different AZs
```

**Error: "InvalidKeyPair.NotFound"**
```bash
# Verify key pair exists
aws ec2 describe-key-pairs

# Create if missing
aws ec2 create-key-pair --key-name waba-dev-key \
  --query 'KeyMaterial' --output text > ~/.ssh/waba-dev-key.pem
chmod 400 ~/.ssh/waba-dev-key.pem
```

### VPC/Subnet Issues

**No default VPC found**
```bash
# Create new VPC
aws ec2 create-default-vpc

# Or create custom VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16

# Create subnets in different AZs
aws ec2 create-subnet --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 --availability-zone us-east-1b
```

## Quick Reference Commands

```bash
# AWS CLI
aws configure                          # Configure credentials
aws sts get-caller-identity           # Verify credentials
aws ec2 describe-regions              # List regions
aws ec2 describe-vpcs                 # List VPCs
aws ec2 describe-subnets              # List subnets
aws ec2 describe-key-pairs            # List key pairs

# Terraform
terraform init                         # Initialize
terraform validate                     # Validate syntax
terraform plan                         # Preview changes
terraform apply                        # Deploy
terraform destroy                      # Destroy all
terraform output                       # Show outputs
terraform state list                   # List resources

# Get your public IP
curl ifconfig.me
```

## Next Steps

Once setup is complete:
1. ✅ Run `terraform apply` to deploy infrastructure
2. ✅ SSH to EC2: `ssh -i ~/.ssh/waba-dev-key.pem ubuntu@ELASTIC_IP`
3. ✅ Clone repo and deploy WABA services
4. ✅ Access services via Elastic IP

See `README.md` for complete deployment guide.
