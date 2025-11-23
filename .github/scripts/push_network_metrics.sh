#!/usr/bin/env bash
set -euo pipefail
if [ ! -f network.json ]; then
  echo "No network.json found; nothing to push" >&2
  exit 1
fi
if [ -z "${CF_ACCOUNT_ID:-}" ] || [ -z "${CF_API_TOKEN:-}" ] || [ -z "${CF_KV_NAMESPACE_ID:-}" ]; then
  echo "CF env not configured; failing to avoid silent skips" >&2
  exit 1
fi
URL="https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}/values/metrics"
HTTP_STATUS=$(curl -s -o /tmp/network_push_out -w "%{http_code}" -X PUT "$URL" -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" --data-binary @network.json || true)
if [ "$HTTP_STATUS" != "200" ] && [ "$HTTP_STATUS" != "204" ]; then
  echo "Failed to push metrics to Cloudflare KV: HTTP $HTTP_STATUS" >&2
  cat /tmp/network_push_out || true
  exit 1
fi
echo "OK: metrics pushed to Cloudflare KV"
