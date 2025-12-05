#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/create_github_release.sh
# Requirements:
# - Either `gh` CLI installed and authenticated, or
# - Environment variable `GITHUB_TOKEN` (or `GH_TOKEN`) set for API access.

REPO="maxim91136/bittensor-labs"
TAG="v1.0.0-rc.21"
TITLE="$TAG"
NOTES_FILE="RELEASE_NOTES/v1.0.0-rc.21.md"

if command -v gh >/dev/null 2>&1; then
  echo "Found gh CLI — creating draft release using gh..."
  gh release create "$TAG" --title "$TITLE" --notes-file "$NOTES_FILE" --repo "$REPO" --draft
  echo "Draft release created with gh."
  exit 0
fi

TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [ -n "$TOKEN" ]; then
  echo "Using GITHUB_TOKEN to create draft release via API..."
  BODY=$(awk 'BEGIN{first=1} { if (!first) print "\n"; print $0; first=0 }' "$NOTES_FILE")
  # Use a minimal JSON payload. Keep body compact.
  PAYLOAD=$(jq -n --arg tag_name "$TAG" --arg name "$TITLE" --arg body "$BODY" '{tag_name: $tag_name, name: $name, body: $body, draft: true}')
  curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" \
    -d "$PAYLOAD" "https://api.github.com/repos/$REPO/releases" |
    jq '.html_url' || true
  echo "Draft release request sent."
  exit 0
fi

echo "Neither gh CLI found nor GITHUB_TOKEN/GH_TOKEN is set."
echo "You can create the release manually using the prepared notes file: $NOTES_FILE"
echo "Or install/authenticate gh CLI, or set GITHUB_TOKEN and re-run this script."
exit 2
