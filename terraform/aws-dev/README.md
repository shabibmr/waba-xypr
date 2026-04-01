# WABA Development Infrastructure - Terraform

Terraform configuration for deploying WABA WhatsApp-Genesys integration on AWS with minimal cost (~$35/month).

## Architecture

- **RDS PostgreSQL**: db.t4g.micro (2 vCPU, 1GB RAM, 20GB gp3) - ~$13/month
- **EC2 Instance**: t3.small (2 vCPU, 2GB RAM, 20GB gp3) - ~$15/month
- **Elastic IP**: Static public IP
- **Security Groups**: RDS + EC2 with restricted access
- **Total Cost**: ~$35/month

## Prerequisites

1. **AWS CLI configured**:
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and region
   ```

2. **Terraform installed** (>= 1.0):
   ```bash
   # macOS
   brew install terraform

   # Linux
   wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
   unzip terraform_1.6.0_linux_amd64.zip
   sudo mv terraform /usr/local/bin/
   ```

3. **EC2 Key Pair created**:
   ```bash
   # Create new key pair
   aws ec2 create-key-pair --key-name waba-dev-key \
     --query 'KeyMaterial' --output text > ~/.ssh/waba-dev-key.pem
   chmod 400 ~/.ssh/waba-dev-key.pem

   # Or use existing key pair name
   aws ec2 describe-key-pairs
   ```

4. **AWS Network Resources**:
   You need:
   - VPC ID
   - Public subnet ID (for EC2)
   - DB subnet group (with 2+ subnets in different AZs for RDS)

## Quick Start

### 1. Get Your AWS Network Information

```bash
# Get your default VPC ID
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
  --query 'Vpcs[0].VpcId' --output text)
echo "VPC ID: $VPC_ID"

# Get a public subnet ID
SUBNET_ID=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[0].SubnetId' --output text)
echo "Subnet ID: $SUBNET_ID"

# Get your public IP
MY_IP=$(curl -s ifconfig.me)
echo "Your IP: $MY_IP/32"
```

### 2. Create DB Subnet Group (if needed)

```bash
# Get all subnets in your VPC (need at least 2 in different AZs)
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[*].[SubnetId,AvailabilityZone]' --output table

# Create DB subnet group (replace subnet IDs)
aws rds create-db-subnet-group \
  --db-subnet-group-name waba-dev-db-subnet-group \
  --db-subnet-group-description "WABA Dev DB Subnet Group" \
  --subnet-ids subnet-xxxxx subnet-yyyyy \
  --tags Key=Project,Value=WABA Key=Environment,Value=Development
```

### 3. Configure Terraform Variables

```bash
# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required changes in `terraform.tfvars`**:
```hcl
vpc_id                = "vpc-xxxxxxxxxxxxx"       # From step 1
ec2_subnet_id         = "subnet-xxxxxxxxxxxxx"    # From step 1
db_subnet_group_name  = "waba-dev-db-subnet-group" # From step 2
key_pair_name         = "waba-dev-key"            # Your key pair name
ssh_allowed_ips       = ["YOUR_IP/32"]            # From step 1 (for security)
```

### 4. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Deploy (takes ~10-15 minutes)
terraform apply

# Save outputs
terraform output -json > deployment-info.json
```

### 5. Get Deployment Information

```bash
# Get EC2 public IP
terraform output ec2_public_ip

# Get SSH command
terraform output ssh_command

# Get database credentials (SAVE THESE!)
terraform output -json db_password

# Get all service URLs
terraform output service_urls

# Get .env file snippet
terraform output -raw env_file_snippet > ../../../.env.terraform
```

## Post-Deployment Steps

### 1. SSH to EC2 Instance

```bash
# Wait for user-data script to complete (~2 minutes)
ssh -i ~/.ssh/waba-dev-key.pem ubuntu@$(terraform output -raw ec2_public_ip)

# Check user-data completion
ls -la /opt/waba/user-data-complete

# Verify Docker
docker --version
docker-compose --version
```

### 2. Deploy Application

```bash
# On EC2 instance
cd /opt/waba

# Clone repository
git clone YOUR_REPO_URL waba-xypr
cd waba-xypr

# Create .env file (use terraform output env_file_snippet)
cat > .env << 'EOF'
# Paste output from: terraform output -raw env_file_snippet

# Add your Meta WhatsApp credentials
META_APP_SECRET=your_app_secret
META_VERIFY_TOKEN=your_verify_token
META_ACCESS_TOKEN=your_access_token
META_APP_ID=your_app_id
META_CONFIG_ID=your_config_id
META_BUSINESS_ID=your_business_id

# Add your Genesys credentials
GENESYS_CLIENT_ID=your_client_id
GENESYS_CLIENT_SECRET=your_client_secret
GENESYS_REGION=mypurecloud.com
GENESYS_BASE_URL=https://api.mypurecloud.com

# Other required vars
JWT_SECRET=$(openssl rand -base64 32)
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=devpass123
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=devminio123
NODE_ENV=development
LOG_LEVEL=debug
VITE_ENABLE_DEV_LOGIN=true
EOF

chmod 600 .env

# Deploy with manage.sh script
./manage.sh start
```

### 3. Verify Deployment

```bash
# Check service health
./manage.sh status

# View logs
./manage.sh logs

# Access services (from your local machine)
ELASTIC_IP=$(terraform output -raw ec2_public_ip)

# API Gateway
curl http://$ELASTIC_IP:3000/health

# RabbitMQ UI
open http://$ELASTIC_IP:15672  # guest/guest

# Agent Portal
open http://$ELASTIC_IP:3014

# MinIO Console
open http://$ELASTIC_IP:9001  # admin/devminio123
```

## Access Points

After deployment, access services at:

| Service | URL | Credentials |
|---------|-----|-------------|
| API Gateway | `http://ELASTIC_IP:3000` | - |
| Agent Portal | `http://ELASTIC_IP:3014` | Dev login enabled |
| Admin Dashboard | `http://ELASTIC_IP:3006` | - |
| RabbitMQ UI | `http://ELASTIC_IP:15672` | guest / guest |
| MinIO Console | `http://ELASTIC_IP:9001` | admin / devminio123 |

Replace `ELASTIC_IP` with output from `terraform output ec2_public_ip`

## Management Commands

```bash
# View all outputs
terraform output

# Get specific output
terraform output ec2_public_ip
terraform output rds_endpoint

# Get sensitive outputs (DB password)
terraform output -json db_password

# Update infrastructure (after variable changes)
terraform plan
terraform apply

# Destroy infrastructure (CAUTION!)
terraform destroy
```

## Cost Management

### Stop Resources When Not in Use

```bash
# Stop EC2 (saves ~$15/month while stopped)
aws ec2 stop-instances --instance-ids $(terraform output -raw ec2_instance_id)

# Stop RDS (saves ~$13/month, max 7 days)
aws rds stop-db-instance --db-instance-identifier waba-postgres-dev

# Start them again
aws ec2 start-instances --instance-ids $(terraform output -raw ec2_instance_id)
aws rds start-db-instance --db-instance-identifier waba-postgres-dev
```

### Monitor Costs

```bash
# Check current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=TAG,Key=Project
```

## Troubleshooting

### RDS Connection Issues

```bash
# Test from EC2
PGPASSWORD=$(terraform output -raw db_password) \
psql -h $(terraform output -raw rds_address) \
     -U postgres \
     -d whatsapp_genesys

# Check security groups
aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=waba-rds-dev-sg"
```

### EC2 SSH Issues

```bash
# Verify key permissions
chmod 400 ~/.ssh/waba-dev-key.pem

# Check instance status
aws ec2 describe-instance-status \
  --instance-ids $(terraform output -raw ec2_instance_id)

# View user-data logs (from EC2)
sudo cat /var/log/cloud-init-output.log
```

### Terraform State Issues

```bash
# Refresh state
terraform refresh

# Import existing resource (if needed)
terraform import aws_instance.app_server i-xxxxxxxxxxxxx

# View state
terraform show
```

## Scaling to Production

When ready for production:

1. **Update variables**:
   ```hcl
   environment       = "prod"
   ec2_instance_type = "t3.large"
   ```

2. **Enable RDS Multi-AZ**:
   Edit `main.tf`:
   ```hcl
   resource "aws_db_instance" "postgres" {
     multi_az               = true
     backup_retention_period = 7
     deletion_protection    = true
   }
   ```

3. **Apply changes**:
   ```bash
   terraform plan
   terraform apply
   ```

## Clean Up

```bash
# Destroy all resources
terraform destroy

# Verify all resources deleted
aws ec2 describe-instances --filters "Name=tag:Project,Values=waba"
aws rds describe-db-instances --filters "Name=tag:Project,Values=waba"
```

## Support

- **Terraform Docs**: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- **AWS CLI Reference**: https://docs.aws.amazon.com/cli/
- **Project Docs**: `../../docs/deployment/`

## Security Notes

⚠️ **IMPORTANT**:
- Change `ssh_allowed_ips` from `0.0.0.0/0` to your IP
- Store `terraform.tfstate` securely (contains DB password)
- Use S3 backend for production (remote state)
- Rotate DB password regularly
- Enable AWS CloudTrail for audit logs
