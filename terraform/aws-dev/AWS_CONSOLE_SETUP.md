# AWS Console Setup - WABA Dev (Free Tier)

**Cost: $0/month** (within free tier, ≤12 hrs/day usage)

- 2x EC2 t2.micro (1GB each)
- 1x RDS db.t3.micro
- No Elastic IP (use auto-assigned public IP)

---

## 1. Create Security Group

**Console → VPC → Security Groups → Create**

- Name: `Eko-dev-sg`
- VPC: default VPC

**Inbound rules:**

| Type | Port | Source |
|------|------|--------|
| SSH | 22 | My IP |
| Custom TCP | 3000-3015 | 0.0.0.0/0 |
| Custom TCP | 5672 | (this security group) |
| Custom TCP | 6379 | (this security group) |
| Custom TCP | 9000 | (this security group) |
| Custom TCP | 15672 | My IP |
| Custom TCP | 9001 | My IP |

> Ports 5672/6379/9000 allow inter-instance communication (RabbitMQ/Redis/MinIO).

**Outbound:** All traffic → 0.0.0.0/0

---

## 2. Create RDS PostgreSQL (start first — takes ~10 min)

**Console → RDS → Create database**

- Engine: **PostgreSQL 15**
- Template: **Free tier**
- DB instance identifier: `Eko-postgres-dev`
- Master username: `postgres`
- Master password: secure_password
- Instance: **db.t3.micro**
- Storage: **20 GB gp3**
- Storage autoscaling: **OFF**
- Multi-AZ: **No**
- Public access: **No**
- DB name: `whatsapp_genesys`
- Backup retention: **0 days**
- Encryption: **OFF**
- Performance Insights: **OFF**
- Monitoring: **OFF**
- Uncheck "Enable deletion protection"
- Click **Create database**

---

## 3. Allow EC2 → RDS

**Console → VPC → Security Groups → click the RDS security group → Edit inbound rules → Add rule**

- Type: **PostgreSQL (5432)**
- Source: select `Eko-dev-sg`

---

## 4. Launch EC2 Instance 1 (Infrastructure)

**Console → EC2 → Launch Instance**

- Name: `Eko-infra`
- AMI: **Ubuntu 22.04 LTS**
- Type: **t2.micro**
- Key pair: create new or select existing
- Security group: select `Eko-dev-sg`
- Storage: **15 GB gp3**
- Launch

**Runs:** Redis, RabbitMQ, MinIO

---

## 5. Launch EC2 Instance 2 (App Services)

**Console → EC2 → Launch Instance**

- Name: `Eko-app`
- AMI: **Ubuntu 22.04 LTS**
- Type: **t2.micro**
- Key pair: same as Instance 1
- Security group: select `Eko-dev-sg`
- Storage: **15 GB gp3**
- Launch

**Runs:** All 11 Node.js services

> Note the **Public IP** of both instances (changes on restart).

---

## 6. Setup Instance 1 (Eko-infra)

```bash
ssh -i your-key.pem ubuntu@INFRA_PUBLIC_IP

# Docker + swap (one block)
curl -fsSL https://get.docker.com | sudo sh && \
sudo usermod -aG docker ubuntu && \
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && \
sudo chmod +x /usr/local/bin/docker-compose && \
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && \
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

exit
```

Re-login and create the infra compose file:

```bash
ssh -i your-key.pem ubuntu@INFRA_PUBLIC_IP

mkdir -p ~/waba && cd ~/waba

cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    mem_limit: 256m
    restart: unless-stopped

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: devpass123
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    mem_limit: 300m
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: devminio123
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    mem_limit: 256m
    restart: unless-stopped

volumes:
  redis_data:
  rabbitmq_data:
  minio_data:
EOF

docker-compose up -d
docker-compose ps
```

---

## 7. Setup Instance 2 (Eko-app)

```bash
ssh -i your-key.pem ubuntu@APP_PUBLIC_IP

# Docker + swap + tools (one block)
curl -fsSL https://get.docker.com | sudo sh && \
sudo usermod -aG docker ubuntu && \
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && \
sudo chmod +x /usr/local/bin/docker-compose && \
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && \
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab && \
sudo apt update && sudo apt install -y postgresql-client git

exit
```

Re-login and deploy the app:

```bash
ssh -i your-key.pem ubuntu@APP_PUBLIC_IP

git clone YOUR_REPO_URL waba-xypr && cd waba-xypr

cat > .env << EOF
DB_HOST=YOUR_RDS_ENDPOINT
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=YOUR_RDS_PASSWORD
DB_NAME=whatsapp_genesys
REDIS_HOST=INFRA_PUBLIC_IP
REDIS_PORT=6379
RABBITMQ_HOST=INFRA_PUBLIC_IP
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=devpass123
MINIO_ENDPOINT=INFRA_PUBLIC_IP
MINIO_PORT=9000
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=devminio123
JWT_SECRET=change_me_to_random_32_chars
NODE_ENV=development
LOG_LEVEL=debug
PUBLIC_URL=http://APP_PUBLIC_IP
WEBHOOK_BASE_URL=http://APP_PUBLIC_IP
VITE_ENABLE_DEV_LOGIN=true
EOF

chmod 600 .env
./manage.sh start
```

> Replace `INFRA_PUBLIC_IP`, `APP_PUBLIC_IP`, `YOUR_RDS_ENDPOINT`, `YOUR_RDS_PASSWORD` with actual values.

---

## 8. Verify

```bash
# On Eko-infra
docker-compose ps

# On Eko-app
./manage.sh status
```

**Access points** (using Eko-app public IP):
- Agent Portal: `http://APP_PUBLIC_IP:3014`
- API Gateway: `http://APP_PUBLIC_IP:3000`

**Access points** (using Eko-infra public IP):
- RabbitMQ: `http://INFRA_PUBLIC_IP:15672` (admin/devpass123)
- MinIO: `http://INFRA_PUBLIC_IP:9001` (admin/devminio123)

---

## Start / Stop (save free tier hours)

```bash
# Stop when done testing (AWS Console → EC2 → select both → Instance state → Stop)
# Or via CLI:
aws ec2 stop-instances --instance-ids i-xxxxx i-yyyyy
aws rds stop-db-instance --db-instance-identifier Eko-postgres-dev

# Start again:
aws ec2 start-instances --instance-ids i-xxxxx i-yyyyy
aws rds start-db-instance --db-instance-identifier Eko-postgres-dev
```

> Public IPs change on restart. Update .env on Eko-app with new INFRA_PUBLIC_IP if it changes.

---

## Free Tier Limits

| Resource | Free Tier Limit | Your Usage |
|----------|----------------|------------|
| EC2 t2.micro | 750 hrs/month | 2 instances ≤12 hrs/day = 720 hrs ✅ |
| RDS db.t3.micro | 750 hrs/month | ≤12 hrs/day = 360 hrs ✅ |
| EBS | 30 GB | 2×15 + 20(RDS) = 50 GB ⚠️ |

⚠️ **EBS storage**: Free tier covers 30 GB. You're using ~50 GB total. Either reduce EC2 storage to 8 GB each (8+8+20=36 GB, close to limit) or accept ~$2/month for extra storage.
