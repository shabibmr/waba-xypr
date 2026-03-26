# Deploy to Your EC2 Server

Quick deployment guide for your specific server.

## Server Details

```
Host: ec2-16-112-132-107.ap-south-2.compute.amazonaws.com
IP:   16.112.132.107
User: ec2-user
Region: ap-south-2 (Hyderabad, India)
OS: Amazon Linux
```

## Prerequisites

- [x] EC2 instance running (16.112.132.107)
- [ ] SSH key pair for access
- [ ] RDS PostgreSQL instance in ap-south-2 region
- [ ] Meta WhatsApp Business credentials
- [ ] Genesys Cloud credentials

## Quick Deploy (20 minutes)

### Step 1: Connect to Server (1 min)

```bash
# From your local machine
ssh ec2-user@ec2-16-112-132-107.ap-south-2.compute.amazonaws.com

# Or use the hostname
ssh ec2-user@16.112.132.107
```

### Step 2: Run Setup Script (5 min)

```bash
# Download and run setup script
curl -o setup.sh https://raw.githubusercontent.com/YOUR_REPO/main/scripts/setup-amazon-linux.sh
chmod +x setup.sh
./setup.sh

# Or if you already have the repo
cd ~/waba-xypr
chmod +x scripts/setup-amazon-linux.sh
./scripts/setup-amazon-linux.sh
```

**What it does:**
- ✅ Updates system packages
- ✅ Installs Docker & Docker Compose
- ✅ Installs PostgreSQL client
- ✅ Installs Git and tools
- ✅ Configures firewall
- ✅ Optimizes system settings

**After setup, logout and login again:**
```bash
exit
ssh ec2-user@16.112.132.107
```

### Step 3: Clone Repository (2 min)

```bash
cd ~
git clone YOUR_REPOSITORY_URL waba-xypr
cd waba-xypr
```

### Step 4: Configure Environment (5 min)

```bash
# Copy server-specific template
cp .env.aws-server .env

# Edit configuration
nano .env
```

**Required updates in .env:**

```bash
# 1. RDS Database (REQUIRED)
DB_HOST=waba-postgres-dev.xxxxx.ap-south-2.rds.amazonaws.com  # Your RDS endpoint
DB_PASSWORD=YOUR_ACTUAL_RDS_PASSWORD

# 2. Meta WhatsApp (REQUIRED)
META_APP_SECRET=your_actual_app_secret
META_VERIFY_TOKEN=your_verify_token
META_ACCESS_TOKEN=your_system_user_token
META_APP_ID=123456789
META_CONFIG_ID=your_config_id
META_BUSINESS_ID=your_business_id

# 3. Genesys Cloud (REQUIRED)
GENESYS_CLIENT_ID=your_client_id
GENESYS_CLIENT_SECRET=your_client_secret

# 4. Security (REQUIRED - Generate new secrets!)
JWT_SECRET=$(openssl rand -base64 64)
RABBITMQ_PASSWORD=$(openssl rand -base64 16)
MINIO_ROOT_PASSWORD=$(openssl rand -base64 16)

# 5. Already configured (verify only)
PUBLIC_URL=http://16.112.132.107
WHATSAPP_WEBHOOK_URL=http://16.112.132.107:3009/webhook
GENESYS_WEBHOOK_URL=http://16.112.132.107:3011/webhook
```

**Generate secure secrets:**
```bash
# Generate JWT secret
openssl rand -base64 64

# Generate RabbitMQ password
openssl rand -base64 16

# Generate MinIO password
openssl rand -base64 16
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

### Step 5: Deploy Application (7 min)

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Deploy in development mode
./scripts/deploy-aws-dev.sh
```

**Expected output:**
```
✓ RDS connection successful
✓ Database schema initialized
✓ Docker images built
✓ Infrastructure services started
✓ RabbitMQ queues initialized
✓ MinIO buckets initialized
✓ All services started
✓ Development Deployment Successful!
```

### Step 6: Verify Deployment (5 min)

```bash
# Check all services
docker-compose -f docker-compose.aws-dev.yml ps

# Run health checks
./scripts/manage-aws.sh health

# View logs
docker-compose -f docker-compose.aws-dev.yml logs -f
```

## Access Your Services

Once deployed, access these URLs from your browser:

| Service | URL | Credentials |
|---------|-----|-------------|
| **API Gateway** | http://16.112.132.107:3000 | - |
| **Agent Portal** | http://16.112.132.107:3014 | Dev login enabled |
| **Admin Dashboard** | http://16.112.132.107:3006 | - |
| **RabbitMQ UI** | http://16.112.132.107:15672 | admin / (from .env) |
| **MinIO Console** | http://16.112.132.107:9001 | admin / (from .env) |

## Configure Webhooks

### Meta WhatsApp Business

1. Go to https://developers.facebook.com
2. Select your app
3. Navigate to **WhatsApp** → **Configuration**
4. Set **Callback URL**: `http://16.112.132.107:3009/webhook`
5. Set **Verify Token**: (value from `META_VERIFY_TOKEN` in .env)
6. Click **Verify and Save**
7. Subscribe to fields: `messages`, `message_status`

### Genesys Cloud

1. Log into Genesys Cloud Admin
2. Navigate to **Admin** → **Integrations** → **Open Messaging**
3. Create new integration or edit existing
4. Set **Webhook URL**: `http://16.112.132.107:3011/webhook`
5. Generate webhook secret and save it
6. Add webhook secret to tenant configuration via Tenant Service API

## Test the Deployment

### Test API Gateway
```bash
curl http://16.112.132.107:3000/health
# Expected: {"status":"healthy"}
```

### Test WhatsApp Webhook
```bash
# This should return the verify token
curl "http://16.112.132.107:3009/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test"
```

### Test Services
```bash
# Check all services are healthy
./scripts/manage-aws.sh health

# Monitor continuously
./scripts/manage-aws.sh monitor
```

## AWS Security Group Configuration

Make sure your EC2 security group allows these inbound rules:

```bash
# SSH (from your IP only)
Type: SSH
Protocol: TCP
Port: 22
Source: YOUR_IP/32

# HTTP/HTTPS
Type: HTTP
Port: 80
Source: 0.0.0.0/0

Type: HTTPS
Port: 443
Source: 0.0.0.0/0

# API Gateway
Type: Custom TCP
Port: 3000
Source: 0.0.0.0/0

# WhatsApp Webhook (Meta IP ranges)
Type: Custom TCP
Port: 3009
Source: 31.13.24.0/21, 31.13.64.0/19, 66.220.144.0/20

# Genesys Webhook
Type: Custom TCP
Port: 3011
Source: 0.0.0.0/0 (or Genesys IP ranges if known)

# Agent Portal
Type: Custom TCP
Port: 3014
Source: 0.0.0.0/0

# Admin Dashboard
Type: Custom TCP
Port: 3006
Source: 0.0.0.0/0

# RabbitMQ UI (restrict to your IP)
Type: Custom TCP
Port: 15672
Source: YOUR_IP/32

# MinIO Console (restrict to your IP)
Type: Custom TCP
Port: 9001
Source: YOUR_IP/32
```

## RDS Configuration for ap-south-2

Create RDS instance in the same region:

```bash
aws rds create-db-instance \
  --db-instance-identifier waba-postgres-dev \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password YOUR_STRONG_PASSWORD \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxx \
  --db-name whatsapp_genesys \
  --availability-zone ap-south-2a \
  --region ap-south-2 \
  --no-multi-az \
  --backup-retention-period 1 \
  --publicly-accessible false
```

**Get RDS endpoint:**
```bash
aws rds describe-db-instances \
  --db-instance-identifier waba-postgres-dev \
  --region ap-south-2 \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

## Common Commands

```bash
# View all logs
docker-compose -f docker-compose.aws-dev.yml logs -f

# View specific service logs
docker-compose -f docker-compose.aws-dev.yml logs -f whatsapp-webhook-service

# Restart all services
docker-compose -f docker-compose.aws-dev.yml restart

# Restart specific service
docker-compose -f docker-compose.aws-dev.yml restart auth-service

# Stop all services
docker-compose -f docker-compose.aws-dev.yml down

# Start all services
docker-compose -f docker-compose.aws-dev.yml up -d

# Check service status
docker-compose -f docker-compose.aws-dev.yml ps

# Health check
./scripts/manage-aws.sh health

# Monitor continuously
./scripts/manage-aws.sh monitor

# Backup
./scripts/manage-aws.sh backup
```

## Troubleshooting

### Can't connect to server
```bash
# Check if instance is running
aws ec2 describe-instances \
  --filters "Name=ip-address,Values=16.112.132.107" \
  --region ap-south-2

# Check security group allows your IP
aws ec2 describe-security-groups --region ap-south-2
```

### RDS connection failed
```bash
# Test from EC2
PGPASSWORD=your_password psql -h your-rds-endpoint -U postgres -d whatsapp_genesys

# Check RDS security group allows EC2
aws rds describe-db-instances --region ap-south-2
```

### Service won't start
```bash
# Check logs
docker logs whatsapp-[service-name]

# Check memory
free -h

# Check disk space
df -h

# Add swap if needed
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Port already in use
```bash
# Find what's using the port
sudo netstat -tulpn | grep :3000

# Kill the process
sudo kill -9 PID
```

## Region-Specific Notes (ap-south-2)

**Hyderabad Region (ap-south-2):**
- Launched: 2022
- Timezone: Asia/Kolkata (IST, UTC+5:30)
- Availability Zones: 3 (ap-south-2a, ap-south-2b, ap-south-2c)

**Service Availability:**
- ✅ EC2
- ✅ RDS
- ✅ S3
- ✅ CloudWatch
- ⚠️ Some AWS services may not be available in this newer region

**Cost Considerations:**
- Slightly lower than Mumbai (ap-south-1)
- Data transfer within same AZ is free
- Inter-AZ transfer costs apply

## Monitoring

### CloudWatch Logs (Optional)
```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
sudo rpm -U ./amazon-cloudwatch-agent.rpm
```

### System Monitoring
```bash
# CPU and Memory
htop

# Disk usage
df -h

# Docker stats
docker stats

# Network connections
netstat -tulpn
```

## Backup Strategy

```bash
# Automated daily backup (add to crontab)
crontab -e

# Add this line (backup at 2 AM IST daily)
0 2 * * * /home/ec2-user/waba-xypr/scripts/manage-aws.sh backup
0 2 * * * /home/ec2-user/waba-xypr/scripts/manage-aws.sh db-backup
```

## Next Steps

1. ✅ Deploy application
2. ⬜ Configure webhooks in Meta & Genesys
3. ⬜ Test message flow end-to-end
4. ⬜ Set up monitoring and alerts
5. ⬜ Configure SSL/TLS (Let's Encrypt)
6. ⬜ Set up automated backups
7. ⬜ Document custom configurations
8. ⬜ Create runbook for common issues

## Support

- **Documentation**: Check `AWS_DEV_DEPLOYMENT.md` for detailed guide
- **Logs**: `docker-compose -f docker-compose.aws-dev.yml logs -f`
- **Health**: `./scripts/manage-aws.sh health`
- **Monitor**: `./scripts/manage-aws.sh monitor`

## Quick Reference

**SSH Connection:**
```bash
ssh ec2-user@16.112.132.107
```

**Application Directory:**
```bash
cd ~/waba-xypr
```

**Deploy:**
```bash
./scripts/deploy-aws-dev.sh
```

**Check Status:**
```bash
./scripts/manage-aws.sh health
```

**View Logs:**
```bash
docker-compose -f docker-compose.aws-dev.yml logs -f
```

---

**Ready to deploy! Follow the steps above to get your WABA integration running on your EC2 server.** 🚀
