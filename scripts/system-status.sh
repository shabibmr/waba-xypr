#!/bin/bash

# System Status Check - CPU, RAM, and Storage

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

threshold_warn=70
threshold_crit=90

color_usage() {
    local pct=$1
    if (( $(echo "$pct >= $threshold_crit" | bc -l) )); then
        echo -e "${RED}${pct}%${RESET}"
    elif (( $(echo "$pct >= $threshold_warn" | bc -l) )); then
        echo -e "${YELLOW}${pct}%${RESET}"
    else
        echo -e "${GREEN}${pct}%${RESET}"
    fi
}

echo -e "\n${BOLD}${CYAN}====== System Status Report ======${RESET}"
echo -e "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')\n"

# --- CPU ---
echo -e "${BOLD}CPU${RESET}"
cpu_idle=$(top -bn1 | grep "Cpu(s)" | awk '{print $8}' | tr -d '%')
cpu_used=$(echo "100 - $cpu_idle" | bc)
cpu_cores=$(nproc)
load_avg=$(uptime | awk -F'load average:' '{print $2}' | xargs)

echo -e "  Cores      : ${cpu_cores}"
echo -e "  Usage      : $(color_usage $cpu_used)"
echo -e "  Load Avg   : ${load_avg} (1m, 5m, 15m)"

# --- RAM ---
echo -e "\n${BOLD}RAM${RESET}"
read total used free shared bufcache available <<< $(free -m | awk '/^Mem:/ {print $2, $3, $4, $5, $6, $7}')
ram_pct=$(echo "scale=1; $used * 100 / $total" | bc)

echo -e "  Total      : ${total} MB"
echo -e "  Used       : ${used} MB ($(color_usage $ram_pct))"
echo -e "  Free       : ${free} MB"
echo -e "  Available  : ${available} MB"
echo -e "  Buf/Cache  : ${bufcache} MB"

# Swap
read stotal sused sfree <<< $(free -m | awk '/^Swap:/ {print $2, $3, $4}')
if [[ "$stotal" -gt 0 ]]; then
    swap_pct=$(echo "scale=1; $sused * 100 / $stotal" | bc)
    echo -e "  Swap       : ${sused}/${stotal} MB ($(color_usage $swap_pct))"
else
    echo -e "  Swap       : not configured"
fi

# --- Storage ---
echo -e "\n${BOLD}Storage${RESET}"
printf "  %-25s %8s %8s %8s %6s %s\n" "Filesystem" "Size" "Used" "Avail" "Use%" "Mount"
echo "  $(printf '%-25s %8s %8s %8s %6s %s' '-------------------------' '--------' '--------' '--------' '------' '-------------------')"

df -h --output=source,size,used,avail,pcent,target -x tmpfs -x devtmpfs -x squashfs 2>/dev/null | tail -n +2 | while read src size used avail pct mount; do
    pct_num=${pct//%/}
    colored_pct=$(color_usage $pct_num)
    printf "  %-25s %8s %8s %8s " "$src" "$size" "$used" "$avail"
    echo -e "${colored_pct}     ${mount}"
done

echo -e "\n${BOLD}${CYAN}==================================${RESET}\n"
