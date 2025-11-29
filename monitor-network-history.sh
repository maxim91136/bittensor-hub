#!/bin/bash
# Network History Collection Dashboard
# Real-time monitoring with watch command support
# Usage: ./monitor-network-history.sh (runs once) or watch -n 60 ./monitor-network-history.sh (every 60s)

set -e

# Get credentials from environment or .env file
if [ -f .env ]; then
  source .env
fi

CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-}"
CF_API_TOKEN="${CF_API_TOKEN:-}"
CF_KV_NAMESPACE_ID="${CF_KV_NAMESPACE_ID:-}"
CF_WORKER_URL="${CF_WORKER_URL:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

clear_screen() {
  # Clear if running under watch
  if [ -n "$WATCH_PID" ]; then
    clear
  fi
}

print_header() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC}  Network History Collection Dashboard                   ${BLUE}║${NC}"
  echo -e "${BLUE}║${NC}  $(date -u +'%Y-%m-%d %H:%M:%S UTC')                                   ${BLUE}║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
}

check_credentials() {
  if [ -z "$CF_ACCOUNT_ID" ] || [ -z "$CF_API_TOKEN" ] || [ -z "$CF_KV_NAMESPACE_ID" ]; then
    echo -e "${RED}❌ Missing Cloudflare credentials${NC}"
    echo "   Set environment variables or create .env file:"
    echo "   - CF_ACCOUNT_ID"
    echo "   - CF_API_TOKEN"
    echo "   - CF_KV_NAMESPACE_ID"
    return 1
  fi
  return 0
}

get_kv_data() {
  local key=$1
  local url="https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}/values/${key}"
  curl -s -H "Authorization: Bearer ${CF_API_TOKEN}" "$url" 2>/dev/null || echo ""
}

format_bytes() {
  local bytes=$1
  if command -v numfmt &> /dev/null; then
    numfmt --to=iec-i --suffix=B "$bytes" 2>/dev/null || echo "${bytes}B"
  else
    # Fallback if numfmt not available
    if [ "$bytes" -lt 1024 ]; then
      echo "${bytes}B"
    elif [ "$bytes" -lt 1048576 ]; then
      echo "$((bytes / 1024))KB"
    else
      echo "$((bytes / 1048576))MB"
    fi
  fi
}

main() {
  clear_screen
  print_header
  echo ""
  
  if ! check_credentials; then
    return 1
  fi
  
  # Fetch KV data
  echo -e "${CYAN}Fetching data from KV...${NC}"
  HIST=$(get_kv_data "network_history")
  LATEST=$(get_kv_data "network_latest")
  
  # Parse history
  if [ -n "$HIST" ]; then
    HIST_SIZE=$(echo "$HIST" | wc -c)
    HIST_COUNT=$(echo "$HIST" | jq 'length' 2>/dev/null || echo 0)
    FIRST_TS=$(echo "$HIST" | jq -r '.[0]._timestamp // "unknown"' 2>/dev/null)
    LAST_TS=$(echo "$HIST" | jq -r '.[-1]._timestamp // "unknown"' 2>/dev/null)
  else
    HIST_SIZE=0
    HIST_COUNT=0
    FIRST_TS="—"
    LAST_TS="—"
  fi
  
  # Parse latest
  if [ -n "$LATEST" ]; then
    LATEST_TS=$(echo "$LATEST" | jq -r '._timestamp // "—"' 2>/dev/null)
    BLK_HEIGHT=$(echo "$LATEST" | jq -r '.blockHeight // "—"' 2>/dev/null)
    VALIDATORS=$(echo "$LATEST" | jq -r '.validators // "—"' 2>/dev/null)
    SUBNETS=$(echo "$LATEST" | jq -r '.subnets // "—"' 2>/dev/null)
    EMISSION_7D=$(echo "$LATEST" | jq -r '.emission_7d // "—"' 2>/dev/null)
  else
    LATEST_TS="—"
    BLK_HEIGHT="—"
    VALIDATORS="—"
    SUBNETS="—"
    EMISSION_7D="—"
  fi
  
  # Display history status
  echo -e "${CYAN}📊 History Status${NC}"
  echo -e "   Entries:        ${GREEN}$HIST_COUNT${NC}"
  echo -e "   Size:           ${GREEN}$(format_bytes $HIST_SIZE)${NC}"
  echo -e "   First snapshot: ${BLUE}$FIRST_TS${NC}"
  echo -e "   Last snapshot:  ${BLUE}$LAST_TS${NC}"
  
  if [ "$HIST_COUNT" -gt 0 ]; then
    DAYS=$((HIST_COUNT / 96))
    echo -e "   Est. days:      ${GREEN}~$DAYS days${NC}"
  fi
  
  echo ""
  echo -e "${CYAN}📈 Latest Metrics${NC}"
  echo -e "   Timestamp:      ${BLUE}$LATEST_TS${NC}"
  echo -e "   BlockHeight:    ${GREEN}$BLK_HEIGHT${NC}"
  echo -e "   Validators:     ${GREEN}$VALIDATORS${NC}"
  echo -e "   Subnets:        ${GREEN}$SUBNETS${NC}"
  echo -e "   Emission (7d):  ${GREEN}$EMISSION_7D${NC}"
  
  # Storage projection
  echo ""
  echo -e "${CYAN}💾 Storage Projection${NC}"
  if [ "$HIST_COUNT" -gt 0 ]; then
    BYTES_PER_ENTRY=$((HIST_SIZE / HIST_COUNT))
    ENTRIES_PER_YEAR=$((96 * 365))
    PROJECTED_SIZE=$((BYTES_PER_ENTRY * ENTRIES_PER_YEAR))
    YEARS_FIT=$(( (104857600 / BYTES_PER_ENTRY) / ENTRIES_PER_YEAR ))
    
    echo -e "   Bytes/entry:    ${BLUE}~$BYTES_PER_ENTRY B${NC}"
    echo -e "   Annual growth:  ${GREEN}$(format_bytes $PROJECTED_SIZE)${NC}"
    echo -e "   Retention:      ${GREEN}~$YEARS_FIT years${NC} (at 100MB KV limit)"
  else
    echo -e "   ${YELLOW}⏳ Waiting for data...${NC}"
  fi
  
  # API endpoint test (if worker URL provided)
  echo ""
  echo -e "${CYAN}🌐 API Endpoint${NC}"
  if [ -n "$CF_WORKER_URL" ]; then
    API_TEST=$(curl -s -w "%{http_code}" -o /dev/null "${CF_WORKER_URL}/api/network/history" 2>/dev/null || echo "000")
    if [ "$API_TEST" -eq 200 ]; then
      echo -e "   Status:         ${GREEN}✅ 200 OK${NC}"
    elif [ "$API_TEST" -eq 404 ]; then
      echo -e "   Status:         ${YELLOW}⏳ 404 Not Found${NC}"
      echo -e "                   ${YELLOW}(history data not available yet)${NC}"
    else
      echo -e "   Status:         ${RED}❌ $API_TEST${NC}"
    fi
  else
    echo -e "   Status:         ${YELLOW}ℹ️ CF_WORKER_URL not set${NC}"
  fi
  
  # Workflow status (if gh CLI available)
  echo ""
  echo -e "${CYAN}⚙️  Workflow Status${NC}"
  if command -v gh &> /dev/null; then
    LAST_RUN=$(gh run list -w publish-network.yml --limit 1 --json status,conclusion,updatedAt 2>/dev/null | jq -r '.[0] | "\(.status) (\(.conclusion // "running")) - \(.updatedAt)"' 2>/dev/null || echo "Could not fetch")
    echo -e "   Last run:       $LAST_RUN"
  else
    echo -e "   ${YELLOW}ℹ️ gh CLI not installed${NC}"
  fi
  
  # Recommendations
  echo ""
  echo -e "${CYAN}💡 Recommendations${NC}"
  if [ "$HIST_COUNT" -eq 0 ]; then
    echo -e "   ${YELLOW}⏳ Collection just started${NC}"
    echo -e "   • Check back in 15 minutes for first data"
    echo -e "   • Run: ${BLUE}watch -n 60 $0${NC} (to monitor every 60s)"
  elif [ "$HIST_COUNT" -lt 96 ]; then
    MINUTES=$((HIST_COUNT * 15))
    echo -e "   ${YELLOW}⏳ Still collecting early data${NC}"
    echo -e "   • Currently collecting for ~${MINUTES} minutes"
    echo -e "   • Come back after ~1 week for Phase 4"
  else
    echo -e "   ${GREEN}✅ Ready for next phase${NC}"
    if [ "$HIST_COUNT" -ge 672 ]; then
      echo -e "   • You have ~7 days of data"
      echo -e "   • Proceed to Phase 4 (Frontend charting)"
    fi
  fi
  
  echo ""
}

main
