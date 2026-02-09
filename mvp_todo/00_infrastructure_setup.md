# 00 - Infrastructure Setup

**Priority:** CRITICAL - Must complete before any service work  
**Estimated Time:** 2-3 hours  
**Dependencies:** None  
**Can Run in Parallel:** No - This is a prerequisite for all other tasks

---

## 🎯 Objective
Set up PostgreSQL database, Redis configuration, MinIO buckets, and RabbitMQ queues required for MVP.

---

## 🛡️ Guard Rails (Check Before Starting)

- [ ] Docker is installed and running
- [ ] You have access to PostgreSQL instance
- [ ] Redis is accessible (local or containerized)
- [ ] MinIO is accessible (local or containerized)
- [ ] RabbitMQ is accessible (local or containerized)

---

## 📍 Anchors (Where to Make Changes)

**New Files to Create:**
- `/database/migrations/001_create_tenants.sql`
- `/database/migrations/002_create_tenant_credentials.sql`
- `/database/migrations/003_create_conversation_mappings.sql`
- `/database/migrations/004_create_message_tracking.sql`
- `/database/seeds/001_demo_tenant.sql`
- `/scripts/setup-infrastructure.sh`

**Existing Files to Verify:**
- Check if any services already have database connection logic

---

## 📝 Step-by-Step Implementation

### Step 1: Create Database Migrations Directory

```bash
mkdir -p database/migrations database/seeds
```

### Step 2: Create Tenants Table

**File:** `database/migrations/001_create_tenants.sql`

```sql
-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone_number_id VARCHAR(50) UNIQUE,
    display_phone_number VARCHAR(20),
    genesys_integration_id VARCHAR(100) UNIQUE,
    genesys_org_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX idx_tenants_phone_number_id ON tenants(phone_number_id);
CREATE INDEX idx_tenants_genesys_integration_id ON tenants(genesys_integration_id);
CREATE INDEX idx_tenants_genesys_org_id ON tenants(genesys_org_id);
CREATE INDEX idx_tenants_status ON tenants(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Step 3: Create Tenant Credentials Table

**File:** `database/migrations/002_create_tenant_credentials.sql`

```sql
-- Create tenant_credentials table
CREATE TABLE IF NOT EXISTS tenant_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    credential_type VARCHAR(20) NOT NULL, -- 'genesys' or 'whatsapp'
    credentials JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_tenant_credentials_tenant_id ON tenant_credentials(tenant_id);
CREATE INDEX idx_tenant_credentials_type ON tenant_credentials(credential_type);
CREATE INDEX idx_tenant_credentials_tenant_type ON tenant_credentials(tenant_id, credential_type);

-- Create unique constraint for active credentials
CREATE UNIQUE INDEX idx_tenant_credentials_unique_active 
    ON tenant_credentials(tenant_id, credential_type) 
    WHERE is_active = true;

-- Create updated_at trigger
CREATE TRIGGER update_tenant_credentials_updated_at BEFORE UPDATE ON tenant_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Step 4: Create Conversation Mappings Table

**File:** `database/migrations/003_create_conversation_mappings.sql`

```sql
-- Create conversation_mappings table
CREATE TABLE IF NOT EXISTS conversation_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    wa_id VARCHAR(20) NOT NULL,
    conversation_id UUID NOT NULL,
    contact_name VARCHAR(255),
    phone_number_id VARCHAR(50),
    display_phone_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW()
);

-- Create unique constraints
CREATE UNIQUE INDEX idx_conversation_mappings_wa_id 
    ON conversation_mappings(tenant_id, wa_id);
CREATE UNIQUE INDEX idx_conversation_mappings_conversation_id 
    ON conversation_mappings(tenant_id, conversation_id);

-- Create indexes for fast lookups
CREATE INDEX idx_conversation_mappings_tenant_id ON conversation_mappings(tenant_id);
CREATE INDEX idx_conversation_mappings_last_activity ON conversation_mappings(last_activity_at DESC);
```

### Step 5: Create Message Tracking Table

**File:** `database/migrations/004_create_message_tracking.sql`

```sql
-- Create message_tracking table
CREATE TABLE IF NOT EXISTS message_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID,
    meta_message_id VARCHAR(100),
    genesys_message_id VARCHAR(100),
    direction VARCHAR(10) NOT NULL, -- 'inbound' or 'outbound'
    status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'document', 'video', 'audio'
    media_type VARCHAR(50), -- MIME type for media messages
    media_url TEXT, -- MinIO storage URL
    created_at TIMESTAMP DEFAULT NOW(),
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_message_tracking_tenant_id ON message_tracking(tenant_id);
CREATE INDEX idx_message_tracking_conversation_id ON message_tracking(conversation_id);
CREATE INDEX idx_message_tracking_meta_message_id ON message_tracking(meta_message_id);
CREATE INDEX idx_message_tracking_genesys_message_id ON message_tracking(genesys_message_id);
CREATE INDEX idx_message_tracking_direction ON message_tracking(direction);
CREATE INDEX idx_message_tracking_created_at ON message_tracking(created_at DESC);

-- Create updated_at trigger
CREATE TRIGGER update_message_tracking_updated_at BEFORE UPDATE ON message_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Step 6: Create Demo Tenant Seed Data

**File:** `database/seeds/001_demo_tenant.sql`

```sql
-- Insert demo tenant
INSERT INTO tenants (
    id,
    name,
    phone_number_id,
    display_phone_number,
    genesys_integration_id,
    genesys_org_id,
    status
) VALUES (
    'demo-tenant-001',
    'Demo Organization',
    '123456789',
    '+1234567890',
    'demo-integration-001',
    'demo-org-001',
    'active'
) ON CONFLICT (phone_number_id) DO NOTHING;

-- Insert demo Genesys credentials (replace with actual values)
INSERT INTO tenant_credentials (
    tenant_id,
    credential_type,
    credentials,
    is_active
) VALUES (
    'demo-tenant-001',
    'genesys',
    '{
        "clientId": "YOUR_GENESYS_CLIENT_ID",
        "clientSecret": "YOUR_GENESYS_CLIENT_SECRET",
        "region": "mypurecloud.com"
    }'::jsonb,
    true
) ON CONFLICT ON CONSTRAINT idx_tenant_credentials_unique_active DO NOTHING;

-- Insert demo WhatsApp credentials (replace with actual values)
INSERT INTO tenant_credentials (
    tenant_id,
    credential_type,
    credentials,
    is_active
) VALUES (
    'demo-tenant-001',
    'whatsapp',
    '{
        "access_token": "YOUR_WHATSAPP_ACCESS_TOKEN",
        "phone_number_id": "123456789",
        "business_account_id": "YOUR_BUSINESS_ACCOUNT_ID",
        "waba_id": "YOUR_WABA_ID"
    }'::jsonb,
    true
) ON CONFLICT ON CONSTRAINT idx_tenant_credentials_unique_active DO NOTHING;
```

### Step 7: Create Infrastructure Setup Script

**File:** `scripts/setup-infrastructure.sh`

```bash
#!/bin/bash

set -e

echo "🚀 Setting up MVP Infrastructure..."

# Configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-waba_mvp}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}

MINIO_HOST=${MINIO_HOST:-localhost}
MINIO_PORT=${MINIO_PORT:-9000}
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY:-minioadmin}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY:-minioadmin}

RABBITMQ_HOST=${RABBITMQ_HOST:-localhost}
RABBITMQ_PORT=${RABBITMQ_PORT:-5672}

# 1. Run PostgreSQL migrations
echo "📊 Running PostgreSQL migrations..."
export PGPASSWORD=$DB_PASSWORD

for migration in database/migrations/*.sql; do
    echo "  Running $migration..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration"
done

# 2. Run seed data
echo "🌱 Seeding demo data..."
for seed in database/seeds/*.sql; do
    echo "  Running $seed..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$seed"
done

# 3. Test Redis connection
echo "📮 Testing Redis connection..."
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping || {
    echo "❌ Redis connection failed!"
    exit 1
}

# 4. Create MinIO buckets
echo "🗄️  Creating MinIO buckets..."
docker run --rm \
    --network host \
    minio/mc \
    alias set local http://$MINIO_HOST:$MINIO_PORT $MINIO_ACCESS_KEY $MINIO_SECRET_KEY

docker run --rm \
    --network host \
    minio/mc \
    mb local/webhooks-inbound --ignore-existing

docker run --rm \
    --network host \
    minio/mc \
    mb local/webhooks-outbound --ignore-existing

docker run --rm \
    --network host \
    minio/mc \
    mb local/media-inbound --ignore-existing

docker run --rm \
    --network host \
    minio/mc \
    mb local/media-outbound --ignore-existing

# 5. Create RabbitMQ queues (using management API)
echo "🐰 Creating RabbitMQ queues..."
curl -u guest:guest -X PUT \
    "http://$RABBITMQ_HOST:15672/api/queues/%2F/INBOUND_WHATSAPP_MESSAGES" \
    -H "content-type:application/json" \
    -d '{"durable":true}'

curl -u guest:guest -X PUT \
    "http://$RABBITMQ_HOST:15672/api/queues/%2F/OUTBOUND_GENESYS_MESSAGES" \
    -H "content-type:application/json" \
    -d '{"durable":true}'

echo "✅ Infrastructure setup complete!"
echo ""
echo "Next steps:"
echo "1. Update database/seeds/001_demo_tenant.sql with your actual credentials"
echo "2. Verify all services can connect to infrastructure"
```

Make script executable:
```bash
chmod +x scripts/setup-infrastructure.sh
```

---

## ✅ Verification Steps

### 1. Verify PostgreSQL Tables

```bash
psql -h localhost -U postgres -d waba_mvp -c "\dt"
```

Expected output:
```
                     List of relations
 Schema |          Name           | Type  |  Owner   
--------+-------------------------+-------+----------
 public | conversation_mappings   | table | postgres
 public | message_tracking        | table | postgres
 public | tenant_credentials      | table | postgres
 public | tenants                 | table | postgres
```

### 2. Verify Indexes

```bash
psql -h localhost -U postgres -d waba_mvp -c "\di"
```

Should show all indexes created.

### 3. Verify Demo Tenant

```bash
psql -h localhost -U postgres -d waba_mvp -c "SELECT id, name, phone_number_id FROM tenants;"
```

Should show demo tenant.

### 4. Verify Redis

```bash
redis-cli ping
```

Should return `PONG`.

### 5. Verify MinIO Buckets

```bash
docker run --rm --network host minio/mc alias set local http://localhost:9000 minioadmin minioadmin
docker run --rm --network host minio/mc ls local/
```

Should show all 4 buckets.

### 6. Verify RabbitMQ Queues

Visit: http://localhost:15672 (guest/guest)

Should see:
- INBOUND_WHATSAPP_MESSAGES
- OUTBOUND_GENESYS_MESSAGES

---

## 🚨 Common Issues

### Issue 1: PostgreSQL Connection Failed
**Solution:** Check PostgreSQL is running:
```bash
docker ps | grep postgres
# or
pg_isready -h localhost
```

### Issue 2: MinIO Buckets Not Created
**Solution:** Verify MinIO is accessible:
```bash
curl http://localhost:9000/minio/health/live
```

### Issue 3: RabbitMQ API Not Accessible
**Solution:** Enable management plugin:
```bash
docker exec <rabbitmq-container> rabbitmq-plugins enable rabbitmq_management
```

---

## 📤 Deliverables

- [x] PostgreSQL database with 4 tables and indexes
- [x] Demo tenant seeded in database
- [x] Redis accessible
- [x] 4 MinIO buckets created
- [x] 2 RabbitMQ queues created
- [x] Verification script passes all checks

---

## 🔗 Dependencies for Next Steps

Once infrastructure is ready, these tasks can proceed in parallel:
- ✅ Task 01 - State Manager (requires PostgreSQL + Redis)
- ✅ Task 02 - Tenant Service Updates (requires PostgreSQL)
- ✅ Task 03 - Auth Service Updates (requires Redis)
- ✅ All transformer and API services
