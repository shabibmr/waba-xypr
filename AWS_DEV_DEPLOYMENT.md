# AWS Development/Testing Deployment - Minimal Specs

Deploy WABA integration on AWS with **minimal cost** for testing and development.

## Cost Comparison

| Configuration | Monthly Cost | Use Case |
|--------------|--------------|----------|
| **Development** | **~$35/month** | Testing, development |
| Production | ~$127/month | Production workload |

## Minimal Specs

### RDS PostgreSQL
- **Instance**: `db.t4g.micro` (2 vCPU, 1GB RAM, ARM-based)
- **Storage**: 20GB gp3
- **Multi-AZ**: No (single AZ)
- **Cost**: ~$13/month

### EC2 Instance
- **Instance**: `t3.small` (2 vCPU, 2GB RAM)
- **Storage**: 20GB gp3 EBS
- **Cost**: ~$15/month

### Data Transfer & Storage
- **Cost**: ~$7/month

## Quick Deploy (30 minutes)

### 1. Create RDS Database (5 min)

```bash
aws rds create-db-instance \
  --db-instance-identifier waba-postgres-dev \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password $(openssl rand -base64 16) \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxx \
  --db-name whatsapp_genesys \
  --backup-retention-period 1 \
  --publicly-accessible false \
  --no-multi-az \
  --tags Key=Environment,Value=Development Key=Project,Value=WABA
```

**Note**: Save the password! It will be needed for .env file.

**Wait for database to be available** (~10 min):
```bash
aws rds wait db-instance-available --db-instance-identifier waba-postgres-dev
```

Get the endpoint:
```bash
aws rds describe-db-instances \
  --db-instance-identifier waba-postgres-dev \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

### 2. Create Security Groups (2 min)

**RDS Security Group** (`waba-rds-dev-sg`):
```bash
# Create security group
RDS_SG=$(aws ec2 create-security-group \
  --group-name waba-rds-dev-sg \
  --description "WABA Dev RDS PostgreSQL" \
  --vpc-id vpc-xxxxx \
  --query 'GroupId' \
  --output text)

echo "RDS Security Group: $RDS_SG"
```

**EC2 Security Group** (`waba-ec2-dev-sg`):
```bash
# Create security group
EC2_SG=$(aws ec2 create-security-group \
  --group-name waba-ec2-dev-sg \
  --description "WABA Dev EC2 Instance" \
  --vpc-id vpc-xxxxx \
  --query 'GroupId' \
  --output text)

echo "EC2 Security Group: $EC2_SG"

# SSH from your IP
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG \
  --protocol tcp \
  --port 22 \
  --cidr $(curl -s ifconfig.me)/32

# HTTP/HTTPS
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Service ports (3000-3015)
for port in 3000 3002 3003 3004 3005 3006 3007 3008 3009 3010 3011 3012 3014 3015; do
  aws ec2 authorize-security-group-ingress \
    --group-id $EC2_SG \
    --protocol tcp \
    --port $port \
    --cidr 0.0.0.0/0
done

# RabbitMQ UI (restrict to your IP)
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG \
  --protocol tcp \
  --port 15672 \
  --cidr $(curl -s ifconfig.me)/32

# MinIO Console (restrict to your IP)
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG \
  --protocol tcp \
  --port 9001 \
  --cidr $(curl -s ifconfig.me)/32
```

**Allow RDS access from EC2**:
```bash
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp \
  --port 5432 \
  --source-group $EC2_SG
```

### 3. Launch EC2 Instance (3 min)

```bash
# Get latest Ubuntu 22.04 AMI
AMI_ID=$(aws ec2 describe-images \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)

# Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t3.small \
  --key-name YOUR_KEY_PAIR_NAME \
  --security-group-ids $EC2_SG \
  --subnet-id subnet-xxxxx \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=20,VolumeType=gp3}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=waba-dev-server},{Key=Environment,Value=Development}]' \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "Instance ID: $INSTANCE_ID"

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Allocate Elastic IP
ALLOCATION_ID=$(aws ec2 allocate-address \
  --domain vpc \
  --tag-specifications 'ResourceType=elastic-ip,Tags=[{Key=Name,Value=waba-dev-eip}]' \
  --query 'AllocationId' \
  --output text)

# Associate Elastic IP
aws ec2 associate-address \
  --instance-id $INSTANCE_ID \
  --allocation-id $ALLOCATION_ID

# Get Elastic IP
ELASTIC_IP=$(aws ec2 describe-addresses \
  --allocation-ids $ALLOCATION_ID \
  --query 'Addresses[0].PublicIp' \
  --output text)

echo "Elastic IP: $ELASTIC_IP"
echo "SSH command: ssh -i your-key.pem ubuntu@$ELASTIC_IP"
```

### 4. Setup EC2 (5 min)

```bash
# SSH to instance
ssh -i your-key.pem ubuntu@$ELASTIC_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install tools
sudo apt install -y postgresql-client git htop

# Verify installations
docker --version
docker-compose --version

# Logout and login again
exit
ssh -i your-key.pem ubuntu@$ELASTIC_IP
```

### 5. Deploy Application (10 min)

```bash
# Clone repository
git clone YOUR_REPO_URL waba-xypr
cd waba-xypr

# Create .env file for development
cat > .env << 'EOF'
# RDS Database (use your actual endpoint)
DB_HOST=waba-postgres-dev.xxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=YOUR_RDS_PASSWORD
DB_NAME=whatsapp_genesys

# Redis (local Docker)
REDIS_HOST=redis
REDIS_PORT=6379

# RabbitMQ (local Docker)
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=devpass123

# Meta WhatsApp (use test credentials)
META_APP_SECRET=your_test_app_secret
META_VERIFY_TOKEN=test_verify_token_123
META_ACCESS_TOKEN=your_test_access_token
META_APP_ID=your_app_id
META_CONFIG_ID=your_config_id
META_BUSINESS_ID=your_business_id

# Genesys Cloud (use test credentials)
GENESYS_CLIENT_ID=your_test_client_id
GENESYS_CLIENT_SECRET=your_test_client_secret
GENESYS_REGION=mypurecloud.com
GENESYS_BASE_URL=https://api.mypurecloud.com

# Auth
JWT_SECRET=dev_jwt_secret_min_32_chars_long_random

# MinIO
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=devminio123

# Environment
NODE_ENV=development
LOG_LEVEL=debug
PUBLIC_URL=http://ELASTIC_IP
WEBHOOK_BASE_URL=http://ELASTIC_IP

# Development Features
VITE_ENABLE_DEV_LOGIN=true
SKIP_AUTH=false
EOF

# Update with your actual values
nano .env

# Secure .env
chmod 600 .env

# Make scripts executable
chmod +x scripts/*.sh

# Deploy in development mode
./scripts/deploy-aws-dev.sh
```

### 6. Verify Deployment (5 min)

```bash
# Check all services
docker-compose -f docker-compose.aws-dev.yml ps

# Run health checks
./scripts/manage-aws.sh health

# View logs
docker-compose -f docker-compose.aws-dev.yml logs -f
```

## Development Features

### Enabled in Dev Mode
- ✅ Debug logging (`LOG_LEVEL=debug`)
- ✅ Dev login for Agent Portal (bypass OAuth)
- ✅ Lower memory limits (256MB Redis)
- ✅ Faster builds with caching
- ✅ Hot reload capabilities
- ✅ Detailed error messages
- ✅ RabbitMQ management UI accessible

### Differences from Production
| Feature | Development | Production |
|---------|-------------|------------|
| NODE_ENV | `development` | `production` |
| Logging | `debug` | `info` |
| RDS | db.t4g.micro | db.t3.small+ |
| EC2 | t3.small | t3.large+ |
| Multi-AZ | No | Yes |
| Backups | 1 day | 7 days |
| SSL/TLS | Optional | Required |

## Resource Monitoring

### Check Memory Usage
```bash
# System memory
free -h

# Docker container memory
docker stats

# If low on memory, add swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Check Disk Usage
```bash
# System disk
df -h

# Docker disk usage
docker system df

# Clean unused Docker resources
docker system prune -a --volumes
```

## Management Commands

```bash
# Start services
docker-compose -f docker-compose.aws-dev.yml up -d

# Stop services (keep volumes)
docker-compose -f docker-compose.aws-dev.yml down

# Stop and remove volumes (clean slate)
docker-compose -f docker-compose.aws-dev.yml down -v

# Restart specific service
docker-compose -f docker-compose.aws-dev.yml restart [service-name]

# View logs
docker-compose -f docker-compose.aws-dev.yml logs -f [service-name]

# Rebuild specific service
docker-compose -f docker-compose.aws-dev.yml build [service-name]
docker-compose -f docker-compose.aws-dev.yml up -d [service-name]
```

## Access Points

Replace `YOUR_ELASTIC_IP` with your actual Elastic IP:

| Service | URL | Credentials |
|---------|-----|-------------|
| API Gateway | `http://YOUR_ELASTIC_IP:3000` | - |
| Agent Portal | `http://YOUR_ELASTIC_IP:3014` | Dev login enabled |
| Admin Dashboard | `http://YOUR_ELASTIC_IP:3006` | - |
| RabbitMQ UI | `http://YOUR_ELASTIC_IP:15672` | admin / devpass123 |
| MinIO Console | `http://YOUR_ELASTIC_IP:9001` | admin / devminio123 |

## Testing Webhooks

### WhatsApp Webhook
```bash
# Configure in Meta Developer Console
Callback URL: http://YOUR_ELASTIC_IP:3009/webhook
Verify Token: test_verify_token_123

# Test webhook
curl -X POST http://YOUR_ELASTIC_IP:3009/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "message"}'
```

### Genesys Webhook
```bash
# Configure in Genesys Cloud
Webhook URL: http://YOUR_ELASTIC_IP:3011/webhook

# Test webhook
curl http://YOUR_ELASTIC_IP:3011/health
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker logs whatsapp-[service-name]

# Check resources
free -h
df -h

# Restart service
docker-compose -f docker-compose.aws-dev.yml restart [service-name]
```

### RDS Connection Failed
```bash
# Test connection
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Check security group
aws ec2 describe-security-groups --group-ids $RDS_SG
```

### Out of Memory
```bash
# Add swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### High Disk Usage
```bash
# Clean Docker
docker system prune -a --volumes -f

# Clean old logs
sudo journalctl --vacuum-time=2d

# Check what's using space
du -sh /var/lib/docker/*
```

## Scaling Up

When ready to move to production:

```bash
# 1. Stop dev stack
docker-compose -f docker-compose.aws-dev.yml down

# 2. Backup database
./scripts/manage-aws.sh db-backup

# 3. Upgrade RDS instance
aws rds modify-db-instance \
  --db-instance-identifier waba-postgres-dev \
  --db-instance-class db.t3.small \
  --apply-immediately

# 4. Upgrade EC2 instance
# Stop instance, change instance type to t3.large, start instance

# 5. Update .env (NODE_ENV=production)

# 6. Deploy production stack
./scripts/deploy-aws.sh
```

## Cost Optimization Tips

1. **Stop when not in use** (nights/weekends):
   ```bash
   # Stop EC2
   aws ec2 stop-instances --instance-ids $INSTANCE_ID

   # Stop RDS
   aws rds stop-db-instance --db-instance-identifier waba-postgres-dev
   ```

2. **Use Spot Instances** for even cheaper EC2 (~70% discount)

3. **Schedule startup/shutdown** with Lambda + EventBridge

4. **Delete unused volumes**:
   ```bash
   docker volume prune
   ```

5. **Use AWS Free Tier** (first 12 months):
   - 750 hours/month t2.micro EC2
   - 750 hours/month db.t2.micro RDS
   - 30GB EBS storage

## Next Steps

Once development is complete:
1. Review security groups (restrict ports)
2. Enable SSL/TLS (Let's Encrypt)
3. Set up monitoring (CloudWatch)
4. Configure automated backups
5. Scale to production specs
6. Implement CI/CD pipeline

## Support

- Full documentation: `docs/AWS_DEPLOYMENT_GUIDE.md`
- Production specs: `AWS_QUICK_START.md`
- Management: `./scripts/manage-aws.sh help`
