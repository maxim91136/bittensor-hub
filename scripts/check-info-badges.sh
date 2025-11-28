#!/usr/bin/env bash
set -euo pipefail
echo "Running info-badge translation attribute check..."
bad=0
while IFS= read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  lineno=$(echo "$line" | cut -d: -f2)
  linetext=$(sed -n "${lineno}p" "$file")
  if ! echo "$linetext" | grep -q 'translate="no"'; then
    printf "Found info-badge missing translate=\"no\" at %s:%s\n" "$file" "$lineno"
    bad=1
  fi
done < <(grep -R --line-number 'class\="info-badge"' . || true)

echo "Checking halving and price pills..."
while IFS= read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  lineno=$(echo "$line" | cut -d: -f2)
  linetext=$(sed -n "${lineno}p" "$file")
  if ! echo "$linetext" | grep -q 'translate="no"'; then
    printf "Found pill missing translate=\"no\" at %s:%s\n" "$file" "$lineno"
    bad=1
  fi
done < <(grep -R --line-number 'class\="halving-pill\|class\="price-pill' . || true)

if [[ $bad -eq 1 ]]; then
  echo "Check failed: one or more info-badge instances are missing translate=\"no\""
  exit 1
fi
echo "Check passed: all info-badge instances include translate=\"no\""
