#!/bin/bash
# Monitor Network History Collection
# Usage: ./monitor-network-history.sh
# Requires: CF_ACCOUNT_ID, CF_API_TOKEN, CF_KV_NAMESPACE_ID environment variables

set -e

CF_ACCOUNT_ID="${CF_ACCOUNT_ID}"
CF_API_TOKEN="${CF_API_TOKEN}"
CF_KV_NAMESPACE_ID="${CF_KV_NAMESPACE_ID}"

if [ -z "$CF_ACCOUNT_ID" ] || [ -z "$CF_API_TOKEN" ] || [ -z "$CF_KV_NAMESPACE_ID" ]; then
  echo "❌ Missing Cloudflare credentials"
  echo "   Set: CF_ACCOUNT_ID, CF_API_TOKEN, CF_KV_NAMESPACE_ID"
  exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Network History Monitoring ===${NC}"
echo "Timestamp: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo ""

# 1. Check KV Namespace Accessibility
echo -e "${BLUE}1. Checking KV Namespace...${NC}"
KV_URL="https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}"
KV_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${CF_API_TOKEN}" "$KV_URL" || echo "000")
if [ "$KV_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✅ KV Namespace accessible${NC}"
else
  echo -e "${RED}❌ KV Namespace error (HTTP $KV_STATUS)${NC}"
  exit 1
fi

# 2. Check network_history size
echo ""
echo -e "${BLUE}2. Checking network_history size...${NC}"
HIST_URL="${KV_URL}/values/network_history?metadata=true"
METADATA=$(curl -s -H "Authorization: Bearer ${CF_API_TOKEN}" "$HIST_URL" | jq -r '.result.metadata.cacheControl // "none"' 2>/dev/null || echo "error")
HIST_VALUE=$(curl -s -H "Authorization: Bearer ${CF_API_TOKEN}" "${KV_URL}/values/network_history" 2>/dev/null || echo "")

if [ -z "$HIST_VALUE" ]; then
  echo -e "${YELLOW}⏳ No network_history yet (first run)${NC}"
  HIST_SIZE=0
  HIST_COUNT=0
else
  HIST_SIZE=$(echo "$HIST_VALUE" | wc -c)
  HIST_COUNT=$(echo "$HIST_VALUE" | jq '. | length' 2>/dev/null || echo "?")
  echo -e "${GREEN}✅ network_history found${NC}"
  echo "   Size: $(numfmt --to=iec-i --suffix=B $HIST_SIZE 2>/dev/null || echo "${HIST_SIZE} bytes")"
  echo "   Entries: $HIST_COUNT"
  
  # Show timestamp range
  FIRST_TS=$(echo "$HIST_VALUE" | jq -r '.[0]._timestamp // "unknown"' 2>/dev/null)
  LAST_TS=$(echo "$HIST_VALUE" | jq -r '.[-1]._timestamp // "unknown"' 2>/dev/null)
  echo "   First: $FIRST_TS"
  echo "   Last:  $LAST_TS"
fi

# 3. Check network_latest
echo ""
echo -e "${BLUE}3. Checking network_latest...${NC}"
LATEST=$(curl -s -H "Authorization: Bearer ${CF_API_TOKEN}" "${KV_URL}/values/network_latest" 2>/dev/null || echo "")
if [ -z "$LATEST" ]; then
  echo -e "${YELLOW}⏳ No network_latest yet${NC}"
else
  LATEST_TS=$(echo "$LATEST" | jq -r '._timestamp // "unknown"' 2>/dev/null)
  BLK_HEIGHT=$(echo "$LATEST" | jq -r '.blockHeight // "?"' 2>/dev/null)
  VALIDATORS=$(echo "$LATEST" | jq -r '.validators // "?"' 2>/dev/null)
  SUBNETS=$(echo "$LATEST" | jq -r '.subnets // "?"' 2>/dev/null)
  echo -e "${GREEN}✅ network_latest found${NC}"
  echo "   Timestamp: $LATEST_TS"
  echo "   BlockHeight: $BLK_HEIGHT"
  echo "   Validators: $VALIDATORS"
  echo "   Subnets: $SUBNETS"
fi

# 4. Check if API endpoint is accessible
echo ""
echo -e "${BLUE}4. Checking API endpoint availability...${NC}"
# Try to fetch from production API if CF_WORKER_URL is set
if [ -n "$CF_WORKER_URL" ]; then
  API_TEST=$(curl -s -w "%{http_code}" "${CF_WORKER_URL}/api/network/history" 2>/dev/null || echo "error")
  HTTP_CODE=$(echo "$API_TEST" | tail -c 4)
  if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ API endpoint responding (HTTP 200)${NC}"
  elif [ "$HTTP_CODE" -eq 404 ]; then
    echo -e "${YELLOW}⏳ API endpoint 404 (history not available yet)${NC}"
  else
    echo -e "${YELLOW}⚠️  API endpoint HTTP $HTTP_CODE${NC}"
  fi
else
  echo -e "${YELLOW}ℹ️  CF_WORKER_URL not set, skipping API test${NC}"
fi

# 5. Workflow run status
echo ""
echo -e "${BLUE}5. Latest publish-network.yml workflow run...${NC}"
if command -v gh &> /dev/null; then
  LAST_RUN=$(gh run list -w publish-network.yml --limit 1 --json status,conclusion,updatedAt,name 2>/dev/null | jq -r '.[0] | "\(.status) (\(.conclusion // "running")) - \(.updatedAt)"' || echo "Could not fetch")
  echo "   $LAST_RUN"
else
  echo "   gh CLI not available (install GitHub CLI for run status)"
fi

# 6. Summary & Recommendations
echo ""
echo -e "${BLUE}=== Summary ===${NC}"
if [ "$HIST_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✅ Data collection active${NC}"
  DAYS=$((HIST_COUNT / 96))  # ~96 entries per day (15min intervals)
  echo "   Estimated days of data: ~$DAYS days"
  if [ "$DAYS" -gt 7 ]; then
    echo -e "${GREEN}✅ Sufficient data for Phase 4 (Frontend)${NC}"
  fi
else
  echo -e "${YELLOW}⏳ Waiting for first collection run${NC}"
  echo "   Workflow runs every 15 minutes"
  echo "   Expected first data in ~15 minutes"
fi

# 7. Storage projection
echo ""
echo -e "${BLUE}=== Storage Projection ===${NC}"
if [ "$HIST_SIZE" -gt 0 ] && [ "$HIST_COUNT" -gt 0 ]; then
  BYTES_PER_ENTRY=$((HIST_SIZE / HIST_COUNT))
  ENTRIES_PER_YEAR=$((96 * 365))
  PROJECTED_SIZE=$((BYTES_PER_ENTRY * ENTRIES_PER_YEAR))
  echo "   Bytes per entry: ~$BYTES_PER_ENTRY"
  echo "   Entries per year: ~$ENTRIES_PER_YEAR (15min sampling)"
  echo "   Annual storage: ~$(numfmt --to=iec-i --suffix=B $PROJECTED_SIZE 2>/dev/null || echo "${PROJECTED_SIZE} bytes")"
  echo "   KV limit: 100 MB (typical)"
  echo "   Retention years: ~$(( (104857600 / BYTES_PER_ENTRY) / ENTRIES_PER_YEAR))"
fi

echo ""
echo -e "${BLUE}=== Next Steps ===${NC}"
echo "- Monitor for ~1 week to collect baseline data"
echo "- Then proceed to Phase 4 (Frontend charting)"
echo "- Run this script regularly to track collection health"
