
import os
import sys
import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone

COINGECKO_TREASURY_URL = "https://www.coingecko.com/de/treasuries/bittensor"
CF_API_TOKEN = os.getenv("CF_API_TOKEN")
CF_ACCOUNT_ID = os.getenv("CF_ACCOUNT_ID")
CF_KV_NAMESPACE_ID = os.getenv("CF_KV_NAMESPACE_ID")
KV_KEY = "treasury_data"  # Hardcoded key for Cloudflare KV

def fetch_treasury_data():
    response = requests.get(COINGECKO_TREASURY_URL)
    soup = BeautifulSoup(response.text, "html.parser")
    table = soup.find("table")
    if not table:
        return None
    data = []
    for row in table.find_all("tr")[1:]:  # skip header
        cols = row.find_all("td")
        if len(cols) < 2:
            continue
        treasury = {
            "address": cols[0].get_text(strip=True),
            "amount": cols[1].get_text(strip=True)
        }
        data.append(treasury)
    return {
        "treasury": data,
        "_source": "coingecko",
        "_timestamp": datetime.now(timezone.utc).isoformat()
    }

def write_to_cf_kv(data):
    if not (CF_API_TOKEN and CF_ACCOUNT_ID and CF_KV_NAMESPACE_ID):
        print("❌ Cloudflare KV credentials missing", file=sys.stderr)
        sys.exit(1)
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/storage/kv/namespaces/{CF_KV_NAMESPACE_ID}/values/{KV_KEY}"
    headers = {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "application/json"
    }
    resp = requests.put(url, headers=headers, data=json.dumps(data))
    if resp.status_code == 200:
        print(f"✅ Treasury data written to Cloudflare KV: key={KV_KEY}", file=sys.stderr)
    else:
        print(f"❌ Failed to write to Cloudflare KV: {resp.status_code} {resp.text}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    result = fetch_treasury_data()
    if result:
        # Write to Cloudflare KV
        write_to_cf_kv(result)
        # Write to local JSON file (for workflow artifact or debugging)
        with open("treasury_data.json", "w") as f:
            json.dump(result, f, indent=2)
        print(f"✅ Treasury data written to Cloudflare KV and treasury_data.json", file=sys.stderr)
        print(json.dumps(result, indent=2))
    else:
        print("❌ No treasury data found.", file=sys.stderr)
        sys.exit(1)
