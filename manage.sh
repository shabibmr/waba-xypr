#!/bin/bash

# WhatsApp-Genesys Management Script
# Unified tool for Start, Stop, Restart, Status, and Clean operations.

COMMAND=$1
shift # Shift to handle flags

INFRA_ONLY=false
REMOTE_ONLY=false
PROD=false

# Parse remaining arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --inf) INFRA_ONLY=true ;;
        --rem) REMOTE_ONLY=true ;;
        --prod) PROD=true ;;
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

build_services() {
    local service=$1
    if [ -n "$service" ]; then
        echo "Building service: $service..."
        docker compose $(get_compose_args) build "$service"
    else
        echo "Building all services..."
        docker compose $(get_compose_args) build
    fi
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
        
        echo "Ensuring ports are free..."
        for port in "${PORTS[@]}"; do
            kill_port $port
        done
        
        start_services
        ;;
    clean)
        echo "Cleaning environment (stopping containers, removing volumes)..."
        stop_services true
        echo "Cleanup complete."
        ;;
    status)
        check_health
        ;;
    build)
        build_services "$1"
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
        echo "Usage: ./manage.sh [start|stop|restart|build|clean|status|logs|clear-logs] [service_name] [--inf] [--rem] [--prod]"
        exit 1
        ;;
esac
