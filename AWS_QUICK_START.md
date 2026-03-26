# AWS Quick Start Guide

Deploy the WhatsApp-Genesys integration on AWS in **30 minutes**.

## Prerequisites Checklist

- [ ] AWS account with admin access
- [ ] Domain name (optional, can use Elastic IP)
- [ ] Meta WhatsApp Business credentials
- [ ] Genesys Cloud credentials
- [ ] SSH key pair

## Quick Deploy Steps

### 1. Create RDS Database (5 min)

```bash
aws rds create-db-instance \
  --db-instance-identifier waba-postgres \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password YOUR_STRONG_PASSWORD \
  --allocated-storage 20 \
  --db-name whatsapp_genesys \
  --backup-retention-period 7 \
  --publicly-accessible false
```

Wait for status "available" (~10 min). Note the endpoint.

### 2. Create Security Groups (2 min)

**RDS Security Group:**
- Inbound: PostgreSQL (5432) from EC2 security group

**EC2 Security Group:**
- Inbound: SSH (22) from your IP
- Inbound: HTTP (80), HTTPS (443) from anywhere
- Inbound: 3000, 3009, 3011, 3014 from anywhere

### 3. Launch EC2 Instance (3 min)

```bash
# Launch Ubuntu 22.04 LTS, t3.large, 30GB storage
# Allocate and associate Elastic IP
```

Note your **Elastic IP**.

### 4. Setup EC2 (5 min)

```bash
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install PostgreSQL client
sudo apt install -y postgresql-client git

# Logout and login
exit
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
```

### 5. Deploy Application (10 min)

```bash
# Clone repository
git clone YOUR_REPO_URL waba-xypr
cd waba-xypr

# Create .env file
nano .env
```

**Minimal .env configuration:**

```bash
# RDS Database
DB_HOST=waba-postgres.xxxxx.us-east-1.rds.amazonaws.com
DB_PASSWORD=YOUR_RDS_PASSWORD
DB_USER=postgres
DB_NAME=whatsapp_genesys
DB_PORT=5432

# RabbitMQ
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=your_rabbitmq_password

# Meta WhatsApp
META_APP_SECRET=your_meta_app_secret
META_VERIFY_TOKEN=your_verify_token
META_ACCESS_TOKEN=your_access_token
META_APP_ID=your_app_id

# Genesys
GENESYS_CLIENT_ID=your_client_id
GENESYS_CLIENT_SECRET=your_client_secret
GENESYS_REGION=mypurecloud.com
GENESYS_BASE_URL=https://api.mypurecloud.com

# Security
JWT_SECRET=your_jwt_secret_min_32_chars

# MinIO
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=your_minio_password

# Environment
NODE_ENV=production
PUBLIC_URL=http://YOUR_ELASTIC_IP
WEBHOOK_BASE_URL=http://YOUR_ELASTIC_IP
```

```bash
# Secure .env
chmod 600 .env

# Deploy
./scripts/deploy-aws.sh
```

### 6. Configure Webhooks (5 min)

**Meta WhatsApp:**
- URL: `http://YOUR_ELASTIC_IP:3009/webhook`
- Verify Token: (from META_VERIFY_TOKEN)
- Subscribe: messages, message_status

**Genesys Cloud:**
- URL: `http://YOUR_ELASTIC_IP:3011/webhook`
- Generate and save webhook secret

### 7. Verify Deployment

```bash
# Check health
./scripts/manage-aws.sh health

# View logs
./scripts/manage-aws.sh logs
```

## Access Points

| Service | URL |
|---------|-----|
| API Gateway | `http://YOUR_ELASTIC_IP:3000` |
| Agent Portal | `http://YOUR_ELASTIC_IP:3014` |
| Admin Dashboard | `http://YOUR_ELASTIC_IP:3006` |
| RabbitMQ UI | `http://YOUR_ELASTIC_IP:15672` |
| MinIO Console | `http://YOUR_ELASTIC_IP:9001` |

## Management Commands

```bash
# Start/Stop
./scripts/manage-aws.sh start
./scripts/manage-aws.sh stop
./scripts/manage-aws.sh restart

# Monitoring
./scripts/manage-aws.sh health
./scripts/manage-aws.sh monitor
./scripts/manage-aws.sh logs [service-name]

# Maintenance
./scripts/manage-aws.sh backup
./scripts/manage-aws.sh db-backup
./scripts/manage-aws.sh update

# Queue Management
./scripts/manage-aws.sh queue-stats
./scripts/manage-aws.sh redis-info
```

## Common Issues

### Can't connect to RDS
```bash
# Test connection
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Check security group allows EC2
```

### Service won't start
```bash
# Check logs
docker logs whatsapp-[service-name]

# Restart specific service
docker-compose -f docker-compose.aws.yml restart [service-name]
```

### Out of memory
```bash
# Check usage
free -h
docker stats

# Upgrade to t3.xlarge or add swap
```

## Cost Estimate

- **EC2 t3.large**: ~$60/month
- **RDS db.t3.small**: ~$50/month
- **Storage & Transfer**: ~$17/month
- **Total**: ~$127/month

## Production Checklist

- [ ] Enable SSL/TLS (Let's Encrypt or AWS ACM)
- [ ] Set up domain name (Route 53)
- [ ] Configure CloudWatch monitoring
- [ ] Enable RDS automated backups (already enabled)
- [ ] Set up backup automation (included in scripts)
- [ ] Configure log rotation
- [ ] Set up alerts (SNS)
- [ ] Review security groups
- [ ] Enable AWS WAF (optional)
- [ ] Set up CI/CD pipeline

## Next Steps

1. **SSL Setup**: See `docs/AWS_DEPLOYMENT_GUIDE.md` - Section 6
2. **Monitoring**: Configure CloudWatch dashboards
3. **Backups**: Verify automated backups are running
4. **Scaling**: Monitor and adjust instance sizes as needed

## Support

- Full documentation: `docs/AWS_DEPLOYMENT_GUIDE.md`
- Architecture: `CLAUDE.md`
- Troubleshooting: Check service logs and RabbitMQ queues
