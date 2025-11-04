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
      n = int(getattr(mg, "n", 0))
      total_neurons += n
    except Exception as e:
      print(f"Error getting metagraph for subnet {uid}: {e}")
      pass
    
    try:
      # Versuche verschiedene Methoden für Hyperparams
      hp = None
      try:
        hp = st.get_subnet_hyperparams(uid)
      except:
        try:
          hp = st.subnet_hyperparameters(uid)
        except:
          pass
      
      if hp:
        # Versuche max_n zu extrahieren
        max_n = 0
        if hasattr(hp, 'max_n'):
          max_n = int(hp.max_n)
        elif hasattr(hp, 'max_allowed_validators'):
          max_n = int(hp.max_allowed_validators)
        elif isinstance(hp, dict) and 'max_n' in hp:
          max_n = int(hp['max_n'])
        
        if max_n > 0:
          total_validators += max_n
          print(f"Subnet {uid}: max_n={max_n}")
        else:
          print(f"Subnet {uid}: max_n not found in hyperparams")
      else:
        print(f"Subnet {uid}: hyperparams not available")
        
    except Exception as e:
      print(f"Error getting hyperparams for subnet {uid}: {e}")
      pass

  print(f"Total: subnets={total_subnets}, validators={total_validators}, neurons={total_neurons}")

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