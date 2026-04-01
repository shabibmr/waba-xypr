#!/bin/bash

# Deployment Status Checker
# Usage: ./check-deployment.sh

APP_SERVER="65.2.112.193"
SSH_KEY="xypr-dev-ssh.pem"

echo "============================================"
echo "WABA Deployment Status Checker"
echo "App Server: $APP_SERVER"
echo "============================================"
echo ""

# Function to run SSH command
run_ssh() {
    ssh -i "$SSH_KEY" ubuntu@"$APP_SERVER" "$1" 2>/dev/null
}

# Check if server is reachable
echo "🔌 Checking server connectivity..."
if run_ssh "echo '✅ Server reachable'" > /dev/null 2>&1; then
    echo "✅ Server is online"
else
    echo "❌ Cannot reach server"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Container Status (should be 14 running)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

container_count=$(run_ssh "docker ps --format '{{.Names}}' | grep whatsapp | wc -l")
echo "Running containers: $container_count / 14"
echo ""

run_ssh "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep whatsapp"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏥 Service Health Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Health check function
check_health() {
    local name=$1
    local url=$2

    status=$(run_ssh "curl -s -o /dev/null -w '%{http_code}' $url" 2>/dev/null || echo "000")

    if [ "$status" = "200" ]; then
        echo "✅ $name - OK (200)"
    elif [ "$status" = "000" ]; then
        echo "⏳ $name - Not ready yet"
    else
        echo "❌ $name - Error ($status)"
    fi
}

check_health "API Gateway    " "http://localhost:3000/health"
check_health "Tenant Service " "http://localhost:3007/health"
check_health "Auth Service   " "http://localhost:3004/api/v1/health"
check_health "State Manager  " "http://localhost:3005/health"
check_health "WhatsApp API   " "http://localhost:3008/health"
check_health "Genesys API    " "http://localhost:3010/health"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔨 Build Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

build_running=$(run_ssh "ps aux | grep -E 'docker.*build|compose.*build' | grep -v grep | wc -l")

if [ "$build_running" -gt 0 ]; then
    echo "⏳ Build in progress ($build_running processes)"
    run_ssh "ps aux | grep -E 'docker.*build|compose.*build' | grep -v grep | head -3"
else
    echo "✅ No builds running"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 Server Resources"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_ssh "echo 'Uptime:' && uptime && echo '' && echo 'Disk:' && df -h / | tail -1 && echo '' && echo 'Memory:' && free -h | grep -E 'Mem:|Swap:'"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Service URLs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API Gateway:       http://$APP_SERVER:3000"
echo "Agent Portal:      http://$APP_SERVER:3014"
echo "Admin Dashboard:   http://$APP_SERVER:3006"
echo "WhatsApp Webhook:  http://$APP_SERVER:3009/webhook"
echo "Genesys Webhook:   http://$APP_SERVER:3011/webhook"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Quick Commands"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "View logs:"
echo "  ssh -i $SSH_KEY ubuntu@$APP_SERVER"
echo "  cd ~/waba-xypr"
echo "  docker compose -f docker-compose.2tier.yml logs -f"
echo ""
echo "Restart service:"
echo "  docker compose -f docker-compose.2tier.yml restart <service-name>"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
