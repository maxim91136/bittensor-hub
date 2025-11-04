import os
from fastapi import FastAPI
import uvicorn
import time
import threading
from typing import Dict, Any, List
import bittensor as bt

app = FastAPI()
CACHE_TTL = 60  # 1 Minute Cache
_cache: Dict[str, Any] = {"data": None, "ts": 0.0}
_lock = threading.Lock()

def gather_metrics(network: str = "finney") -> Dict[str, Any]:
  st = bt.subtensor(network=network)
  
  try:
    block = st.get_current_block()
  except:
    block = None
    
  try:
    netuids = st.get_subnets()
  except:
    netuids = []

  total_subnets = len(netuids)
  total_validators = 0
  total_neurons = 0

  for uid in netuids:
    try:
      mg = st.metagraph(uid)
      total_neurons += int(getattr(mg, "n", 0))
    except:
      pass
    try:
      hp = st.get_subnet_hyperparams(uid)
      total_validators += int(getattr(hp, "max_n", 0))
    except:
      pass

  return {
    "blockHeight": block,
    "validators": total_validators,
    "subnets": total_subnets,
    "emission": 7200,
    "totalNeurons": total_neurons,
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
    data = gather_metrics("finney")
    _cache["data"] = data
    _cache["ts"] = now
    return data

if __name__ == "__main__":
  port = int(os.getenv("PORT", 8000))
  uvicorn.run(app, host="0.0.0.0", port=port)