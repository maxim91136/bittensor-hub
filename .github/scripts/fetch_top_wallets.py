#!/usr/bin/env python3
"""
Fetch Top 10 Wallets by Total Balance from Taostats API.
Includes identity lookup for known addresses (exchanges, etc.)
"""

import os
import sys
import json
import requests
from datetime import datetime, timezone

TAOSTATS_API_KEY = os.getenv('TAOSTATS_API_KEY')
ACCOUNT_URL = "https://api.taostats.io/api/account/latest/v1"
IDENTITY_URL = "https://api.taostats.io/api/identity/v1"

def fetch_top_wallets(limit=10):
    """Fetch top wallets by total balance."""
    if not TAOSTATS_API_KEY:
        print("❌ TAOSTATS_API_KEY not set", file=sys.stderr)
        return None
    
    headers = {
        "accept": "application/json",
        "Authorization": TAOSTATS_API_KEY
    }
    
    try:
        # Fetch top accounts ordered by total balance descending
        url = f"{ACCOUNT_URL}?limit={limit}&order=balance_total_desc"
        print(f"📊 Fetching top {limit} wallets...", file=sys.stderr)
        
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        
        if not data.get("data"):
            print("❌ No account data returned", file=sys.stderr)
            return None
        
        accounts = data["data"]
        print(f"✅ Fetched {len(accounts)} accounts", file=sys.stderr)
        
        # Process accounts
        wallets = []
        for acc in accounts[:limit]:
            address = acc.get("address", {})
            ss58 = address.get("ss58", "")
            
            # Convert from rao to TAO (1 TAO = 1e9 rao)
            balance_total = float(acc.get("balance_total", 0)) / 1e9
            balance_free = float(acc.get("balance_free", 0)) / 1e9
            balance_staked = float(acc.get("balance_staked", 0)) / 1e9
            
            wallet = {
                "rank": acc.get("rank", 0),
                "address": ss58,
                "address_short": f"{ss58[:6]}...{ss58[-4:]}" if len(ss58) > 12 else ss58,
                "balance_total": round(balance_total, 2),
                "balance_free": round(balance_free, 2),
                "balance_staked": round(balance_staked, 2),
                "staked_percent": round((balance_staked / balance_total * 100) if balance_total > 0 else 0, 1),
                "identity": None  # Will be filled by identity lookup
            }
            wallets.append(wallet)
        
        return wallets
        
    except Exception as e:
        print(f"❌ Failed to fetch accounts: {e}", file=sys.stderr)
        return None


def fetch_identities(addresses):
    """Fetch on-chain identities for addresses."""
    if not TAOSTATS_API_KEY or not addresses:
        return {}
    
    headers = {
        "accept": "application/json",
        "Authorization": TAOSTATS_API_KEY
    }
    
    identities = {}
    
    # Known exchange addresses (fallback if no on-chain identity)
    known_addresses = {
        "5Hd2ze5ug8n1bo3UCAcQsf66VNjKqGos8u6apNfzcU86pg4N": "Binance",
        "5FZiuxCBt8p6PFDisJ9ZEbBaKNVKy6TeemVJd1Z6jscsdjib": "Kucoin",
        # Add more known addresses as needed
    }
    
    for addr in addresses:
        # Check known addresses first
        if addr in known_addresses:
            identities[addr] = known_addresses[addr]
            continue
        
        # Try to fetch on-chain identity
        try:
            url = f"{IDENTITY_URL}?address={addr}"
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.ok:
                data = resp.json()
                if data.get("data") and len(data["data"]) > 0:
                    identity = data["data"][0]
                    name = identity.get("display") or identity.get("name")
                    if name:
                        identities[addr] = name
        except Exception as e:
            print(f"⚠️ Identity lookup failed for {addr[:10]}...: {e}", file=sys.stderr)
    
    return identities


def calculate_dominance(wallets, circulating_supply=None):
    """Calculate dominance percentage for each wallet."""
    # If no supply provided, estimate from total of top wallets
    # (This is a rough estimate - ideally get from taostats API)
    if not circulating_supply:
        # Try to get from environment or use a reasonable estimate
        circulating_supply = float(os.getenv('CIRCULATING_SUPPLY', '10400000'))
    
    for wallet in wallets:
        wallet["dominance"] = round(
            (wallet["balance_total"] / circulating_supply * 100) if circulating_supply > 0 else 0, 
            2
        )
    
    return wallets


def main():
    # Fetch top 10 wallets
    wallets = fetch_top_wallets(10)
    
    if not wallets:
        print("❌ No wallet data fetched", file=sys.stderr)
        sys.exit(1)
    
    # Fetch identities for all addresses
    addresses = [w["address"] for w in wallets]
    identities = fetch_identities(addresses)
    
    # Apply identities to wallets
    for wallet in wallets:
        addr = wallet["address"]
        if addr in identities:
            wallet["identity"] = identities[addr]
    
    # Calculate dominance
    wallets = calculate_dominance(wallets)
    
    # Build result
    result = {
        "wallets": wallets,
        "_source": "taostats",
        "_timestamp": datetime.now(timezone.utc).isoformat(),
        "_count": len(wallets)
    }
    
    # Save to file
    output_file = "top_wallets.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=2)
    
    print(f"✅ Top wallets written to {output_file}", file=sys.stderr)
    
    # Print summary
    print("\n📊 Top 10 Wallets by Balance:", file=sys.stderr)
    for w in wallets:
        name = w["identity"] or w["address_short"]
        print(f"  #{w['rank']} {name}: {w['balance_total']:,.0f} τ ({w['dominance']}%)", file=sys.stderr)
    
    # Output JSON to stdout
    print(json.dumps(result))


if __name__ == "__main__":
    main()
