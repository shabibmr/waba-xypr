#!/bin/bash

# WhatsApp-Genesys Management Script - SERVER EDITION
# Unified tool for Start, Stop, Restart, Status, and Clean operations.

COMMAND=$1
if [ -z "$COMMAND" ]; then
    echo "Usage: ./manage.sh [start|stop|restart|build|build-restart|clean|status|logs|clear-logs] [--local|--inf|--rem|--prod]"
    exit 1
fi
shift

MODE="2tier" # Default to 2-tier on this server

# Parse flags
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --local) MODE="dev" ;;
        --inf)   MODE="infra" ;;
        --rem)   MODE="remote" ;;
        --prod)  MODE="prod" ;;
        --2tier) MODE="2tier" ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Configuration
COMPOSE_DEV="-f docker-compose.infra.yml -f docker-compose.yml"
COMPOSE_PROD="-f docker-compose.prod.yml"
COMPOSE_INFRA="-f docker-compose.infra.yml"
COMPOSE_REMOTE="-f docker-compose.remote.yml"
COMPOSE_2TIER="-f docker-compose.2tier.yml"

get_compose_args() {
    case $MODE in
        dev)    echo "$COMPOSE_DEV" ;;
        prod)   echo "$COMPOSE_PROD" ;;
        infra)  echo "$COMPOSE_INFRA" ;;
        remote) echo "$COMPOSE_REMOTE" ;;
        2tier)  echo "$COMPOSE_2TIER" ;;
    esac
}

# Ports to check/kill
PORTS=(5432 6379 5672 3000 3002 3003 3004 3005 3006 3007 3008 3009 3010 3011 3012)

kill_port() {
    local port=$1
    if lsof -i :$port -t >/dev/null 2>&1; then
        echo "Killing process on port $port..."
        sudo kill -9 $(lsof -i :$port -t)
    fi
}

check_env() {
    echo "Checking environment..."
    if [ ! -f .env ]; then
        echo "Error: .env file not found!"
        exit 1
    fi
    # Check for critical server variables
    grep -E "RABBITMQ_URL|DATABASE_URL" .env | grep -q "your_rabbitmq_password" && echo "WARNING: Default RabbitMQ password detected!"
    grep -E "DATABASE_URL" .env | grep -q "localhost" && [ "$MODE" == "2tier" ] && echo "WARNING: DATABASE_URL points to localhost but mode is 2tier!"
}

start_services() {
    check_env
    echo "Starting services in $MODE mode..."
    sudo docker compose $(get_compose_args) up -d
}

stop_services() {
    local remove_volumes=$1
    echo "Stopping services..."
    if [ "$remove_volumes" = "true" ]; then
        sudo docker compose $(get_compose_args) down -v
    else
        sudo docker compose $(get_compose_args) down
    fi
}

check_health() {
    echo "Service Status ($MODE):"
    sudo docker compose $(get_compose_args) ps
}

build_services() {
    echo "Building services..."
    sudo docker compose $(get_compose_args) build
}

case $COMMAND in
    start)
        start_services
        ;;
    stop)
        stop_services false
        ;;
    restart)
        echo "Restarting environment..."
        stop_services false
        start_services
        ;;
    clean)
        echo "Cleaning environment (stopping containers, removing volumes)..."
        stop_services true
        ;;
    status)
        check_health
        ;;
    build)
        build_services
        ;;
    build-restart)
        build_services
        stop_services false
        start_services
        ;;
    logs)
        sudo docker compose $(get_compose_args) logs -f --tail=100
        ;;
    clear-logs)
        echo "Clearing application log files..."
        find services -type f -path "*/logs/*.log" -delete
        sudo docker ps | grep -q whatsapp-agent-portal-service && sudo docker exec whatsapp-agent-portal-service sh -c "rm -f logs/*.log" 2>/dev/null || true
        echo "Logs cleared."
        ;;
    *)
        echo "Usage: ./manage.sh [start|stop|restart|build|build-restart|clean|status|logs|clear-logs] [--local|--inf|--rem|--prod]"
        exit 1
        ;;
esac
