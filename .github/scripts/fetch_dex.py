# CoinMarketCap DEX API fetcher for Bittensor-Labs
# Fetches TAO DEX trading data (pairs, volume, trades)
# Uses CMC_API_TOKEN secret - DEX API has 1M credits/month

import os
import sys
import json
import requests
from datetime import datetime, timezone

CMC_DEX_URL = "https://pro-api.coinmarketcap.com"

def get_headers(api_key):
    return {
        "X-CMC_PRO_API_KEY": api_key,
        "Accept": "application/json"
    }

def fetch_tao_dex_pairs(api_key):
    """Fetch wTAO trading pairs on DEXes (Uniswap)"""
    # wTAO is the wrapped version of TAO on Ethereum
    # Contract: 0x77E06c9eCCf2E797fd462A92B6D7642EF85b0A44
    # Known Uniswap pools:
    WTAO_POOLS = [
        "0x433a00819c771b33fa7223a5b3499b24fbcd1bbc",  # wTAO/WETH
        "0xf763Bb342eB3d23C02ccB86312422fe0c1c17E94",  # wTAO/USDC
    ]

    url = f"{CMC_DEX_URL}/v4/dex/pairs/quotes/latest"
    all_pairs = []

    for pool_address in WTAO_POOLS:
        params = {
            "network_slug": "ethereum",
            "contract_address": pool_address
        }
        try:
            resp = requests.get(url, headers=get_headers(api_key), params=params, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                if data and 'data' in data:
                    pairs = data['data']
                    if isinstance(pairs, list):
                        all_pairs.extend(pairs)
                    elif isinstance(pairs, dict):
                        all_pairs.append(pairs)
        except Exception as e:
            print(f"Error fetching pool {pool_address}: {e}", file=sys.stderr)

    return all_pairs

def fetch_tao_trades(api_key, pair_id):
    """Fetch latest trades for a TAO pair"""
    url = f"{CMC_DEX_URL}/v4/dex/pairs/trade/latest"
    params = {
        "id": pair_id,
        "limit": 50
    }
    resp = requests.get(url, headers=get_headers(api_key), params=params, timeout=30)
    if resp.status_code != 200:
        raise Exception(f"DEX Trades API error: {resp.status_code} - {resp.text}")
    data = resp.json()
    if not data or 'data' not in data:
        raise Exception("No data in DEX Trades response")
    return data['data']

def fetch_dex_networks(api_key):
    """Fetch list of supported DEX networks"""
    url = f"{CMC_DEX_URL}/v4/dex/networks/list"
    resp = requests.get(url, headers=get_headers(api_key), timeout=15)
    if resp.status_code != 200:
        raise Exception(f"DEX Networks API error: {resp.status_code} - {resp.text}")
    data = resp.json()
    if not data or 'data' not in data:
        raise Exception("No data in DEX Networks response")
    return data['data']

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
    # Environment variables
    cmc_key = os.getenv('CMC_API_TOKEN')
    account_id = os.getenv('CF_ACCOUNT_ID')
    cf_token = os.getenv('CF_API_TOKEN')
    namespace_id = os.getenv('CF_METRICS_NAMESPACE_ID')

    if not cmc_key:
        print("CMC_API_TOKEN not set", file=sys.stderr)
        sys.exit(1)
    if not (account_id and cf_token and namespace_id):
        print("Missing Cloudflare KV credentials", file=sys.stderr)
        sys.exit(1)

    now_iso = datetime.now(timezone.utc).isoformat()
    results = {}

    # Fetch wTAO DEX pairs (Uniswap pools)
    try:
        pairs = fetch_tao_dex_pairs(cmc_key)

        # Process pairs - extract key info
        processed_pairs = []
        total_volume_24h = 0
        for pair in pairs:
            # Handle different API response formats
            volume = pair.get('volume_24h') or pair.get('volume', {}).get('h24', 0) or 0
            liquidity = pair.get('liquidity_usd') or pair.get('liquidity', {}).get('usd', 0) or 0
            price_usd = pair.get('price_usd') or pair.get('price', {}).get('usd', 0)
            total_volume_24h += float(volume) if volume else 0

            processed_pairs.append({
                'id': pair.get('id') or pair.get('pair_id'),
                'name': pair.get('name') or f"{pair.get('base_asset_symbol', 'wTAO')}/{pair.get('quote_asset_symbol', '?')}",
                'dex': pair.get('dex_name') or pair.get('exchange', {}).get('name') or 'Uniswap',
                'network': pair.get('network_name') or 'Ethereum',
                'base_symbol': pair.get('base_asset_symbol') or 'wTAO',
                'quote_symbol': pair.get('quote_asset_symbol'),
                'price_usd': price_usd,
                'volume_24h': volume,
                'liquidity': liquidity,
                'price_change_24h': pair.get('price_change_24h') or pair.get('price_change', {}).get('h24')
            })

        results['pairs'] = processed_pairs
        results['total_volume_24h'] = total_volume_24h
        results['pair_count'] = len(pairs)
        print(f"DEX: Found {len(pairs)} TAO pairs, top 10 volume: ${total_volume_24h:,.0f}")

        # Fetch trades for the top pair if available
        if processed_pairs and processed_pairs[0].get('id'):
            try:
                top_pair_id = processed_pairs[0]['id']
                trades_data = fetch_tao_trades(cmc_key, top_pair_id)
                trades = trades_data if isinstance(trades_data, list) else trades_data.get('trades', [])

                # Process trades - extract key info
                processed_trades = []
                for trade in trades[:20]:  # Last 20 trades
                    processed_trades.append({
                        'timestamp': trade.get('timestamp') or trade.get('block_timestamp'),
                        'side': trade.get('side') or trade.get('type'),
                        'amount': trade.get('amount') or trade.get('base_amount'),
                        'price_usd': trade.get('price_usd'),
                        'value_usd': trade.get('value_usd') or trade.get('quote_amount'),
                        'tx_hash': trade.get('tx_hash')
                    })

                results['recent_trades'] = {
                    'pair_id': top_pair_id,
                    'pair_name': processed_pairs[0].get('name'),
                    'trades': processed_trades
                }
                print(f"DEX: Fetched {len(processed_trades)} recent trades for {processed_pairs[0].get('name')}")
            except Exception as e:
                print(f"DEX trades fetch failed: {e}", file=sys.stderr)
                results['recent_trades'] = None
    except Exception as e:
        print(f"DEX pairs fetch failed: {e}", file=sys.stderr)
        results['pairs'] = []
        results['total_volume_24h'] = 0
        results['pair_count'] = 0

    # Add metadata
    results['_timestamp'] = now_iso
    results['_source'] = 'coinmarketcap_dex'

    # Store in KV
    ok = put_kv_json(account_id, cf_token, namespace_id, 'dex_data', results)
    if not ok:
        print("Failed to write DEX data to KV", file=sys.stderr)
        sys.exit(1)

    print("DEX data updated in KV.")

if __name__ == "__main__":
    main()
