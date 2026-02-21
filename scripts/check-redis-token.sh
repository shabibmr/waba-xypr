#!/bin/bash

# check-redis-token.sh
# Retrieves the Genesys OAuth token stored in Redis for a given agentUserId
# Automatically fetches the ID from agent-portal logs if no argument is provided

AGENT_ID=$1

if [ -z "$AGENT_ID" ]; then
  echo "No Agent ID provided. Attempting to fetch from latest agent-portal logs..."
  AGENT_ID=$(docker logs agent-portal 2>&1 | grep -o '\[AGENT_ID: [^]]*\]' | tail -n 1 | sed 's/\[AGENT_ID: //;s/\]//')
  
  if [ -z "$AGENT_ID" ]; then
    echo "❌ Error: Could not find [AGENT_ID: ...] pattern in agent-portal logs."
    echo "Usage: ./check-redis-token.sh [<agentUserId>]"
    exit 1
  fi
  echo "✅ Found latest Agent ID from logs: $AGENT_ID"
fi

KEY="gc:token:$AGENT_ID"

echo "Checking Redis for key: $KEY"
echo "----------------------------------------"

# Execute redis-cli inside the whatsapp-redis container
docker exec -i whatsapp-redis redis-cli GET "$KEY"

echo "----------------------------------------"
