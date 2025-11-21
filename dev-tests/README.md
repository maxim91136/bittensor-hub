Playwright smoke test helper
===================================

This folder contains a small Playwright script to fetch the network API via a real browser (Chromium) to bypass JS-based anti-bot checks (e.g., Cloudflare).

Usage (locally):
```bash
# Install dependencies
cd dev-tests
npm install
# Download browser
npx playwright install chromium
# Run the script
node playwright_fetch.js "https://bittensor-labs.com/api/network"
cat /tmp/playwright_body
```

On GitHub Actions, the `smoke-test.yml` will install the dependencies and run this script automatically when curl-based attempts fail.
