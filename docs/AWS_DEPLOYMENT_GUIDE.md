# AWS Deployment Guide - WhatsApp-Genesys Integration

Complete guide for deploying the WABA integration platform on AWS using EC2 + RDS.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           AWS Cloud                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  EC2 Instance (t3.large)                                  │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ Docker Compose                                        │ │  │
│  │  │                                                       │ │  │
│  │  │  • API Gateway (3000)                                 │ │  │
│  │  │  • 14 Microservices (3002-3015)                      │ │  │
│  │  │  • Redis (6379)                                       │ │  │
│  │  │  • RabbitMQ (5672, 15672)                            │ │  │
│  │  │  • MinIO (9000, 9001)                                │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            │ PostgreSQL Connection               │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  RDS PostgreSQL (db.t3.small)                            │  │
│  │  • whatsapp_genesys database                             │  │
│  │  • Multi-AZ for HA                                       │  │
│  │  • Automated backups                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         ▲                                    ▲
         │                                    │
         │ Webhooks                           │ Webhooks
         │                                    │
┌─────────────────┐                  ┌─────────────────┐
│ Meta WhatsApp   │                  │ Genesys Cloud   │
│ Business API    │                  │ Platform        │
└─────────────────┘                  └─────────────────┘
```

## Prerequisites

- AWS Account with appropriate permissions
- Domain name (optional but recommended)
- Meta WhatsApp Business Account
- Genesys Cloud Organization
- SSH key pair for EC2 access

## Cost Estimate (Monthly)

| Service | Type | Estimated Cost |
|---------|------|----------------|
| EC2 | t3.large (2 vCPU, 8GB) | ~$60/month |
| RDS | db.t3.small (Multi-AZ) | ~$50/month |
| EBS Storage | 30GB gp3 | ~$3/month |
| RDS Storage | 20GB | ~$5/month |
| Data Transfer | 100GB/month | ~$9/month |
| Elastic IP | 1 static IP | Free (if attached) |
| **Total** | | **~$127/month** |

## Step 1: Create RDS PostgreSQL Database

### Via AWS Console

1. Navigate to **RDS** > **Databases** > **Create database**
2. Configuration:
   - **Engine**: PostgreSQL 15.4
   - **Templates**: Production (or Dev/Test for staging)
   - **DB instance identifier**: `waba-postgres`
   - **Master username**: `postgres`
   - **Master password**: Generate strong password
   - **DB instance class**: `db.t3.small` (or `db.t3.micro` for dev)
   - **Storage**: 20GB, enable autoscaling to 100GB
   - **Multi-AZ**: Yes (for production)
   - **VPC**: Default or custom VPC
   - **Public access**: No
   - **Security group**: Create new `waba-rds-sg`
   - **Initial database name**: `whatsapp_genesys`
   - **Backup retention**: 7 days
   - **Automated backups**: Enabled
3. Click **Create database**
4. Wait 5-10 minutes for database to be available
5. Note the **Endpoint** (e.g., `waba-postgres.xxxxx.us-east-1.rds.amazonaws.com`)

### Via AWS CLI

```bash
aws rds create-db-instance \
  --db-instance-identifier waba-postgres \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password YOUR_STRONG_PASSWORD \
  --allocated-storage 20 \
  --max-allocated-storage 100 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxx \
  --db-name whatsapp_genesys \
  --backup-retention-period 7 \
  --multi-az \
  --publicly-accessible false \
  --enable-cloudwatch-logs-exports '["postgresql"]' \
  --tags Key=Project,Value=WABA Key=Environment,Value=Production
```

## Step 2: Create Security Groups

### RDS Security Group (`waba-rds-sg`)

```bash
# Create security group
aws ec2 create-security-group \
  --group-name waba-rds-sg \
  --description "Security group for WABA RDS PostgreSQL" \
  --vpc-id vpc-xxxxx

# Allow PostgreSQL from EC2 security group (after EC2 SG is created)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx-rds \
  --protocol tcp \
  --port 5432 \
  --source-group sg-xxxxx-ec2
```

### EC2 Security Group (`waba-ec2-sg`)

```bash
# Create security group
aws ec2 create-security-group \
  --group-name waba-ec2-sg \
  --description "Security group for WABA EC2 instance" \
  --vpc-id vpc-xxxxx

SG_ID=$(aws ec2 describe-security-groups --filters Name=group-name,Values=waba-ec2-sg --query 'SecurityGroups[0].GroupId' --output text)

# SSH access (restrict to your IP)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr YOUR_IP/32

# HTTP/HTTPS
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# API Gateway
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 3000 \
  --cidr 0.0.0.0/0

# WhatsApp Webhook (Meta IP ranges)
for cidr in 31.13.24.0/21 31.13.64.0/19 66.220.144.0/20 69.63.176.0/20 69.171.224.0/19 74.119.76.0/22 173.252.64.0/19; do
  aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 3009 \
    --cidr $cidr
done

# Genesys Webhook (port 3011)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 3011 \
  --cidr 0.0.0.0/0

# Agent Portal
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 3014 \
  --cidr 0.0.0.0/0

# Admin Dashboard
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 3006 \
  --cidr 0.0.0.0/0

# RabbitMQ Management UI
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 15672 \
  --cidr YOUR_IP/32

# MinIO Console
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 9001 \
  --cidr YOUR_IP/32
```

## Step 3: Launch EC2 Instance

### Via AWS Console

1. Navigate to **EC2** > **Instances** > **Launch Instance**
2. Configuration:
   - **Name**: `waba-application-server`
   - **AMI**: Ubuntu Server 22.04 LTS
   - **Instance type**: `t3.large` (2 vCPU, 8GB RAM)
   - **Key pair**: Select existing or create new
   - **Network settings**:
     - VPC: Same as RDS
     - Subnet: Public subnet
     - Auto-assign public IP: Enable
     - Security group: Select `waba-ec2-sg`
   - **Storage**: 30GB gp3 EBS
3. Click **Launch instance**
4. Allocate and associate **Elastic IP** to instance

### Via AWS CLI

```bash
# Launch instance
aws ec2 run-instances \
  --image-id ami-0c7217cdde317cfec \
  --instance-type t3.large \
  --key-name YOUR_KEY_PAIR \
  --security-group-ids sg-xxxxx-ec2 \
  --subnet-id subnet-xxxxx \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=30,VolumeType=gp3}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=waba-application-server},{Key=Project,Value=WABA}]'

# Allocate Elastic IP
aws ec2 allocate-address --domain vpc

# Associate Elastic IP with instance
aws ec2 associate-address \
  --instance-id i-xxxxx \
  --allocation-id eipalloc-xxxxx
```

## Step 4: Initial EC2 Setup

```bash
# Connect to EC2
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install PostgreSQL client (for DB management)
sudo apt install -y postgresql-client

# Install git
sudo apt install -y git

# Logout and login to apply group changes
exit
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
```

## Step 5: Deploy Application

```bash
# Clone repository
cd /home/ubuntu
git clone YOUR_REPO_URL waba-xypr
cd waba-xypr

# Create .env file
cat > .env << 'EOF'
# Database - RDS Connection
DB_HOST=waba-postgres.xxxxx.us-east-1.rds.amazonaws.com
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
RABBITMQ_PASSWORD=$(openssl rand -base64 32)

# Meta WhatsApp
META_APP_SECRET=your_app_secret
META_VERIFY_TOKEN=your_verify_token
META_ACCESS_TOKEN=your_access_token
META_APP_ID=your_app_id
META_CONFIG_ID=your_config_id
META_BUSINESS_ID=your_business_id

# Genesys Cloud
GENESYS_CLIENT_ID=your_client_id
GENESYS_CLIENT_SECRET=your_client_secret
GENESYS_REGION=mypurecloud.com
GENESYS_BASE_URL=https://api.mypurecloud.com

# Auth
JWT_SECRET=$(openssl rand -base64 64)

# Public URLs (replace with your domain or Elastic IP)
PUBLIC_URL=http://YOUR_ELASTIC_IP
WEBHOOK_BASE_URL=http://YOUR_ELASTIC_IP

# MinIO
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=$(openssl rand -base64 32)
MINIO_ENDPOINT=minio:9000

# Node Environment
NODE_ENV=production
EOF

# Secure .env file
chmod 600 .env

# Make deployment script executable
chmod +x scripts/deploy-aws.sh

# Run deployment
./scripts/deploy-aws.sh
```

## Step 6: Configure SSL/TLS (Recommended)

### Option A: Using Nginx Reverse Proxy with Let's Encrypt

```bash
# Install Nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Configure Nginx
sudo nano /etc/nginx/sites-available/waba

# Add configuration (see below)
sudo ln -s /etc/nginx/sites-available/waba /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

**Nginx Configuration (`/etc/nginx/sites-available/waba`):**

```nginx
upstream api_gateway {
    server localhost:3000;
}

upstream agent_portal {
    server localhost:3014;
}

upstream admin_dashboard {
    server localhost:3006;
}

# API Gateway
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://api_gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Agent Portal
server {
    listen 80;
    server_name portal.your-domain.com;

    location / {
        proxy_pass http://agent_portal;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Admin Dashboard
server {
    listen 80;
    server_name admin.your-domain.com;

    location / {
        proxy_pass http://admin_dashboard;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}

# WhatsApp Webhook (direct port exposure, no proxy needed)
# Configure in Meta: https://api.your-domain.com:3009/webhook

# Genesys Webhook (direct port exposure)
# Configure in Genesys: https://api.your-domain.com:3011/webhook
```

### Option B: AWS Application Load Balancer

Create ALB with target groups for each service, attach ACM certificate.

## Step 7: Configure Webhooks

### Meta WhatsApp Business

1. Go to [Meta for Developers](https://developers.facebook.com)
2. Navigate to your app > **WhatsApp** > **Configuration**
3. Set callback URL: `https://YOUR_DOMAIN:3009/webhook` or `http://YOUR_ELASTIC_IP:3009/webhook`
4. Set verify token: (value from `META_VERIFY_TOKEN` in .env)
5. Subscribe to webhook fields: `messages`, `message_status`

### Genesys Cloud

1. Log in to Genesys Cloud Admin
2. Navigate to **Admin** > **Integrations** > **Open Messaging**
3. Create integration or edit existing
4. Set webhook URL: `https://YOUR_DOMAIN:3011/webhook` or `http://YOUR_ELASTIC_IP:3011/webhook`
5. Generate webhook secret and add to tenant configuration

## Step 8: Monitoring & Maintenance

### CloudWatch Integration

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb

# Configure agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

### Log Rotation

```bash
# Configure Docker log rotation
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
sudo systemctl restart docker
```

### Automated Backups

```bash
# Create backup script
sudo nano /usr/local/bin/backup-docker-volumes.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup Redis data
docker run --rm \
  -v whatsapp-redis-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/redis-$DATE.tar.gz -C /data .

# Backup RabbitMQ data
docker run --rm \
  -v whatsapp-rabbitmq-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/rabbitmq-$DATE.tar.gz -C /data .

# Backup MinIO data
docker run --rm \
  -v whatsapp-minio-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/minio-$DATE.tar.gz -C /data .

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/redis-$DATE.tar.gz s3://your-backup-bucket/waba/
aws s3 cp $BACKUP_DIR/rabbitmq-$DATE.tar.gz s3://your-backup-bucket/waba/
aws s3 cp $BACKUP_DIR/minio-$DATE.tar.gz s3://your-backup-bucket/waba/

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-docker-volumes.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-docker-volumes.sh") | crontab -
```

### Health Monitoring Script

```bash
# Create monitoring script
nano /home/ubuntu/monitor.sh
```

```bash
#!/bin/bash

SERVICES=(
    "api-gateway:3000"
    "tenant-service:3007"
    "auth-service:3004"
    "state-manager:3005"
)

for service in "${SERVICES[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if curl -sf http://localhost:$port/health > /dev/null 2>&1; then
        echo "✓ $name is healthy"
    else
        echo "✗ $name is DOWN - restarting..."
        docker-compose -f /home/ubuntu/waba-xypr/docker-compose.aws.yml restart $name
    fi
done
```

```bash
chmod +x /home/ubuntu/monitor.sh

# Add to crontab (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/ubuntu/monitor.sh") | crontab -
```

## Step 9: Verify Deployment

```bash
# Check all services
docker-compose -f docker-compose.aws.yml ps

# View logs
docker-compose -f docker-compose.aws.yml logs -f

# Test API Gateway
curl http://localhost:3000/health

# Check RabbitMQ queues
docker exec whatsapp-rabbitmq rabbitmqctl list_queues

# Check Redis
docker exec whatsapp-redis redis-cli ping
```

## Troubleshooting

### RDS Connection Issues

```bash
# Test connectivity
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT version();"

# Check security group rules
aws ec2 describe-security-groups --group-ids sg-xxxxx
```

### Service Not Starting

```bash
# Check logs
docker-compose -f docker-compose.aws.yml logs [service-name]

# Check container status
docker-compose -f docker-compose.aws.yml ps

# Restart specific service
docker-compose -f docker-compose.aws.yml restart [service-name]
```

### Port Conflicts

```bash
# Check what's using a port
sudo lsof -i :3000

# Kill process
sudo kill -9 PID
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats

# Increase swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Scaling Considerations

### Vertical Scaling (Single Instance)

- Upgrade to `t3.xlarge` (4 vCPU, 16GB) or `t3.2xlarge` (8 vCPU, 32GB)
- Increase RDS to `db.t3.medium` or `db.r6g.large`

### Horizontal Scaling (Multi-Instance)

For high-traffic production:
1. Use AWS ECS/EKS for container orchestration
2. Deploy each microservice as independent service
3. Use AWS ElastiCache for Redis (managed)
4. Use Amazon MQ for RabbitMQ (managed)
5. Use AWS Application Load Balancer for traffic distribution
6. Use Amazon S3 instead of MinIO for media storage

## Cost Optimization

1. **Use Reserved Instances**: Save ~40% on EC2/RDS with 1-year commitment
2. **Right-size instances**: Start small, scale based on monitoring
3. **Enable RDS storage autoscaling**: Pay only for what you use
4. **Use S3 lifecycle policies**: Move old media to Glacier
5. **Schedule non-prod environments**: Stop dev/test instances after hours
6. **Enable AWS Cost Explorer**: Track and optimize spending

## Security Best Practices

1. **Secrets Management**: Use AWS Secrets Manager for sensitive credentials
2. **IAM Roles**: Attach IAM role to EC2 for AWS service access
3. **VPC**: Use private subnets for RDS, NAT gateway for egress
4. **Encryption**: Enable encryption at rest for RDS and EBS
5. **SSL/TLS**: Use ACM certificates for HTTPS
6. **Monitoring**: Enable CloudWatch alarms for anomalies
7. **Updates**: Regular security patches via `apt update && apt upgrade`

## Next Steps

1. Set up CI/CD pipeline (GitHub Actions → EC2)
2. Configure CloudWatch dashboards
3. Set up AWS Backup for RDS
4. Implement AWS WAF for API protection
5. Configure AWS Route 53 for DNS management
6. Set up SNS alerts for critical events

## Support

For issues or questions:
- Check service logs: `docker-compose -f docker-compose.aws.yml logs -f [service]`
- Review RabbitMQ queues: http://YOUR_IP:15672
- Check RDS performance: AWS Console > RDS > Performance Insights
- Contact support: your-support-email@example.com
