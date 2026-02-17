#!/bin/bash

# Simulated Genesys Webhook Test Script
# This simulates outbound messages from agents to customers

WEBHOOK_URL="http://localhost:3011/webhook/genesys"
INTEGRATION_ID="953973be-eb1f-4a3b-8541-62b3e809c803"

# Active conversation IDs from inbound test
CONV_ID_RAJESH="test-conv-rajesh-001"
CONV_ID_PRIYA="test-conv-priya-002"

echo "🚀 Sending simulated Genesys agent messages..."
echo "================================================"

# Test Message 1: Agent responds to Rajesh
echo "📤 Test 1: Agent responds to Rajesh Kumar"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: skip-in-dev" \
  -d '{
    "id": "msg-agent-001",
    "channel": {
      "id": "'$CONV_ID_RAJESH'",
      "platform": "Open",
      "type": "Private",
      "to": {
        "id": "919876543220",
        "idType": "Phone"
      },
      "from": {
        "id": "'$INTEGRATION_ID'",
        "idType": "Email"
      },
      "time": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
      "messageId": null
    },
    "type": "Text",
    "text": "Hi Rajesh! I can help you with your order. What is your order number?",
    "direction": "Outbound",
    "originatingEntity": "Human"
  }'

echo -e "\n✅ Message 1 sent: Agent response to Rajesh"
sleep 2

# Test Message 2: Agent responds to Priya
echo -e "\n================================================"
echo "📤 Test 2: Agent responds to Priya Sharma"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: skip-in-dev" \
  -d '{
    "id": "msg-agent-002",
    "channel": {
      "id": "'$CONV_ID_PRIYA'",
      "platform": "Open",
      "type": "Private",
      "to": {
        "id": "919876543221",
        "idType": "Phone"
      },
      "from": {
        "id": "'$INTEGRATION_ID'",
        "idType": "Email"
      },
      "time": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
      "messageId": null
    },
    "type": "Text",
    "text": "Hello Priya! Let me check your delivery status for you. One moment please.",
    "direction": "Outbound",
    "originatingEntity": "Human"
  }'

echo -e "\n✅ Message 2 sent: Agent response to Priya"
sleep 2

# Test Message 3: Agent sends follow-up to Rajesh
echo -e "\n================================================"
echo "📤 Test 3: Agent follow-up to Rajesh"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: skip-in-dev" \
  -d '{
    "id": "msg-agent-003",
    "channel": {
      "id": "'$CONV_ID_RAJESH'",
      "platform": "Open",
      "type": "Private",
      "to": {
        "id": "919876543220",
        "idType": "Phone"
      },
      "from": {
        "id": "'$INTEGRATION_ID'",
        "idType": "Email"
      },
      "time": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
      "messageId": null
    },
    "type": "Text",
    "text": "Yes, I am here! How can I assist you further?",
    "direction": "Outbound",
    "originatingEntity": "Human"
  }'

echo -e "\n✅ Message 3 sent: Agent follow-up to Rajesh"

echo -e "\n================================================"
echo "✅ All Genesys webhook events sent successfully!"
echo ""
echo "📊 Check the results:"
echo "  1. View logs: docker compose logs -f genesys-webhook-service state-manager"
echo "  2. Check outbound transformer: docker compose logs -f outbound-transformer"
echo "  3. Check WhatsApp API delivery: docker compose logs -f whatsapp-api-service"
echo "  4. Check database: docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys -c \"SELECT * FROM message_tracking WHERE direction = 'OUTBOUND' ORDER BY created_at DESC LIMIT 5;\""
echo ""
