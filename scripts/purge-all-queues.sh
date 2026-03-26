#!/bin/bash
# Purge all messages from all RabbitMQ queues
# Uses the RabbitMQ Management API

RABBITMQ_HOST="${RABBITMQ_HOST:-192.168.1.8}"
RABBITMQ_MGMT_PORT="${RABBITMQ_MGMT_PORT:-15672}"
RABBITMQ_USER="${RABBITMQ_USER:-admin}"
RABBITMQ_PASSWORD="${RABBITMQ_PASSWORD:-your_rabbitmq_password}"

BASE_URL="http://${RABBITMQ_HOST}:${RABBITMQ_MGMT_PORT}"

echo "🐰 Connecting to RabbitMQ at ${BASE_URL}..."

# Get all queue names
QUEUES=$(curl -s -u "${RABBITMQ_USER}:${RABBITMQ_PASSWORD}" \
  "${BASE_URL}/api/queues" | python3 -c "
import sys, json
try:
    print('\n'.join([q['name'] for q in json.load(sys.stdin)]))
except:
    pass
")

if [ -z "$QUEUES" ]; then
  echo "❌ No queues found or unable to connect."
  exit 1
fi

TOTAL=$(echo "$QUEUES" | wc -l | tr -d ' ')
echo "📋 Found ${TOTAL} queue(s). Purging all..."
echo ""

COUNT=0
for QUEUE in $QUEUES; do
  ENCODED_QUEUE=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$QUEUE', safe=''))")
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -u "${RABBITMQ_USER}:${RABBITMQ_PASSWORD}" \
    -X DELETE "${BASE_URL}/api/queues/%2f/${ENCODED_QUEUE}/contents")

  if [ "$RESPONSE" = "204" ]; then
    echo "  ✅ Purged: ${QUEUE}"
    COUNT=$((COUNT + 1))
  else
    echo "  ❌ Failed (HTTP ${RESPONSE}): ${QUEUE}"
  fi
done

echo ""
echo "🎉 Done! Purged ${COUNT}/${TOTAL} queue(s)."
