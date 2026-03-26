#!/bin/bash

# AWS Management Script for WABA Integration
# Provides easy commands for managing the deployed application

set -e

COMPOSE_FILE="docker-compose.aws.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
    cat << EOF
${GREEN}AWS WABA Management Script${NC}

Usage: ./manage-aws.sh [COMMAND]

${YELLOW}Commands:${NC}
  start              Start all services
  stop               Stop all services
  restart            Restart all services
  status             Show status of all services
  logs [service]     Show logs (optionally for specific service)
  health             Run health checks on all services
  backup             Backup Docker volumes
  restore [date]     Restore Docker volumes from backup
  update             Pull latest code and rebuild
  clean              Stop and remove all containers and volumes
  scale [service] N  Scale a service to N instances
  db-migrate         Run database migrations
  db-backup          Backup RDS database
  db-restore [file]  Restore RDS database from file
  queue-stats        Show RabbitMQ queue statistics
  redis-info         Show Redis statistics
  nginx-reload       Reload Nginx configuration
  ssl-renew          Renew SSL certificates
  monitor            Start continuous monitoring

${YELLOW}Examples:${NC}
  ./manage-aws.sh start
  ./manage-aws.sh logs whatsapp-api-service
  ./manage-aws.sh scale genesys-api-service 3
  ./manage-aws.sh health

EOF
}

check_env() {
    if [ ! -f .env ]; then
        echo -e "${RED}Error: .env file not found${NC}"
        exit 1
    fi
    source .env
}

start_services() {
    echo -e "${YELLOW}Starting all services...${NC}"
    docker-compose -f $COMPOSE_FILE up -d
    echo -e "${GREEN}✓ Services started${NC}"
    echo "Run './manage-aws.sh health' to check service health"
}

stop_services() {
    echo -e "${YELLOW}Stopping all services...${NC}"
    docker-compose -f $COMPOSE_FILE stop
    echo -e "${GREEN}✓ Services stopped${NC}"
}

restart_services() {
    echo -e "${YELLOW}Restarting all services...${NC}"
    docker-compose -f $COMPOSE_FILE restart
    echo -e "${GREEN}✓ Services restarted${NC}"
}

show_status() {
    echo -e "${YELLOW}Service Status:${NC}"
    docker-compose -f $COMPOSE_FILE ps
}

show_logs() {
    if [ -z "$1" ]; then
        docker-compose -f $COMPOSE_FILE logs -f --tail=100
    else
        docker-compose -f $COMPOSE_FILE logs -f --tail=100 "$1"
    fi
}

health_check() {
    echo -e "${YELLOW}Running health checks...${NC}"
    echo ""

    SERVICES=(
        "api-gateway:3000:/health"
        "tenant-service:3007:/health"
        "auth-service:3004:/api/v1/health"
        "state-manager:3005:/health"
        "whatsapp-webhook-service:3009:/health"
        "whatsapp-api-service:3008:/health"
        "inbound-transformer:3002:/health/live"
        "outbound-transformer:3003:/health"
        "genesys-webhook-service:3011:/health"
        "genesys-api-service:3010:/health"
        "agent-portal:3014:/"
        "agent-portal-service:3015:/health"
        "agent-widget:3012:/health"
        "admin-dashboard:3006:/"
    )

    FAILED=0
    for service in "${SERVICES[@]}"; do
        IFS=':' read -r name port path <<< "$service"
        if curl -sf http://localhost:$port$path > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} $name (port $port)"
        else
            echo -e "${RED}✗${NC} $name (port $port) ${RED}DOWN${NC}"
            FAILED=1
        fi
    done

    # Check infrastructure
    echo ""
    echo -e "${YELLOW}Infrastructure:${NC}"

    if docker exec whatsapp-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Redis"
    else
        echo -e "${RED}✗${NC} Redis ${RED}DOWN${NC}"
        FAILED=1
    fi

    if docker exec whatsapp-rabbitmq rabbitmqctl status > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} RabbitMQ"
    else
        echo -e "${RED}✗${NC} RabbitMQ ${RED}DOWN${NC}"
        FAILED=1
    fi

    if curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} MinIO"
    else
        echo -e "${RED}✗${NC} MinIO ${RED}DOWN${NC}"
        FAILED=1
    fi

    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} RDS PostgreSQL"
    else
        echo -e "${RED}✗${NC} RDS PostgreSQL ${RED}DOWN${NC}"
        FAILED=1
    fi

    echo ""
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}All systems operational${NC}"
    else
        echo -e "${RED}Some services are down${NC}"
        exit 1
    fi
}

backup_volumes() {
    echo -e "${YELLOW}Backing up Docker volumes...${NC}"
    BACKUP_DIR="/home/ubuntu/backups"
    DATE=$(date +%Y%m%d_%H%M%S)

    mkdir -p $BACKUP_DIR

    # Backup Redis
    docker run --rm \
        -v waba-xypr_redis-data:/data \
        -v $BACKUP_DIR:/backup \
        alpine tar czf /backup/redis-$DATE.tar.gz -C /data .
    echo -e "${GREEN}✓${NC} Redis backed up to $BACKUP_DIR/redis-$DATE.tar.gz"

    # Backup RabbitMQ
    docker run --rm \
        -v waba-xypr_rabbitmq-data:/data \
        -v $BACKUP_DIR:/backup \
        alpine tar czf /backup/rabbitmq-$DATE.tar.gz -C /data .
    echo -e "${GREEN}✓${NC} RabbitMQ backed up to $BACKUP_DIR/rabbitmq-$DATE.tar.gz"

    # Backup MinIO
    docker run --rm \
        -v waba-xypr_minio-data:/data \
        -v $BACKUP_DIR:/backup \
        alpine tar czf /backup/minio-$DATE.tar.gz -C /data .
    echo -e "${GREEN}✓${NC} MinIO backed up to $BACKUP_DIR/minio-$DATE.tar.gz"

    echo -e "${GREEN}All backups completed${NC}"
}

restore_volumes() {
    if [ -z "$1" ]; then
        echo -e "${RED}Error: Please specify backup date (YYYYMMDD_HHMMSS)${NC}"
        exit 1
    fi

    DATE=$1
    BACKUP_DIR="/home/ubuntu/backups"

    echo -e "${YELLOW}Restoring from backup $DATE...${NC}"
    echo -e "${RED}WARNING: This will overwrite current data!${NC}"
    read -p "Continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled"
        exit 0
    fi

    # Stop services
    docker-compose -f $COMPOSE_FILE stop

    # Restore Redis
    docker run --rm \
        -v waba-xypr_redis-data:/data \
        -v $BACKUP_DIR:/backup \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/redis-$DATE.tar.gz -C /data"
    echo -e "${GREEN}✓${NC} Redis restored"

    # Restore RabbitMQ
    docker run --rm \
        -v waba-xypr_rabbitmq-data:/data \
        -v $BACKUP_DIR:/backup \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/rabbitmq-$DATE.tar.gz -C /data"
    echo -e "${GREEN}✓${NC} RabbitMQ restored"

    # Restore MinIO
    docker run --rm \
        -v waba-xypr_minio-data:/data \
        -v $BACKUP_DIR:/backup \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/minio-$DATE.tar.gz -C /data"
    echo -e "${GREEN}✓${NC} MinIO restored"

    # Restart services
    docker-compose -f $COMPOSE_FILE start
    echo -e "${GREEN}Restore completed${NC}"
}

update_application() {
    echo -e "${YELLOW}Updating application...${NC}"

    # Pull latest code
    git pull origin main

    # Rebuild images
    docker-compose -f $COMPOSE_FILE build --parallel

    # Restart services
    docker-compose -f $COMPOSE_FILE up -d

    echo -e "${GREEN}✓ Application updated${NC}"
}

clean_all() {
    echo -e "${RED}WARNING: This will remove all containers, networks, and volumes!${NC}"
    read -p "Continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Clean cancelled"
        exit 0
    fi

    docker-compose -f $COMPOSE_FILE down -v
    echo -e "${GREEN}✓ Cleanup completed${NC}"
}

scale_service() {
    if [ -z "$1" ] || [ -z "$2" ]; then
        echo -e "${RED}Error: Usage: ./manage-aws.sh scale [service] [count]${NC}"
        exit 1
    fi

    docker-compose -f $COMPOSE_FILE up -d --scale $1=$2
    echo -e "${GREEN}✓ Scaled $1 to $2 instances${NC}"
}

run_migrations() {
    echo -e "${YELLOW}Running database migrations...${NC}"

    for migration in database/migrations/*.sql; do
        echo "Running: $(basename $migration)"
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f "$migration"
    done

    echo -e "${GREEN}✓ Migrations completed${NC}"
}

backup_database() {
    echo -e "${YELLOW}Backing up RDS database...${NC}"
    BACKUP_DIR="/home/ubuntu/backups"
    DATE=$(date +%Y%m%d_%H%M%S)

    mkdir -p $BACKUP_DIR

    PGPASSWORD=$DB_PASSWORD pg_dump \
        -h $DB_HOST \
        -U $DB_USER \
        -d $DB_NAME \
        -F c \
        -f $BACKUP_DIR/db-$DATE.dump

    echo -e "${GREEN}✓ Database backed up to $BACKUP_DIR/db-$DATE.dump${NC}"
}

restore_database() {
    if [ -z "$1" ]; then
        echo -e "${RED}Error: Please specify backup file${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Restoring database from $1...${NC}"
    echo -e "${RED}WARNING: This will overwrite current database!${NC}"
    read -p "Continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled"
        exit 0
    fi

    PGPASSWORD=$DB_PASSWORD pg_restore \
        -h $DB_HOST \
        -U $DB_USER \
        -d $DB_NAME \
        -c \
        $1

    echo -e "${GREEN}✓ Database restored${NC}"
}

queue_statistics() {
    echo -e "${YELLOW}RabbitMQ Queue Statistics:${NC}"
    docker exec whatsapp-rabbitmq rabbitmqctl list_queues name messages consumers
}

redis_statistics() {
    echo -e "${YELLOW}Redis Statistics:${NC}"
    docker exec whatsapp-redis redis-cli info stats
    echo ""
    echo -e "${YELLOW}Redis Memory:${NC}"
    docker exec whatsapp-redis redis-cli info memory | grep "used_memory_human"
    echo ""
    echo -e "${YELLOW}Redis Keys:${NC}"
    docker exec whatsapp-redis redis-cli dbsize
}

nginx_reload() {
    if command -v nginx &> /dev/null; then
        echo -e "${YELLOW}Reloading Nginx...${NC}"
        sudo nginx -t && sudo systemctl reload nginx
        echo -e "${GREEN}✓ Nginx reloaded${NC}"
    else
        echo -e "${YELLOW}Nginx not installed${NC}"
    fi
}

ssl_renew() {
    if command -v certbot &> /dev/null; then
        echo -e "${YELLOW}Renewing SSL certificates...${NC}"
        sudo certbot renew
        sudo systemctl reload nginx
        echo -e "${GREEN}✓ SSL certificates renewed${NC}"
    else
        echo -e "${YELLOW}Certbot not installed${NC}"
    fi
}

start_monitoring() {
    echo -e "${YELLOW}Starting continuous monitoring...${NC}"
    echo "Press Ctrl+C to stop"
    echo ""

    while true; do
        clear
        echo -e "${GREEN}=== WABA System Monitor ===${NC}"
        echo -e "Last updated: $(date)"
        echo ""

        # Service health
        health_check

        # Queue stats
        echo ""
        echo -e "${YELLOW}Queue Depths:${NC}"
        docker exec whatsapp-rabbitmq rabbitmqctl list_queues name messages 2>/dev/null | tail -n +2

        # Memory usage
        echo ""
        echo -e "${YELLOW}System Resources:${NC}"
        echo "Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
        echo "Disk: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')"

        sleep 30
    done
}

# Main script logic
case "${1:-help}" in
    start)
        check_env
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "$2"
        ;;
    health)
        check_env
        health_check
        ;;
    backup)
        backup_volumes
        ;;
    restore)
        restore_volumes "$2"
        ;;
    update)
        update_application
        ;;
    clean)
        clean_all
        ;;
    scale)
        scale_service "$2" "$3"
        ;;
    db-migrate)
        check_env
        run_migrations
        ;;
    db-backup)
        check_env
        backup_database
        ;;
    db-restore)
        check_env
        restore_database "$2"
        ;;
    queue-stats)
        queue_statistics
        ;;
    redis-info)
        redis_statistics
        ;;
    nginx-reload)
        nginx_reload
        ;;
    ssl-renew)
        ssl_renew
        ;;
    monitor)
        check_env
        start_monitoring
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
