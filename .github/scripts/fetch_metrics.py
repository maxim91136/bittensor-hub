import json, os, gc
from typing import Dict, Any, List
import bittensor as bt

NETWORK = os.getenv("NETWORK", "finney")

def gather() -> Dict[str, Any]:
    st = bt.subtensor(network=NETWORK)
    try:
        block = st.get_current_block()
    except Exception:
        block = None
    try:
        netuids: List[int] = st.get_subnets()
    except Exception:
        netuids = []

    total_subnets = len(netuids)
    total_validators = 0
    total_neurons = 0

    # Debug: ersten Subnet checken
    if netuids:
        try:
            lite = st.neurons_lite(netuids[0])
            if lite and len(lite) > 0:
                print(f"DEBUG subnet {netuids[0]} first neuron keys: {list(lite[0].keys()) if isinstance(lite[0], dict) else type(lite[0])}")
        except Exception as e:
            print(f"DEBUG error: {e}")

    for uid in netuids:
        lite = None
        try:
            lite = st.neurons_lite(uid)
        except:
            try:
                lite = st.get_neurons_lite(uid)
            except:
                lite = None

        if lite:
            total_neurons += len(lite)
            # Alle möglichen Validator-Felder prüfen
            for n in lite:
                if isinstance(n, dict):
                    found = False
                    for k in ("validator_permit", "is_validator", "validatorPermit", "validator", "is_val"):
                        if k in n and n[k]:
                            total_validators += 1
                            found = True
                            break
                    # Debug: erstes Neuron loggen
                    if uid == netuids[0] and not found:
                        print(f"DEBUG neuron keys: {list(n.keys())}")
            del lite
            gc.collect()
            continue

        # Fallback: metagraph
        try:
            mg = st.metagraph(uid)
            total_neurons += int(getattr(mg, "n", 0))
            vp = getattr(mg, "validator_permit", None)
            if vp is not None:
                arr = vp.tolist() if hasattr(vp, "tolist") else list(vp)
                total_validators += sum(1 for x in arr if x)
        except Exception as e:
            print(f"Subnet {uid} error: {e}")
        finally:
            try: del mg
            except: pass
            gc.collect()

    return {
        "blockHeight": block,
        "validators": total_validators,
        "subnets": total_subnets,
        "emission": "7,200",
        "totalNeurons": total_neurons,
        "_source": "gh-action+bittensor-sdk"
    }

if __name__ == "__main__":
    data = gather()
    with open("metrics.json", "w") as f:
        json.dump(data, f)
    print(json.dumps(data))