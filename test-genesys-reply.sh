#!/bin/bash

# Test script to simulate Genesys agent replying to the real WhatsApp conversation
# This uses the ACTUAL conversation ID created by the inbound message

WEBHOOK_URL="http://localhost:3011/webhook/genesys"
INTEGRATION_ID="953973be-eb1f-4a3b-8541-62b3e809c803"
CONVERSATION_ID="33aba1eb31811e3753241c8737078ea7"  # Real conversation from inbound message
MESSAGE_ID="msg-reply-$(date +%s)"

echo "🎯 Sending Genesys reply to real WhatsApp conversation..."
echo "Conversation ID: $CONVERSATION_ID"
echo ""

# Send agent reply
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: test-signature" \
  -d '{
    "id": "notification-'$MESSAGE_ID'",
    "channel": {
      "id": "'$INTEGRATION_ID'",
      "platform": "Open",
      "type": "Private",
      "messageId": "'$MESSAGE_ID'",
      "to": {
        "id": "919847106176"
      },
      "from": {
        "id": "'$INTEGRATION_ID'"
      },
      "time": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
    },
    "type": "Text",
    "text": "Hello! Thanks for testing the integration. This is a reply from Genesys!",
    "direction": "Outbound",
    "conversation": {
      "id": "'$CONVERSATION_ID'"
    },
    "metadata": {
      "tenantId": "t_a3eecb94bb822a92"
    }
  }'

echo ""
echo "✅ Message sent! Check logs for processing..."
