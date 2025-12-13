# DEX data fetcher for Bittensor-Labs
# Primary: DexScreener API (free, no key required)
# Fallback: CMC DEX API (1M credits/month)

import os
import sys
import json
import requests
from datetime import datetime, timezone

# wTAO contract address on Ethereum
WTAO_CONTRACT = "0x77E06c9eCCf2E797fd462A92B6D7642EF85b0A44"

def fetch_dexscreener_pairs():
    """Fetch wTAO pairs from DexScreener (free API, no key needed)"""
    url = f"https://api.dexscreener.com/latest/dex/tokens/{WTAO_CONTRACT}"
    resp = requests.get(url, timeout=15)
    if resp.status_code != 200:
        raise Exception(f"DexScreener API error: {resp.status_code}")
    data = resp.json()
    if not data or 'pairs' not in data:
        raise Exception("No pairs in DexScreener response")
    return data['pairs'], 'dexscreener'

def process_dexscreener_pairs(pairs):
    """Process DexScreener pairs into our standard format"""
    processed = []
    total_volume = 0
    total_liquidity = 0

    for pair in pairs:
        volume_24h = pair.get('volume', {}).get('h24', 0) or 0
        liquidity = pair.get('liquidity', {}).get('usd', 0) or 0
        total_volume += volume_24h
        total_liquidity += liquidity

        processed.append({
            'pair_address': pair.get('pairAddress'),
            'name': f"{pair.get('baseToken', {}).get('symbol', '?')}/{pair.get('quoteToken', {}).get('symbol', '?')}",
            'dex': pair.get('dexId', 'unknown'),
            'chain': pair.get('chainId', 'ethereum'),
            'price_usd': float(pair.get('priceUsd', 0) or 0),
            'volume_24h': volume_24h,
            'volume_6h': pair.get('volume', {}).get('h6', 0) or 0,
            'volume_1h': pair.get('volume', {}).get('h1', 0) or 0,
            'liquidity_usd': liquidity,
            'price_change_24h': pair.get('priceChange', {}).get('h24'),
            'price_change_6h': pair.get('priceChange', {}).get('h6'),
            'price_change_1h': pair.get('priceChange', {}).get('h1'),
            'txns_24h': pair.get('txns', {}).get('h24', {}),
            'fdv': pair.get('fdv'),
            'market_cap': pair.get('marketCap'),
            'url': pair.get('url')
        })

    return processed, total_volume, total_liquidity

def put_kv_json(account_id, api_token, namespace_id, key, obj):
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/{key}"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }
    data = json.dumps(obj)
    resp = requests.put(url, headers=headers, data=data.encode('utf-8'), timeout=30)
    return resp.status_code in (200, 204)

def main():
    # Environment variables (CMC key optional for DexScreener)
    account_id = os.getenv('CF_ACCOUNT_ID')
    cf_token = os.getenv('CF_API_TOKEN')
    namespace_id = os.getenv('CF_METRICS_NAMESPACE_ID')

    if not (account_id and cf_token and namespace_id):
        print("Missing Cloudflare KV credentials", file=sys.stderr)
        sys.exit(1)

    now_iso = datetime.now(timezone.utc).isoformat()
    results = {}

    # Fetch wTAO DEX pairs from DexScreener
    try:
        raw_pairs, source = fetch_dexscreener_pairs()
        processed_pairs, total_volume, total_liquidity = process_dexscreener_pairs(raw_pairs)

        # Sort by volume and take top pairs
        processed_pairs.sort(key=lambda x: x.get('volume_24h', 0), reverse=True)

        results['pairs'] = processed_pairs[:10]  # Top 10 pairs
        results['all_pairs_count'] = len(processed_pairs)
        results['total_volume_24h'] = total_volume
        results['total_liquidity'] = total_liquidity

        # Get the best price (highest liquidity pair)
        best_pair = max(processed_pairs, key=lambda x: x.get('liquidity_usd', 0)) if processed_pairs else None
        if best_pair:
            results['wtao_price'] = best_pair.get('price_usd')
            results['wtao_price_change_24h'] = best_pair.get('price_change_24h')
            results['wtao_market_cap'] = best_pair.get('market_cap')

        print(f"DEX: Found {len(processed_pairs)} wTAO pairs")
        print(f"DEX: Total volume 24h: ${total_volume:,.0f}")
        print(f"DEX: Total liquidity: ${total_liquidity:,.0f}")
        if best_pair:
            print(f"DEX: wTAO price: ${best_pair.get('price_usd'):.2f}")

        results['_source'] = source

    except Exception as e:
        print(f"DexScreener fetch failed: {e}", file=sys.stderr)
        results['pairs'] = []
        results['total_volume_24h'] = 0
        results['total_liquidity'] = 0
        results['_source'] = 'error'

    # Add metadata
    results['_timestamp'] = now_iso

    # Store in KV
    ok = put_kv_json(account_id, cf_token, namespace_id, 'dex_data', results)
    if not ok:
        print("Failed to write DEX data to KV", file=sys.stderr)
        sys.exit(1)

    print("DEX data updated in KV.")

if __name__ == "__main__":
    main()
