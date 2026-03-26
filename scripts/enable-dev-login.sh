#!/bin/bash

# Enable Dev Login - Quick activation script
# This enables the OAuth bypass for testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔧 Enabling Dev Login for Agent Portal..."
echo ""

# Frontend configuration
FRONTEND_ENV="$PROJECT_ROOT/services/agent-portal/.env"
BACKEND_ENV="$PROJECT_ROOT/services/agent-portal-service/.env"

# Check if .env files exist
if [ ! -f "$FRONTEND_ENV" ]; then
    echo "⚠️  Frontend .env not found, copying from .env.example..."
    cp "$PROJECT_ROOT/services/agent-portal/.env.example" "$FRONTEND_ENV"
fi

if [ ! -f "$BACKEND_ENV" ]; then
    echo "⚠️  Backend .env not found, copying from .env.example..."
    cp "$PROJECT_ROOT/services/agent-portal-service/.env.example" "$BACKEND_ENV"
fi

# Enable dev login in frontend
if grep -q "VITE_ENABLE_DEV_LOGIN" "$FRONTEND_ENV"; then
    sed -i.bak 's/VITE_ENABLE_DEV_LOGIN=.*/VITE_ENABLE_DEV_LOGIN=true/' "$FRONTEND_ENV"
    echo "✅ Updated VITE_ENABLE_DEV_LOGIN=true in frontend .env"
else
    echo "" >> "$FRONTEND_ENV"
    echo "# Development / Testing" >> "$FRONTEND_ENV"
    echo "VITE_ENABLE_DEV_LOGIN=true" >> "$FRONTEND_ENV"
    echo "✅ Added VITE_ENABLE_DEV_LOGIN=true to frontend .env"
fi

# Configure backend (optional SKIP_AUTH)
if grep -q "NODE_ENV" "$BACKEND_ENV"; then
    sed -i.bak 's/NODE_ENV=.*/NODE_ENV=development/' "$BACKEND_ENV"
    echo "✅ Updated NODE_ENV=development in backend .env"
else
    echo "" >> "$BACKEND_ENV"
    echo "# Development / Testing" >> "$BACKEND_ENV"
    echo "NODE_ENV=development" >> "$BACKEND_ENV"
    echo "✅ Added NODE_ENV=development to backend .env"
fi

if ! grep -q "SKIP_AUTH" "$BACKEND_ENV"; then
    echo "SKIP_AUTH=false  # Set to 'true' to bypass JWT validation" >> "$BACKEND_ENV"
    echo "✅ Added SKIP_AUTH=false to backend .env (change to 'true' to skip JWT validation)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Dev Login Enabled!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1️⃣  Restart services:"
echo "   ./manage.sh restart agent-portal agent-portal-service"
echo ""
echo "2️⃣  Open login page:"
echo "   http://localhost:3014/login"
echo ""
echo "3️⃣  Click the 'Dev Login (Skip OAuth)' button"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 How it works:"
echo "   • First time: Creates demo-user-001"
echo "   • Subsequent logins: Replays last session (OAuth or demo)"
echo "   • Session expires after 7 days"
echo ""
echo "📖 Full documentation: DEV_LOGIN_SETUP.md"
echo ""
echo "⚠️  Optional: To completely skip JWT validation:"
echo "   Edit $BACKEND_ENV"
echo "   Set SKIP_AUTH=true"
echo ""
