# Xypr App - Quick Start Guide

## Overview

This guide walks you through setting up the complete Xypr App platform including the new Agent Portal for the first time.

## Prerequisites

### Required Software

- ✅ Docker Desktop (20.10+)
- ✅ Docker Compose (2.0+)
- ✅ Node.js 18+ (for local development)
- ✅ PostgreSQL client tools (`psql`)
- ✅ Git

### Required Accounts

- ✅ **Meta for Developers**: https://developers.facebook.com
  - Created Meta App with WhatsApp Business API enabled
  - WhatsApp Embedded Signup configured
- ✅ **Genesys Cloud**: https://apps.mypurecloud.com
  - OAuth Client created
  - Open Messaging integration configured

## Step 1: Clone Repository

```bash
git clone <repository-url>
cd claude
```

## Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your values
nano .env
```

### Required Environment Variables

```bash
# Database
DB_PASSWORD=secure_password_here

# RabbitMQ
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=admin123

# Meta WhatsApp
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_CONFIG_ID=your_embedded_signup_config_id
META_VERIFY_TOKEN=your_custom_verify_token
META_ACCESS_TOKEN=your_meta_access_token

# Genesys Cloud
GENESYS_CLIENT_ID=your_genesys_client_id
GENESYS_CLIENT_SECRET=your_genesys_client_secret
GENESYS_REGION=mypurecloud.com
GENESYS_REDIRECT_URI=http://localhost:3000/auth/callback
GENESYS_AGENT_REDIRECT_URI=http://localhost:3000/api/agents/auth/callback

# Agent Portal
JWT_SECRET=generate_random_secret_here
AGENT_PORTAL_URL=http://localhost:3014
AGENT_PORTAL_SERVICE_URL=http://localhost:3015
```

### Generate JWT Secret

```bash
# Generate secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env file
JWT_SECRET=<generated_secret>
```

## Step 3: Initialize Database

```bash
# Start only database first
docker compose up -d postgres

# Wait for postgres to be ready
docker compose logs -f postgres
# Look for: "database system is ready to accept connections"

# Apply schema migrations
psql -U postgres -h localhost -d whatsapp_genesys -f docker/postgres/init.sql
psql -U postgres -h localhost -d whatsapp_genesys -f docker/postgres/02-agent-portal-schema.sql

# Verify tables created
psql -U postgres -h localhost -d whatsapp_genesys -c "\dt"
```

Expected tables:
- `tenants`
- `tenant_whatsapp_config`
- `tenant_api_keys`
- `genesys_users`
- `genesys_user_sessions`
- `conversation_assignments`
- `conversations`
- `messages`

## Step 4: Start Infrastructure Services

```bash
# Start Redis and RabbitMQ
docker compose up -d redis rabbitmq

# Verify health
docker compose ps

# Should show:
# - postgres (healthy)
# - redis (healthy)
# - rabbitmq (healthy)
```

## Step 5: Start Backend Services

```bash
# Start all backend services
docker compose up -d \
  tenant-service \
  auth-service \
  state-manager \
  whatsapp-webhook-service \
  whatsapp-api-service \
  genesys-webhook-service \
  genesys-api-service \
  inbound-transformer \
  outbound-transformer \
  agent-portal-service

# Check logs
docker compose logs -f agent-portal-service
```

## Step 6: Start API Gateway

```bash
docker compose up -d api-gateway

# Verify gateway is routing
curl http://localhost:3000/health

# Expected: {"status":"healthy"}
```

## Step 7: Start Frontend Services

```bash
# Start admin dashboard and agent portal
docker compose up -d admin-dashboard agent-portal

# Verify services
curl http://localhost:3013  # Admin Dashboard (should return HTML)
curl http://localhost:3014  # Agent Portal (should return HTML)
```

## Step 8: Create Your First Tenant

### Via Admin Dashboard

1. Navigate to http://localhost:3013
2. Click "Create New Tenant"
3. Fill in details:
   - **Tenant ID**: `acme_corp`
   - **Name**: `Acme Corporation`
   - **Subdomain**: `acme`
   - **Genesys Org ID**: `<your-genesys-org-id>`
   - **Genesys Region**: `mypurecloud.com`
4. Click "Create"
5. Note the **API Key** (save it securely)

### Configure WhatsApp for Tenant

1. In Admin Dashboard, navigate to tenant details
2. Click "Configure WhatsApp"
3. Click "Connect WhatsApp Business"
4. Meta embedded signup popup opens
5. Select/create WhatsApp Business Account
6. Complete signup flow
7. Verify WhatsApp connected (green checkmark)

## Step 9: Test Agent Portal

### First Login (Auto-Provisioning)

1. Navigate to http://localhost:3014/login
2. Click "Sign in with Genesys Cloud"
3. OAuth popup opens
4. Enter your Genesys credentials
5. Authorize the application
6. **Auto-provisioning happens**:
   - User account created
   - Linked to tenant by Genesys org ID
   - JWT token issued
7. Redirected to workspace

### Verify User Creation

```bash
# Check database
psql -U postgres -h localhost -d whatsapp_genesys

SELECT user_id, tenant_id, genesys_user_id, name, role 
FROM genesys_users;

# Should show your new user
```

### Send Test Message

1. In Agent Portal workspace, view conversations
2. Click a conversation (or create one)
3. Type message in input
4. Click "Send"
5. Message sent using tenant's WhatsApp account

## Step 10: Configure Webhooks

### WhatsApp Webhook

1. In Meta App dashboard, go to WhatsApp → Configuration
2. Set webhook URL: `https://your-domain.com/webhook/meta`
3. Set verify token: `<value from META_VERIFY_TOKEN>`
4. Subscribe to messages

### Genesys Webhook

1. In Genesys Admin, go to Integrations
2. Create Open Messaging Integration
3. Set webhook URL: `https://your-domain.com/webhook/genesys`
4. Configure message routing

## Verification Checklist

### ✅ Database

- [ ] All tables created
- [ ] Tenant created with Genesys org ID
- [ ] WhatsApp config saved for tenant

### ✅ Services

- [ ] All containers running
- [ ] No errors in logs
- [ ] Health checks passing

### ✅ Admin Dashboard

- [ ] Can access http://localhost:3013
- [ ] Can create tenant
- [ ] WhatsApp signup completes

### ✅ Agent Portal

- [ ] Can access http://localhost:3014
- [ ] Genesys login works
- [ ] User auto-provisioned
- [ ] Workspace loads

### ✅ Message Flow

- [ ] Customer message arrives via WhatsApp
- [ ] Agent receives notification
- [ ] Agent can view conversation
- [ ] Agent can send reply
- [ ] Customer receives message

## Troubleshooting

### Issue: "Tenant not found for this Genesys organization"

**Cause**: Genesys org ID mismatch

**Fix**:
```bash
# Check user's Genesys org ID
# Login to Genesys, check organization ID in profile

# Update tenant
psql -U postgres -h localhost -d whatsapp_genesys

UPDATE tenants 
SET genesys_org_id = 'correct-org-id' 
WHERE tenant_id = 'acme_corp';
```

### Issue: "WhatsApp not configured"

**Cause**: Tenant hasn't completed WhatsApp setup

**Fix**:
1. Login to Admin Dashboard
2. Navigate to tenant
3. Complete WhatsApp embedded signup
4. Verify `tenant_whatsapp_config` table has entry

### Issue: Services won't start

**Check dependencies**:
```bash
# View service dependencies
docker compose config

# Start in correct order
docker compose up -d postgres redis rabbitmq
docker compose up -d tenant-service
docker compose up -d auth-service
# ... etc
```

### Issue: Database connection failed

**Fix**:
```bash
# Restart postgres
docker compose restart postgres

# Check logs
docker compose logs postgres

# Verify connection
psql -U postgres -h localhost -p 5432
```

## Development Workflow

### Run Single Service Locally

```bash
# Stop Docker version
docker compose stop agent-portal-service

# Run locally
cd services/agent-portal-service
npm install
npm run dev
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f agent-portal-service

# Last 100 lines
docker compose logs --tail=100 agent-portal-service
```

### Restart Services

```bash
# Restart single service
docker compose restart agent-portal-service

# Rebuild and restart
docker compose up -d --build agent-portal-service

# Restart all
docker compose restart
```

## Production Deployment

### Environment Differences

**Development**:
- HTTP (not HTTPS)
- Localhost URLs
- Debug logging enabled
- CORS allowed from localhost

**Production**:
- HTTPS required
- Public domain URLs
- Error logging only
- CORS restricted to domain
- Secrets in vault (not .env)

### Production Checklist

- [ ] Use HTTPS for all endpoints
- [ ] Set strong `JWT_SECRET`
- [ ] Use environment-specific secrets
- [ ] Configure proper CORS origins
- [ ] Enable SSL for Postgres
- [ ] Use managed Redis (e.g., AWS ElastiCache)
- [ ] Use managed RabbitMQ (e.g., CloudAMQP)
- [ ] Set up monitoring (Datadog, New Relic)
- [ ] Configure log aggregation
- [ ] Set up backups for Postgres
- [ ] Use CDN for frontend assets

## Next Steps

1. **Add More Agents**: Agents auto-provision on first Genesys login
2. **Configure Roles**: Update user roles in database (admin, supervisor, agent)
3. **Test Multi-Agent**: Have multiple agents login and test conversation assignment
4. **Set Up Monitoring**: Configure metrics and alerting
5. **Production Deploy**: Follow production deployment guide

## Support

For issues:
1. Check logs: `docker compose logs -f`
2. Review documentation in `/docs`
3. Check troubleshooting section above
4. Contact platform administrator

---

🎉 **Congratulations!** Your Xypr App platform is now running with the Agent Portal!
