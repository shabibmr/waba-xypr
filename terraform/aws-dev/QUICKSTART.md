# Quick Start - Automated Setup

Complete AWS infrastructure setup in 3 commands.

## One-Line Install (Copy & Paste)

```bash
cd terraform/aws-dev && ./install.sh && ./setup-prerequisites.sh && terraform init && terraform plan
```

## Step-by-Step (Recommended)

### Step 1: Install AWS CLI & Terraform (~5 minutes)

```bash
cd terraform/aws-dev
./install.sh
```

**What it does:**
- ✅ Detects your OS (macOS/Linux)
- ✅ Downloads and installs AWS CLI
- ✅ Downloads and installs Terraform
- ✅ Installs helpful tools (jq, postgresql-client)
- ✅ Prompts for AWS credentials
- ✅ Tests AWS connection

**You'll need:**
- AWS Access Key ID
- AWS Secret Access Key
- Get from: https://console.aws.amazon.com/iam/

---

### Step 2: Setup AWS Prerequisites (~3 minutes)

```bash
./setup-prerequisites.sh
```

**What it does:**
- ✅ Gets your public IP (for SSH security)
- ✅ Creates/uses VPC
- ✅ Creates subnets in 2 availability zones
- ✅ Creates DB subnet group (RDS requirement)
- ✅ Creates SSH key pair
- ✅ Generates `terraform.tfvars` with all values

**Interactive prompts:**
- Use default VPC or create new?
- Use existing subnets or create new?

---

### Step 3: Deploy Infrastructure (~10-15 minutes)

```bash
# Initialize Terraform
terraform init

# Preview what will be created
terraform plan

# Deploy (creates RDS + EC2 + Security Groups + Elastic IP)
terraform apply
```

**Type `yes` when prompted**

---

### Step 4: Get Deployment Info

```bash
# Get Elastic IP
terraform output ec2_public_ip

# Get SSH command
terraform output ssh_command

# Get database credentials (SAVE THESE!)
terraform output -json db_password

# Get .env snippet
terraform output -raw env_file_snippet > ../../.env.aws
```

---

## Post-Deployment: SSH & Deploy App

```bash
# SSH to EC2 (replace with your Elastic IP)
ssh -i ~/.ssh/waba-dev-key.pem ubuntu@YOUR_ELASTIC_IP

# Wait for user-data script to complete (~2 minutes)
# Check status:
ls -la /opt/waba/user-data-complete

# Clone repo
cd /opt/waba
git clone YOUR_REPO_URL waba-xypr
cd waba-xypr

# Create .env file (on your local machine first)
terraform output -raw env_file_snippet > .env.base

# Then on EC2, add your credentials:
nano .env

# Add these to .env:
# - META_* credentials (WhatsApp)
# - GENESYS_* credentials
# - JWT_SECRET (generate with: openssl rand -base64 32)
# - RabbitMQ/MinIO passwords

# Deploy services
./manage.sh start

# Check status
./manage.sh status
./manage.sh logs
```

---

## Access Your Services

Get your Elastic IP:
```bash
terraform output ec2_public_ip
```

Then access:
- **API Gateway**: http://YOUR_IP:3000
- **Agent Portal**: http://YOUR_IP:3014
- **Admin Dashboard**: http://YOUR_IP:3006
- **RabbitMQ UI**: http://YOUR_IP:15672 (guest/guest)
- **MinIO Console**: http://YOUR_IP:9001 (admin/devminio123)

---

## Troubleshooting

### Install Script Issues

**macOS: "command not found: brew"**
```bash
# Install Homebrew first
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then run install script again
./install.sh
```

**Linux: "permission denied"**
```bash
# Make script executable
chmod +x install.sh
./install.sh
```

### Prerequisites Script Issues

**"AWS CLI not configured"**
```bash
# Configure AWS manually
aws configure

# Then run script again
./setup-prerequisites.sh
```

**"DBSubnetGroupDoesNotCoverEnoughAZs"**
```bash
# RDS needs subnets in 2+ different AZs
# Delete and recreate:
aws rds delete-db-subnet-group --db-subnet-group-name waba-dev-db-subnet-group

# Run script again - it will create subnets in different AZs
./setup-prerequisites.sh
```

### Terraform Issues

**"Error: No valid credential sources"**
```bash
# Verify AWS CLI is configured
aws sts get-caller-identity

# If not, configure it
aws configure
```

**"Error: KeyPairNotFound"**
```bash
# Recreate key pair
aws ec2 delete-key-pair --key-name waba-dev-key
./setup-prerequisites.sh
```

**RDS creation takes too long**
```bash
# Normal - RDS takes ~10-15 minutes to provision
# You can check progress in AWS Console:
# https://console.aws.amazon.com/rds/
```

---

## Cost Optimization

### Stop when not in use

```bash
# Stop EC2 (saves ~$15/month)
aws ec2 stop-instances --instance-ids $(terraform output -raw ec2_instance_id)

# Stop RDS (saves ~$13/month, max 7 days)
aws rds stop-db-instance --db-instance-identifier waba-postgres-dev

# Start again
aws ec2 start-instances --instance-ids $(terraform output -raw ec2_instance_id)
aws rds start-db-instance --db-instance-identifier waba-postgres-dev
```

### Destroy everything

```bash
# CAUTION: This deletes ALL resources
terraform destroy

# Type 'yes' to confirm
```

---

## What Gets Created

| Resource | Type | Monthly Cost |
|----------|------|--------------|
| RDS PostgreSQL | db.t4g.micro | ~$13 |
| EC2 | t3.small | ~$15 |
| EBS Storage | 20GB gp3 | ~$2 |
| Elastic IP | 1 IP | $0 (while attached) |
| Data Transfer | ~5GB | ~$5 |
| **Total** | | **~$35** |

---

## Next Steps After Deployment

1. ✅ **Test connectivity**: `curl http://YOUR_IP:3000/health`
2. ✅ **Configure WhatsApp webhook**: Point to `http://YOUR_IP:3009/webhook`
3. ✅ **Configure Genesys webhook**: Point to `http://YOUR_IP:3011/webhook`
4. ✅ **Access Agent Portal**: http://YOUR_IP:3014
5. ✅ **Monitor logs**: `./manage.sh logs`

---

## Support

- **Full documentation**: `README.md`
- **Setup guide**: `SETUP_GUIDE.md`
- **Terraform basics**: https://www.terraform.io/intro
- **AWS free tier**: https://aws.amazon.com/free/

---

## Summary: 3 Commands to Full Deployment

```bash
# 1. Install tools
./install.sh

# 2. Setup AWS resources
./setup-prerequisites.sh

# 3. Deploy infrastructure
terraform init && terraform apply
```

**Total time: ~20 minutes**
**Monthly cost: ~$35**
