#!/bin/bash

# Simulated WhatsApp Webhook Test Script
# This simulates an incoming message from a customer

WEBHOOK_URL="http://localhost:3009/webhook/whatsapp"
PHONE_NUMBER_ID="882555404932892"  # Your configured phone number ID

echo "🚀 Sending simulated WhatsApp message..."
echo "================================================"

# Test Message 1: New customer
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "882555404932892",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "+919876543220",
            "phone_number_id": "'$PHONE_NUMBER_ID'"
          },
          "contacts": [{
            "profile": {
              "name": "Rajesh Kumar"
            },
            "wa_id": "919876543220"
          }],
          "messages": [{
            "from": "919876543220",
            "id": "wamid.HBgNOTE5ODc2NTQzMjIwFQIAERgSNEEyQjBGOEQ4QzlFRjBFOTYA",
            "timestamp": "'$(date +%s)'",
            "type": "text",
            "text": {
              "body": "Hello! I need help with my order."
            }
          }]
        },
        "field": "messages"
      }]
    }]
  }'

echo -e "\n\n✅ Message 1 sent: New customer 'Rajesh Kumar' asking about order"
sleep 2

# Test Message 2: Different customer
echo -e "\n================================================"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "882555404932892",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "+919876543221",
            "phone_number_id": "'$PHONE_NUMBER_ID'"
          },
          "contacts": [{
            "profile": {
              "name": "Priya Sharma"
            },
            "wa_id": "919876543221"
          }],
          "messages": [{
            "from": "919876543221",
            "id": "wamid.HBgNOTE5ODc2NTQzMjIxFQIAERgSNEEyQjBGOEQ4QzlFRjBFOTcA",
            "timestamp": "'$(date +%s)'",
            "type": "text",
            "text": {
              "body": "Hi there! Can I check my delivery status?"
            }
          }]
        },
        "field": "messages"
      }]
    }]
  }'

echo -e "\n\n✅ Message 2 sent: New customer 'Priya Sharma' asking about delivery"
sleep 2

# Test Message 3: Follow-up from first customer
echo -e "\n================================================"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "882555404932892",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "+919876543220",
            "phone_number_id": "'$PHONE_NUMBER_ID'"
          },
          "messages": [{
            "from": "919876543220",
            "id": "wamid.HBgNOTE5ODc2NTQzMjIwFQIAERgSNEEyQjBGOEQ4QzlFRjBFOTgA",
            "timestamp": "'$(date +%s)'",
            "type": "text",
            "text": {
              "body": "Are you there?"
            }
          }]
        },
        "field": "messages"
      }]
    }]
  }'

echo -e "\n\n✅ Message 3 sent: Follow-up from 'Rajesh Kumar'"

echo -e "\n================================================"
echo "✅ All webhook events sent successfully!"
echo ""
echo "📊 Check the results:"
echo "  1. View logs: docker compose logs -f whatsapp-webhook-service state-manager"
echo "  2. Check database: docker exec whatsapp-postgres psql -U postgres -d whatsapp_genesys -c \"SELECT * FROM conversation_mappings ORDER BY created_at DESC LIMIT 5;\""
echo "  3. Refresh your Agent Portal at http://localhost:3014"
echo ""
