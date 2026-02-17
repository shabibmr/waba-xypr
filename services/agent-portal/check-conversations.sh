#!/bin/bash

# Quick script to diagnose conversation issues
# Usage: ./check-conversations.sh [user_email]

echo "=== Conversation Debugging Tool ==="
echo ""

if [ -z "$1" ]; then
    echo "Usage: $0 <user_email>"
    echo "Example: $0 agent@example.com"
    exit 1
fi

USER_EMAIL="$1"

echo "1. Checking WhatsApp Configuration..."
docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys -c "
SELECT
    t.tenant_id,
    t.name as tenant_name,
    twc.phone_number_id,
    twc.is_active,
    twc.waba_id
FROM tenants t
JOIN genesys_users gu ON t.tenant_id = gu.tenant_id
LEFT JOIN tenant_whatsapp_config twc ON t.tenant_id = twc.tenant_id
WHERE gu.genesys_email = '$USER_EMAIL';
" 2>/dev/null

echo ""
echo "2. Checking Conversation Count..."
docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys -c "
SELECT
    cm.phone_number_id,
    COUNT(*) as conversation_count,
    MAX(cm.last_activity_at) as latest_activity
FROM conversation_mappings cm
GROUP BY cm.phone_number_id;
" 2>/dev/null

echo ""
echo "3. Recent Conversations..."
docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys -c "
SELECT
    cm.conversation_id,
    cm.wa_id,
    cm.contact_name,
    cm.status,
    cm.last_activity_at
FROM conversation_mappings cm
ORDER BY cm.last_activity_at DESC
LIMIT 5;
" 2>/dev/null

echo ""
echo "4. User Info..."
docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys -c "
SELECT
    user_id,
    name,
    role,
    tenant_id,
    last_login_at
FROM genesys_users
WHERE genesys_email = '$USER_EMAIL';
" 2>/dev/null

echo ""
echo "=== Diagnosis Complete ==="
