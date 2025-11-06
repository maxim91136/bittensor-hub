import bittensor as bt
import json
import os
import sys  # ✅ FIX 1
from typing import Dict, Any, List
from datetime import datetime, timezone

NETWORK = os.getenv("NETWORK", "finney")

def fetch_metrics() -> Dict[str, Any]:
    """Fetch all Bittensor network metrics"""
    subtensor = bt.subtensor(network=NETWORK)
    
    # Get current block
    current_block = subtensor.get_current_block()
    
    # ✅ FIX 2: Korrekte Methode (ohne 'get_')
    all_subnets = subtensor.get_subnets()  # Oder: list(range(subtensor.max_n))
    
    # Count validators and neurons
    total_validators = 0
    total_neurons = 0
    
    for netuid in all_subnets:
        try:
            metagraph = subtensor.metagraph(netuid)
            # Check if validator_permit exists (might be validator_trust in newer versions)
            if hasattr(metagraph, 'validator_permit'):
                total_validators += len([uid for uid in metagraph.uids if metagraph.validator_permit[uid]])
            total_neurons += len(metagraph.uids)
        except Exception as e:
            print(f"Warning: Could not fetch metagraph for netuid {netuid}: {e}", file=sys.stderr)
            continue
    
    # Calculate daily emission (7200 TAO/day currently)
    daily_emission = 7200  # This is hardcoded for now
    
    # ✅ Get circulating supply from chain
    try:
        total_issuance = subtensor.total_issuance()
        # Convert Balance object to float
        if hasattr(total_issuance, 'tao'):
            circulating_supply = float(total_issuance.tao)
        else:
            circulating_supply = float(total_issuance)
    except Exception as e:
        print(f"Warning: Could not fetch total_issuance: {e}", file=sys.stderr)
        circulating_supply = None
    
    result = {
        "blockHeight": current_block,
        "validators": total_validators,
        "subnets": len(all_subnets),
        "emission": f"{daily_emission:,}",
        "totalNeurons": total_neurons,
        "_source": "bittensor-sdk",
        "_timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Only add circulatingSupply if we got a valid value
    if circulating_supply is not None:
        result["circulatingSupply"] = circulating_supply
    
    return result

if __name__ == "__main__":
    try:
        metrics = fetch_metrics()
        print(json.dumps(metrics, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)