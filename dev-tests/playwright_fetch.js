const fs = require('fs');
const path = require('path');
// Attempt to require 'playwright' first; fall back to 'playwright-core' if needed
let playwright = null;
try { playwright = require('playwright'); } catch (e) { playwright = require('playwright-core'); }
const { chromium } = playwright;

const url = process.argv[2];
if (!url) {
  console.error('Usage: node playwright_fetch.js <URL>');
  process.exit(1);
}

(async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    // Increase timeout to handle slow responses and Cloudflare challenges
    page.setDefaultNavigationTimeout(120_000);
    const NAV_TIMEOUT = 120_000;
    const MAX_ATTEMPTS = 3;
  try {
    let response = null;
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Playwright navigation attempt ${attempt} failed: ${err && err.message || err}`);
        // If attempt is not last, wait a bit and retry
        if (attempt < MAX_ATTEMPTS) await new Promise(res => setTimeout(res, 2000 * attempt));
      }
    }
    if (!response && lastError) throw lastError;
    // Try to wait for networkidle briefly, but don't block indefinitely (short timeout)
    try { await page.waitForLoadState('networkidle', { timeout: 3000 }); } catch(e) { /* ignore */ }
    let text = await page.content();
    const preExists = await page.$('pre');
    if (preExists) {
      const preText = await page.$eval('pre', el => el.innerText);
      text = preText;
    } else {
      const bodyText = await page.$eval('body', el => el.innerText || el.innerHTML);
      text = bodyText;
    }
    fs.writeFileSync(path.resolve('/tmp', 'playwright_body'), text);
    // Detect Cloudflare challenge pages and return a specific status so CI can decide how to behave
    const lower = (text || '').toLowerCase();
    if (lower.includes('just a moment') || lower.includes('enable javascript and cookies') || lower.includes('please enable javascript')) {
      console.log('Detected Cloudflare-like challenge page');
      await browser.close();
      // Exit with a distinct code (2) but still write body so CI can inspect it
      process.exit(2);
    }
    const status = response ? response.status() : 599;
    console.log('Playwright status', status);
    await browser.close();
    // 0 success, 2 non-200 status (but body captured), 3 error
    process.exit(status === 200 ? 0 : 2);
  } catch (e) {
    console.error('Playwright fetch error', e && e.stack || e);
    await browser.close();
    process.exit(3);
  }
})();
