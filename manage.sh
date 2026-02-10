#!/bin/bash

# WhatsApp-Genesys Management Script
# Unified tool for Start, Stop, Restart, Status, and Clean operations.

COMMAND=$1
shift # Shift to handle flags

INFRA_ONLY=false
REMOTE_ONLY=false
PROD=false
NGROK=false

# Parse remaining arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --infra) INFRA_ONLY=true ;;
        --remote) REMOTE_ONLY=true ;;
        --prod) PROD=true ;;
        --ngrok) NGROK=true ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Configuration
COMPOSE_DEV="-f docker-compose.infra.yml -f docker-compose.yml -f docker-compose.dev.yml"
COMPOSE_PROD="-f docker-compose.prod.yml"
COMPOSE_INFRA="-f docker-compose.infra.yml"
COMPOSE_REMOTE="-f docker-compose.remote.yml"

# Ports to check/kill
PORTS=(5432 6379 5672 3000 3002 3003 3004 3005 3006 3007 3008 3009 3010 3011 3012)

get_compose_args() {
    if [ "$INFRA_ONLY" = true ]; then
        echo "$COMPOSE_INFRA"
    elif [ "$REMOTE_ONLY" = true ]; then
        echo "$COMPOSE_REMOTE"
    elif [ "$PROD" = true ]; then
        echo "$COMPOSE_PROD"
    else
        echo "$COMPOSE_DEV"
    fi
}

kill_port() {
    local port=$1
    if lsof -i :$port -t >/dev/null 2>&1; then
        echo "Killing process on port $port..."
        kill -9 $(lsof -i :$port -t)
    fi
}

start_services() {
    echo "Starting services..."
    docker compose $(get_compose_args) up -d
}

stop_ngrok() {
    if pgrep -x ngrok > /dev/null 2>&1; then
        echo "Stopping ngrok..."
        pkill -x ngrok 2>/dev/null
    fi
}

start_ngrok() {
    # Only run if --ngrok flag is set
    if [ "$NGROK" != true ]; then
        return
    fi

    # Check if ngrok is installed
    if ! command -v ngrok &> /dev/null; then
        echo ""
        echo "Warning: ngrok is not installed. Skipping tunnel setup."
        echo "  Install: brew install ngrok/ngrok/ngrok"
        echo "  Or run ./setup-ngrok.sh later"
        return
    fi

    # Kill any existing ngrok
    stop_ngrok

    echo ""
    echo "Waiting for webhook services..."

    # Wait for webhook ports (up to 30 seconds)
    for i in $(seq 1 30); do
        WA_UP=false
        GC_UP=false
        lsof -i :3009 -t > /dev/null 2>&1 && WA_UP=true
        lsof -i :3011 -t > /dev/null 2>&1 && GC_UP=true

        if [ "$WA_UP" = true ] && [ "$GC_UP" = true ]; then
            break
        fi
        sleep 1
    done

    if [ "$WA_UP" = false ] && [ "$GC_UP" = false ]; then
        echo "Warning: No webhook services detected. Skipping ngrok."
        return
    fi

    # Build ngrok config
    NGROK_CONFIG="/tmp/ngrok-mvp.yml"
    cat > $NGROK_CONFIG << 'NGROKEOF'
version: "2"
tunnels:
NGROKEOF

    if [ "$WA_UP" = true ]; then
        cat >> $NGROK_CONFIG << 'NGROKEOF'
  whatsapp-webhook:
    proto: http
    addr: 3009
    inspect: true
NGROKEOF
    fi

    if [ "$GC_UP" = true ]; then
        cat >> $NGROK_CONFIG << 'NGROKEOF'
  genesys-webhook:
    proto: http
    addr: 3011
    inspect: true
NGROKEOF
    fi

    # Start ngrok
    TUNNELS=""
    [ "$WA_UP" = true ] && TUNNELS="whatsapp-webhook"
    [ "$GC_UP" = true ] && TUNNELS="$TUNNELS genesys-webhook"

    ngrok start --config=$NGROK_CONFIG $TUNNELS > /tmp/ngrok.log 2>&1 &
    NGROK_PID=$!

    # Wait for ngrok API
    echo "Starting ngrok tunnels..."
    for i in $(seq 1 10); do
        curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1 && break
        sleep 1
    done

    # Fetch and display URLs
    echo ""
    echo "========================================================"
    echo "  ngrok Tunnels"
    echo "========================================================"

    URLS_FILE="/tmp/ngrok-webhook-urls.txt"
    echo "ngrok Webhook URLs - $(date)" > $URLS_FILE

    if [ "$WA_UP" = true ]; then
        WA_URL=$(curl -s http://localhost:4040/api/tunnels/whatsapp-webhook 2>/dev/null | grep -o '"public_url":"https://[^"]*' | cut -d'"' -f4)
        if [ -n "$WA_URL" ]; then
            echo ""
            echo "  WhatsApp Webhook:"
            echo "    URL:    ${WA_URL}/webhook/whatsapp"
            echo "    Verify: whatsapp_webhook_verify_token_2024"
            echo "WhatsApp: ${WA_URL}/webhook/whatsapp" >> $URLS_FILE
        fi
    fi

    if [ "$GC_UP" = true ]; then
        GC_URL=$(curl -s http://localhost:4040/api/tunnels/genesys-webhook 2>/dev/null | grep -o '"public_url":"https://[^"]*' | cut -d'"' -f4)
        if [ -n "$GC_URL" ]; then
            echo ""
            echo "  Genesys Webhook:"
            echo "    URL:    ${GC_URL}/webhook/genesys"
            echo "Genesys: ${GC_URL}/webhook/genesys" >> $URLS_FILE
        fi
    fi

    echo ""
    echo "  ngrok inspect: http://localhost:4040"
    echo "  ngrok PID:     $NGROK_PID"
    echo "  URLs saved to: $URLS_FILE"
    echo "========================================================"
    echo ""
}

stop_services() {
    local remove_volumes=$1
    echo "Stopping services..."
    if [ "$remove_volumes" = "true" ]; then
        docker compose $(get_compose_args) down -v
    else
        docker compose $(get_compose_args) down
    fi
}

check_health() {
    echo "Checking Service Health..."
    docker compose $(get_compose_args) ps
}

case $COMMAND in
    start)
        start_services
        start_ngrok
        ;;
    stop)
        if [ "$NGROK" = true ]; then
            stop_ngrok
        else
            stop_ngrok
            stop_services false
        fi
        ;;
    restart)
        echo "Restarting environment..."
        stop_ngrok
        stop_services false

        echo "Ensuring ports are free..."
        for port in "${PORTS[@]}"; do
            kill_port $port
        done

        start_services
        start_ngrok
        ;;
    clean)
        echo "Cleaning environment (stopping containers, removing volumes)..."
        stop_ngrok
        stop_services true
        echo "Cleanup complete."
        ;;
    status)
        check_health
        ;;
    logs)
        docker compose $(get_compose_args) logs -f
        ;;
    clear-logs)
        echo "Clearing application log files..."
        # Clear local log files if present (local dev)
        find services -type f -path "*/logs/*.log" -delete
        
        # Clear logs inside agent-portal-service container if running
        if docker ps | grep -q whatsapp-agent-portal-service; then
             echo "Clearing logs inside agent-portal-service..."
             docker exec whatsapp-agent-portal-service sh -c "rm -f logs/*.log" 2>/dev/null || true
        fi
        
        echo "Application logs cleared. To clear Docker output history, use './manage.sh restart'"
        ;;
    *)
        echo "Usage: ./manage.sh [start|stop|restart|clean|status|logs|clear-logs] [--infra] [--remote] [--prod] [--ngrok]"
        exit 1
        ;;
esac
