import os, gc
from fastapi import FastAPI
import uvicorn
import time
import threading
from typing import Dict, Any, List
import bittensor as bt

app = FastAPI()
CACHE_TTL = int(os.getenv("CACHE_TTL", "300"))  # longer cache saves RAM/calls
_cache: Dict[str, Any] = {"data": None, "ts": 0.0}
_lock = threading.Lock()

def _is_validator_flag(x) -> bool:
  # robust against dict/obj/different field names
  try:
    if isinstance(x, dict):
      for k in ("validator_permit", "is_validator", "validator", "validatorPermit"):
        if k in x and isinstance(x[k], (bool, int)): return bool(x[k])
      return False
    for k in ("validator_permit", "is_validator", "validator", "validatorPermit"):
      if hasattr(x, k):
        v = getattr(x, k)
        if isinstance(v, (bool, int)): return bool(v)
    return False
  except:
    return False

def _count_validators_from_mg(mg) -> int:
  try:
    for attr in ("validator_permit", "validator_permits", "is_validator", "validators"):
      if hasattr(mg, attr):
        vp = getattr(mg, attr)
        arr = vp.tolist() if hasattr(vp, "tolist") else (vp if isinstance(vp, (list, tuple)) else [])
        return int(sum(1 for v in arr if bool(v)))
    return 0
  except:
    return 0


def generate_halving_thresholds(max_supply: int = 21_000_000, max_events: int = 6) -> List[int]:
  """Generate halving thresholds list similar to frontend JS generator.
  For max_events n, thresholds = round(max_supply * (1 - 1/2^n)) for n=1..max_events
  """
  arr: List[int] = []
  for n in range(1, max_events + 1):
    threshold = round(max_supply * (1 - 1 / (2 ** n)))
    arr.append(int(threshold))
  return arr

def gather_metrics(network: str = "finney") -> Dict[str, Any]:
  st = bt.subtensor(network=network)

  try:
    block = st.get_current_block()
  except:
    block = None

  try:
    netuids: List[int] = st.get_subnets()
  except:
    netuids = []

  total_subnets = len(netuids)
  total_validators = 0
  total_neurons = 0

  for uid in netuids:
    # 1) easy path: neurons_lite
    lite = None
    try:
      try:
        lite = st.get_neurons_lite(uid)
      except:
        lite = st.neurons_lite(uid)
    except:
      lite = None

    if lite is not None:
      try:
        total_neurons += len(lite)
        total_validators += sum(1 for n in lite if _is_validator_flag(n))
      finally:
        del lite
        gc.collect()
      continue

    # 2) Fallback: full Metagraph (release immediately)
    try:
      mg = st.metagraph(uid)
      total_neurons += int(getattr(mg, "n", 0)) or 0
      total_validators += _count_validators_from_mg(mg)
    except:
      pass
    finally:
      try: del mg
      except: pass
      gc.collect()

  # Total issuance: try to query SubtensorModule::TotalIssuance via substrate
  total_issuance_raw = None
  total_issuance_human = None
  try:
    if hasattr(st, 'substrate') and st.substrate is not None:
      try:
        issuance = st.substrate.query('SubtensorModule', 'TotalIssuance')
        total_issuance_raw = int(issuance.value) if issuance and issuance.value is not None else None
      except Exception:
        total_issuance_raw = None
      try:
        props = st.substrate.rpc_request('system_properties', [])
        dec = props.get('result', {}).get('tokenDecimals')
        if isinstance(dec, list):
          decimals = int(dec[0])
        else:
          decimals = int(dec) if dec is not None else 9
      except Exception:
        decimals = 9
      if total_issuance_raw is not None:
        try:
          total_issuance_human = float(total_issuance_raw) / (10 ** decimals)
        except Exception:
          total_issuance_human = None
  except Exception:
    total_issuance_raw = None
    total_issuance_human = None

  # Build metrics response
  now_ts = time.time()

  # maintain issuance history for emission computations (per-day deltas)
  try:
    history = _cache.get('issuance_history') or []
    if total_issuance_human is not None:
      history.append({'ts': now_ts, 'issuance': float(total_issuance_human)})
      # keep a reasonable number of entries (e.g. 720 entries ~= hourly for 30 days)
      max_entries = 720
      if len(history) > max_entries:
        history = history[-max_entries:]
    _cache['issuance_history'] = history
  except Exception:
    history = _cache.get('issuance_history') or []

  # compute per-day deltas from adjacent history samples
  def compute_per_day_deltas(hist):
    deltas = []
    if not hist or len(hist) < 2:
      return deltas
    for a, b in zip(hist, hist[1:]):
      dt = float(b['ts']) - float(a['ts'])
      if dt <= 0:
        continue
      delta = float(b['issuance']) - float(a['issuance'])
      per_day = delta * (86400.0 / dt)
      deltas.append({'ts': b['ts'], 'per_day': per_day})
    return deltas

  def robust_average(values):
    if not values:
      return None
    vals = sorted(values)
    n = len(vals)
    if n == 0:
      return None
    # trim top/bottom 10% if possible
    trim = max(1, int(n * 0.1)) if n > 3 else 0
    if trim > 0 and n > 2 * trim:
      trimmed = vals[trim:n - trim]
    else:
      trimmed = vals
    return sum(trimmed) / len(trimmed)

  def avg_for_days(hist, days):
    now = now_ts
    cutoff = now - (days * 86400.0)
    per_day_deltas = compute_per_day_deltas(hist)
    recent = [d['per_day'] for d in per_day_deltas if d['ts'] >= cutoff]
    if not recent:
      # fallback to last N deltas (e.g. last 7)
      recent = [d['per_day'] for d in per_day_deltas[-min(len(per_day_deltas), days):]]
    if not recent:
      return None
    return robust_average(recent)

  emission_7d = avg_for_days(history, 7)
  emission_30d = avg_for_days(history, 30)

  # server-side fallback value (legacy) if metrics couldn't compute a value
  emission_7d_value = round(emission_7d) if emission_7d and emission_7d > 0 else 7200
  emission_30d_value = round(emission_30d) if emission_30d and emission_30d > 0 else 7200

  # supplyUsed: we use totalIssuance by default since the halving is supply-based on TTI
  supply_used = 'total'

  return {
    "blockHeight": block,
    "validators": total_validators,
    "subnets": total_subnets,
    "emission": 7200,
    "emission_7d": emission_7d_value,
    "emission_30d": emission_30d_value,
    "supplyUsed": supply_used,
    "totalNeurons": total_neurons,
    "totalIssuance": total_issuance_raw,
    "totalIssuanceHuman": total_issuance_human,
    "circulatingSupply": None,
    "halvingThresholds": generate_halving_thresholds(),
    "_source": "bittensor-sdk"
  }

@app.get("/")
def root():
  return {"status": "ok", "service": "bittensor-metrics"}

@app.get("/metrics")
def metrics():
  now = time.time()
  with _lock:
    if _cache["data"] and now - _cache["ts"] < CACHE_TTL:
      return _cache["data"]
    data = gather_metrics(os.getenv("NETWORK", "finney"))
    _cache["data"] = data
    _cache["ts"] = now
    return data

if __name__ == "__main__":
  port = int(os.getenv("PORT", 8000))
  uvicorn.run(app, host="0.0.0.0", port=port)