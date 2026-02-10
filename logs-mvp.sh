#!/bin/bash

###############################################################################
# WhatsApp-Genesys Integration MVP - Logs Viewer Script
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

LOG_DIR="/tmp"

# Function to show usage
show_usage() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║      WhatsApp-Genesys Integration MVP - Logs Viewer       ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo -e "  $0 [service-name|all]"
    echo ""
    echo -e "${YELLOW}Available services:${NC}"
    echo -e "  • state-manager"
    echo -e "  • tenant-service"
    echo -e "  • auth-service"
    echo -e "  • whatsapp-webhook"
    echo -e "  • inbound-transformer"
    echo -e "  • genesys-api"
    echo -e "  • genesys-webhook"
    echo -e "  • outbound-transformer"
    echo -e "  • whatsapp-api"
    echo -e "  • agent-portal-service"
    echo -e "  • agent-portal"
    echo -e "  • all (shows all logs interleaved)"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo -e "  $0 auth-service"
    echo -e "  $0 whatsapp-webhook"
    echo -e "  $0 all"
    echo ""
}

# Function to follow a specific log
follow_log() {
    local service=$1
    local log_file="$LOG_DIR/${service}.log"

    if [ -f "$log_file" ]; then
        echo -e "${GREEN}Following logs for: ${service}${NC}"
        echo -e "${YELLOW}Log file: ${log_file}${NC}"
        echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
        echo ""
        tail -f "$log_file"
    else
        echo -e "${RED}Error: Log file not found: $log_file${NC}"
        echo -e "${YELLOW}Service may not be running or hasn't generated logs yet${NC}"
        exit 1
    fi
}

# Function to follow all logs
follow_all_logs() {
    echo -e "${GREEN}Following all service logs...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""

    # Use multitail if available, otherwise use tail -f
    if command -v multitail &> /dev/null; then
        multitail \
            -l "tail -f $LOG_DIR/state-manager.log" \
            -l "tail -f $LOG_DIR/tenant-service.log" \
            -l "tail -f $LOG_DIR/auth-service.log" \
            -l "tail -f $LOG_DIR/whatsapp-webhook.log" \
            -l "tail -f $LOG_DIR/inbound-transformer.log" \
            -l "tail -f $LOG_DIR/genesys-api.log" \
            -l "tail -f $LOG_DIR/genesys-webhook.log" \
            -l "tail -f $LOG_DIR/outbound-transformer.log" \
            -l "tail -f $LOG_DIR/whatsapp-api.log" \
            -l "tail -f $LOG_DIR/agent-portal-service.log" \
            -l "tail -f $LOG_DIR/agent-portal.log"
    else
        tail -f $LOG_DIR/state-manager.log \
               $LOG_DIR/tenant-service.log \
               $LOG_DIR/auth-service.log \
               $LOG_DIR/whatsapp-webhook.log \
               $LOG_DIR/inbound-transformer.log \
               $LOG_DIR/genesys-api.log \
               $LOG_DIR/genesys-webhook.log \
               $LOG_DIR/outbound-transformer.log \
               $LOG_DIR/whatsapp-api.log \
               $LOG_DIR/agent-portal-service.log \
               $LOG_DIR/agent-portal.log
    fi
}

# Main execution
if [ $# -eq 0 ]; then
    show_usage
    exit 0
fi

SERVICE=$1

case $SERVICE in
    state-manager|tenant-service|auth-service|whatsapp-webhook|\
    inbound-transformer|genesys-api|genesys-webhook|outbound-transformer|\
    whatsapp-api|agent-portal-service|agent-portal)
        follow_log "$SERVICE"
        ;;
    all)
        follow_all_logs
        ;;
    --help|-h)
        show_usage
        ;;
    *)
        echo -e "${RED}Error: Unknown service: $SERVICE${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac
