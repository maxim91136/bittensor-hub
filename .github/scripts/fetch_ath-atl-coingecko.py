import requests
import json
from datetime import datetime

COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/bittensor'
KV_FILE = 'tao_ath_atl.json'  # Example: local file as KV substitute

def fetch_ath_atl():
    try:
        res = requests.get(COINGECKO_API, timeout=10)
        res.raise_for_status()
        data = res.json()
        ath = data.get('market_data', {}).get('ath', {}).get('usd')
        ath_date = data.get('market_data', {}).get('ath_date', {}).get('usd')
        atl = data.get('market_data', {}).get('atl', {}).get('usd')
        atl_date = data.get('market_data', {}).get('atl_date', {}).get('usd')
        if ath is None or atl is None:
            raise ValueError('ATH/ATL not found in response')
        result = {
            'ath': ath,
            'ath_date': ath_date,
            'atl': atl,
            'atl_date': atl_date,
            'source': 'coingecko',
            'updated': datetime.utcnow().isoformat() + 'Z'
        }
        with open(KV_FILE, 'w') as f:
            json.dump(result, f, indent=2)
        print('ATH/ATL data saved:', result)
    except Exception as e:
        print('Error fetching ATH/ATL:', str(e))
        exit(1)

if __name__ == '__main__':
    fetch_ath_atl()
