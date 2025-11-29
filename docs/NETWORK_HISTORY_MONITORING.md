# Network History Monitoring Guide

## Setup

### Requirements
- `curl`, `jq` (JSON parsing)
- Cloudflare API credentials (secrets set)
- Optional: GitHub CLI (`gh`) for workflow status
- Optional: `watch` command for continuous monitoring

### Environment Variables

Set these before running monitoring scripts:

```bash
export CF_ACCOUNT_ID="your-account-id"
export CF_API_TOKEN="your-api-token"
export CF_KV_NAMESPACE_ID="your-namespace-id"
export CF_WORKER_URL="https://your-worker.example.com" # Optional, for API endpoint test
```

Or create a `.env` file in the repo root:

```bash
CF_ACCOUNT_ID=...
CF_API_TOKEN=...
CF_KV_NAMESPACE_ID=...
CF_WORKER_URL=...
```

## Monitoring Scripts

### 1. Main Dashboard (Interactive)

```bash
# One-time check
./monitor-network-history.sh

# Continuous monitoring (every 60 seconds)
watch -n 60 ./monitor-network-history.sh

# Quick check (every 30 seconds)
watch -n 30 ./monitor-network-history.sh
```

**Output includes:**
- 📊 History status (entry count, size, timestamp range)
- 📈 Latest metrics (blockHeight, validators, subnets, emission)
- 💾 Storage projection (annual growth, retention years)
- 🌐 API endpoint status
- ⚙️ Workflow run status
- 💡 Recommendations

### 2. CI Script (Detailed Analytics)

```bash
.github/scripts/monitor-network-history.sh
```

Same data as main dashboard, suitable for CI/alerting integrations.

## Data Collection Timeline

| Time | Entries | Data Points | Status |
|------|---------|------------|--------|
| 15 min | 1 | Initial snapshot | Just started |
| 1 hour | 4 | Early testing | Validating |
| 1 day | 96 | Full daily cycle | Can check patterns |
| 7 days | 672 | Weekly trend | Ready for Phase 4 |
| 30 days | ~2880 | Monthly average | Production-ready |

## KV Storage Monitoring

### Keys to Watch

- **`network_history`** - Main array of snapshots
  - Updated: Every 15 minutes (workflow runs)
  - Format: JSON array
  - Approx. size/entry: ~500B
  - Annual growth: ~250MB (exceeds 100MB KV limit)

- **`network_latest`** - Current snapshot (for appending)
  - Updated: Every 15 minutes
  - Format: JSON object
  - Size: ~1-2KB

### Size Calculations

```
15-minute intervals = 96 entries/day
= 345,600 entries/year
≈ 173 MB/year (at ~500B per entry)

KV typical limit: 100 MB
→ Retention: ~7-8 months without cleanup
```

**Action when approaching limit:**
- Archive old entries to R2 (already implemented)
- Implement cleanup policy (remove entries >90 days)
- Compress historical data if needed

## API Endpoint Testing

### Direct Test

```bash
# Get current history
curl -s https://your-worker.example.com/api/network/history | jq '.[] | ._timestamp' | head -5

# Count entries
curl -s https://your-worker.example.com/api/network/history | jq 'length'

# Latest entry
curl -s https://your-worker.example.com/api/network/history | jq '.[-1]'
```

### Expected Response

```json
[
  {
    "_timestamp": "2025-11-29T12:00:00Z",
    "blockHeight": 5284920,
    "validators": 1024,
    "subnets": 30,
    "emission_7d": 7241.5,
    "totalIssuanceHuman": 19432451.23,
    ...
  },
  ...
]
```

## Workflow Health Checks

### Using GitHub CLI

```bash
# Last 5 runs
gh run list -w publish-network.yml --limit 5

# Last run details
gh run list -w publish-network.yml --limit 1 --json status,conclusion,updatedAt,name

# Follow live run
gh run watch -w publish-network.yml
```

### Using GitHub Web UI

1. Go to: https://github.com/maxim91136/bittensor-labs/actions
2. Select: `publish-network.yml`
3. Monitor runs every 15 minutes

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Workflow fails | Python/bittensor error | Check logs, retry |
| KV writes fail | Namespace full | Archive to R2 or cleanup |
| API returns 404 | History not started | Wait 15 min for first run |
| API slow | Large KV payload | Consider pagination in v2 |

## R2 Archival Monitoring

If `ENABLE_R2` secret is set, per-run snapshots are saved:

```
network_entry-20251129T120000Z.json
network_entry-20251129T120100Z.json
...
```

### Track Archival

```bash
# List R2 files (requires AWS CLI with R2 creds)
aws s3 ls s3://your-bucket/bittensor/ --recursive | grep network_entry

# Count archived entries
aws s3 ls s3://your-bucket/bittensor/ --recursive | grep -c network_entry
```

## Checklist: First Week

- [ ] **Day 1**: Verify first workflow run completes
- [ ] **Day 1-2**: Confirm `network_latest` is written to KV
- [ ] **Day 1-2**: Check API endpoint returns data
- [ ] **Day 2**: Verify `network_history` is being appended
- [ ] **Day 3**: Run monitor script, check entry count > 300
- [ ] **Day 5**: Storage size stable, no KV errors
- [ ] **Day 7**: Entry count > 670, ready for Phase 4
- [ ] **Day 7**: Review data quality (no duplicates, monotonic timestamps)
- [ ] **Day 7**: Proceed to Phase 4 (Frontend charting)

## Next Steps

After ~1 week of collection:

### Phase 4: Frontend Charting
- Add charts to dashboard showing historical trends
- BlockHeight progression
- Emissions 7d/30d development
- Validators/Subnets growth

### Phase 5: Data Management
- Implement cleanup policy for old entries
- Archive entries >90 days to R2 long-term storage
- Monitor storage costs
- Plan data retention strategy

## Support

- **Issue**: KV full → Check `.github/workflows/publish-network.yml`, increase frequency of R2 cleanup
- **Issue**: High latency → Consider API pagination for large history arrays
- **Issue**: Data gaps → Check workflow logs in GitHub Actions
