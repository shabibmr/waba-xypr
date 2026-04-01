#!/bin/bash
set -e

# 2-Tier Deployment Script - App Server
# Deploys application services that connect to separate infrastructure server

echo "============================================"
echo "WABA 2-Tier Deployment - App Server"
echo "============================================"
echo ""

# Configuration
APP_SERVER="65.2.112.193"
INFRA_SERVER="15.207.0.150"
BRANCH="m1"

echo "📋 Configuration:"
echo "   App Server: $APP_SERVER"
echo "   Infra Server: $INFRA_SERVER"
echo "   Branch: $BRANCH"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create .env file with required configuration"
    exit 1
fi

echo "✓ .env file found"

# Check .env has required infra server connections
echo ""
echo "📝 Verifying .env configuration..."

# Check critical environment variables
required_vars=(
    "DB_HOST"
    "REDIS_HOST"
    "RABBITMQ_HOST"
    "META_APP_SECRET"
    "META_VERIFY_TOKEN"
    "GENESYS_CLIENT_ID"
    "GENESYS_CLIENT_SECRET"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env 2>/dev/null; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "❌ Missing required environment variables:"
    printf '   - %s\n' "${missing_vars[@]}"
    echo ""
    echo "Please update your .env file"
    exit 1
fi

echo "✓ Required environment variables present"

# Verify infra server is configured correctly
if grep -q "DB_HOST=$INFRA_SERVER" .env && \
   grep -q "REDIS_HOST=$INFRA_SERVER" .env && \
   grep -q "RABBITMQ_HOST=$INFRA_SERVER" .env; then
    echo "✓ Infra server correctly configured ($INFRA_SERVER)"
else
    echo "⚠️  Warning: Infra server might not be correctly configured"
    echo "   Expected DB_HOST, REDIS_HOST, RABBITMQ_HOST = $INFRA_SERVER"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🔨 Building Docker images..."
docker compose -f docker-compose.2tier.yml build

echo ""
echo "🚀 Starting application services..."
docker compose -f docker-compose.2tier.yml up -d

echo ""
echo "⏳ Waiting for services to be healthy (30 seconds)..."
sleep 30

echo ""
echo "🏥 Health Check..."
docker compose -f docker-compose.2tier.yml ps

echo ""
echo "============================================"
echo "✅ Deployment Complete!"
echo "============================================"
echo ""
echo "📍 Service URLs:"
echo "   API Gateway:       http://$APP_SERVER:3000"
echo "   Agent Portal:      http://$APP_SERVER:3014"
echo "   Admin Dashboard:   http://$APP_SERVER:3006"
echo "   WhatsApp Webhook:  http://$APP_SERVER:3009/webhook"
echo "   Genesys Webhook:   http://$APP_SERVER:3011/webhook"
echo ""
echo "🔗 Connected to infrastructure at: $INFRA_SERVER"
echo ""
echo "📊 Check logs:"
echo "   docker compose -f docker-compose.2tier.yml logs -f"
echo ""
echo "🔄 Restart services:"
echo "   docker compose -f docker-compose.2tier.yml restart"
echo ""
echo "🛑 Stop services:"
echo "   docker compose -f docker-compose.2tier.yml down"
echo ""
