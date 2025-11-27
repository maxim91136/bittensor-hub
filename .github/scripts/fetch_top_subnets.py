#!/usr/bin/env python3
"""Fetch top subnets by estimated emission and write JSON output.

This script estimates per-subnet daily emission proportional to neuron count.
It writes `.github/data/top_subnets.json` and, if Cloudflare KV env vars
are present, uploads the JSON into the `top_subnets` KV key.

Designed to be run from a GitHub Actions runner (mirrors other fetch_*.py).
"""
import os
import json
import sys
from typing import List, Dict
from datetime import datetime, timezone
import urllib.request
import urllib.error

NETWORK = os.getenv('NETWORK', 'finney')
DAILY_EMISSION = float(os.getenv('DAILY_EMISSION', '7200'))


def write_local(path: str, data: Dict[str, object]):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)


def put_to_kv(account: str, token: str, namespace: str, key: str, data: bytes) -> bool:
    url = f'https://api.cloudflare.com/client/v4/accounts/{account}/storage/kv/namespaces/{namespace}/values/{key}'
    req = urllib.request.Request(url, data=data, method='PUT', headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            if resp.status in (200, 201):
                print(f"✅ KV PUT OK ({key})")
                return True
            else:
                print(f"⚠️ KV PUT returned status {resp.status}", file=sys.stderr)
                return False
    except urllib.error.HTTPError as e:
        print(f"⚠️ KV PUT failed: HTTP {getattr(e, 'code', None)} - {e.read()}", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ KV PUT failed: {e}", file=sys.stderr)
    return False


def fetch_top_subnets() -> Dict[str, object]:
    try:
        import bittensor as bt
    except Exception as e:
        print('❌ bittensor import failed:', e, file=sys.stderr)
        raise

    subtensor = bt.subtensor(network=NETWORK)
    try:
        subnets = subtensor.get_subnets()
    except Exception as e:
        print('❌ Failed to fetch subnets:', e, file=sys.stderr)
        subnets = []

    results: List[Dict[str, object]] = []
    total_neurons = 0
    # First pass: collect neuron counts and validator counts
    for netuid in subnets:
        try:
            metagraph = subtensor.metagraph(netuid)
            uids = getattr(metagraph, 'uids', []) or []
            neurons = len(uids)
            total_neurons += neurons
            validators = 0
            if hasattr(metagraph, 'validator_permit'):
                validators = sum(1 for uid in uids if metagraph.validator_permit.get(uid))
            results.append({
                'netuid': int(netuid),
                'neurons': neurons,
                'validators': validators
            })
        except Exception as e:
            print(f'⚠️ metagraph fetch failed for netuid {netuid}: {e}', file=sys.stderr)
            continue

    # If no neurons found, return empty
    if total_neurons <= 0:
        print('⚠️ No neuron data available to compute emissions', file=sys.stderr)
        return {'generated_at': datetime.now(timezone.utc).isoformat(), 'top_subnets': []}

    # Compute estimated emission per subnet proportional to neuron share
    for entry in results:
        share = (entry['neurons'] / total_neurons) if total_neurons > 0 else 0.0
        est = share * DAILY_EMISSION
        entry['estimated_emission_daily'] = round(float(est), 6)

    # Sort and take top N (default 10)
    sorted_subnets = sorted(results, key=lambda x: x.get('estimated_emission_daily', 0.0), reverse=True)
    try:
        top_n = int(os.getenv('TOP_N', '10'))
    except Exception:
        top_n = 10
    top_n = max(1, top_n)
    top_list = sorted_subnets[:top_n]

    out = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'network': NETWORK,
        'daily_emission_assumed': DAILY_EMISSION,
        'total_neurons': total_neurons,
        'top_n': top_n,
        'top_subnets': top_list
    }
    return out


def main():
    out = fetch_top_subnets()
    out_path = os.path.join(os.getcwd(), '.github', 'data', 'top_subnets.json')
    write_local(out_path, out)
    print(f'Wrote {out_path}')

    # Attempt to push to Cloudflare KV if env present
    cf_acc = os.getenv('CF_ACCOUNT_ID')
    cf_token = os.getenv('CF_API_TOKEN')
    cf_ns = os.getenv('CF_KV_NAMESPACE_ID') or os.getenv('CF_METRICS_NAMESPACE_ID')
    if cf_acc and cf_token and cf_ns:
        print('Attempting KV PUT for top_subnets...')
        data = json.dumps(out).encode('utf-8')
        ok = put_to_kv(cf_acc, cf_token, cf_ns, 'top_subnets', data)
        if not ok:
            print('KV PUT failed; leaving local file only', file=sys.stderr)
    else:
        print('CF credentials missing; skipped KV PUT')


if __name__ == '__main__':
    main()
