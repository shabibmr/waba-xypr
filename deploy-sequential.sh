#!/bin/bash
set -e

echo "============================================"
echo "WABA Sequential Deployment"
echo "Building and starting services one-by-one"
echo "============================================"
echo ""

cd ~/waba-xypr

# Array of services in dependency order
services=(
    "tenant-service"
    "auth-service"
    "state-manager"
    "whatsapp-webhook-service"
    "whatsapp-api-service"
    "genesys-webhook-service"
    "genesys-api-service"
    "inbound-transformer"
    "outbound-transformer"
    "api-gateway"
    "agent-portal-service"
    "agent-portal"
    "agent-widget"
    "admin-dashboard"
)

total=${#services[@]}
current=0

echo "📋 Will deploy $total services"
echo ""

for service in "${services[@]}"; do
    current=$((current + 1))
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔨 [$current/$total] Building: $service"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if docker compose -f docker-compose.2tier.yml build "$service"; then
        echo "✅ Build successful: $service"
    else
        echo "❌ Build failed: $service"
        exit 1
    fi

    echo ""
done

echo ""
echo "============================================"
echo "🚀 Starting all services..."
echo "============================================"
docker compose -f docker-compose.2tier.yml up -d

echo ""
echo "⏳ Waiting 10 seconds for services to initialize..."
sleep 10

echo ""
echo "============================================"
echo "📊 Service Status"
echo "============================================"
docker compose -f docker-compose.2tier.yml ps

echo ""
echo "============================================"
echo "✅ Deployment Complete!"
echo "============================================"
echo ""
echo "📍 Access your services:"
echo "   API Gateway:       http://65.2.112.193:3000"
echo "   Agent Portal:      http://65.2.112.193:3014"
echo "   Admin Dashboard:   http://65.2.112.193:3006"
echo ""
echo "📊 View logs:"
echo "   docker compose -f docker-compose.2tier.yml logs -f"
echo ""
echo "🔄 Restart a service:"
echo "   docker compose -f docker-compose.2tier.yml restart <service-name>"
echo ""
