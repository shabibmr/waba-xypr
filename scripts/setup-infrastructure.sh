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
MINIO_ACCESS_KEY=${MINIO_ROOT_USER:-admin}
MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD:-admin123}

RABBITMQ_HOST=${RABBITMQ_HOST:-localhost}
RABBITMQ_PORT=${RABBITMQ_PORT:-5672}
RABBITMQ_USER=${RABBITMQ_USER:-admin}
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD:-admin123}

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
curl -u $RABBITMQ_USER:$RABBITMQ_PASSWORD -X PUT \
    "http://$RABBITMQ_HOST:15672/api/queues/%2F/INBOUND_WHATSAPP_MESSAGES" \
    -H "content-type:application/json" \
    -d '{"durable":true}'

curl -u $RABBITMQ_USER:$RABBITMQ_PASSWORD -X PUT \
    "http://$RABBITMQ_HOST:15672/api/queues/%2F/OUTBOUND_GENESYS_MESSAGES" \
    -H "content-type:application/json" \
    -d '{"durable":true}'

echo "✅ Infrastructure setup complete!"
echo ""
echo "Next steps:"
echo "1. Update database/seeds/001_demo_tenant.sql with your actual credentials"
echo "2. Verify all services can connect to infrastructure"
