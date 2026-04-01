#!/bin/bash
# WhatsApp-Genesys Service Health Check Script

PROJECT_DIR="/home/ubuntu/waba-xypr"
COMPOSE_FILE="docker-compose.2tier.yml"

echo "============================================================"
echo "WhatsApp-Genesys 2-Tier Health Check - $(date)"
echo "============================================================"

cd $PROJECT_DIR || { echo "Error: Could not enter project directory"; exit 1; }

# Get service details in a formatted table
echo -e "NAME\t\t\t\tSTATUS\t\t\tHEALTH"
echo "------------------------------------------------------------"
sudo docker compose -f $COMPOSE_FILE ps --format "{{.Name}}\t\t{{.Status}}\t\t{{.Health}}" | sed 's/\t\t$/\t\t-/'

echo "------------------------------------------------------------"

# Summary Statistics
TOTAL=$(sudo docker compose -f $COMPOSE_FILE ps -q | wc -l)
RUNNING=$(sudo docker compose -f $COMPOSE_FILE ps --filter "status=running" -q | wc -l)
HEALTHY=$(sudo docker compose -f $COMPOSE_FILE ps --filter "health=healthy" -q | wc -l)
UNHEALTHY=$(sudo docker compose -f $COMPOSE_FILE ps --filter "health=unhealthy" -q | wc -l)
STARTING=$(sudo docker compose -f $COMPOSE_FILE ps --filter "health=starting" -q | wc -l)

echo "Total Services: $TOTAL"
echo "Running:        $RUNNING"
echo "Healthy:        $HEALTHY"
echo "Starting:       $STARTING"
echo "Unhealthy:      $UNHEALTHY"

echo "============================================================"

if [ "$TOTAL" -eq "$RUNNING" ] && [ "$UNHEALTHY" -eq 0 ]; then
    echo "RESULT: ✅ SYSTEM OPERATIONAL (All services running)"
elif [ "$UNHEALTHY" -gt 0 ]; then
    echo "RESULT: ❌ SYSTEM DEGRADED ($UNHEALTHY services unhealthy)"
    echo "Check logs with: ./manage.sh logs"
else
    echo "RESULT: ⚠️  SYSTEM INITIALIZING ($STARTING services still starting)"
fi
