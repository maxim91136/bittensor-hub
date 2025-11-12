// Cloudflare Worker: ATH & ATL fetch for TAO via Coingecko
export async function onRequest(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60, s-maxage=120'
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const KV = context.env?.METRICS_KV;
  if (!KV) {
    return new Response(JSON.stringify({ error: 'KV not bound' }), { status: 500, headers: cors });
  }

  const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/bittensor';

  try {
    const res = await fetch(COINGECKO_API);
    if (!res.ok) throw new Error('Coingecko API error');
    const data = await res.json();
    const ath = data?.market_data?.ath?.usd ?? null;
    const ath_date = data?.market_data?.ath_date?.usd ?? null;
    const atl = data?.market_data?.atl?.usd ?? null;
    const atl_date = data?.market_data?.atl_date?.usd ?? null;
    if (!ath || !atl) throw new Error('ATH/ATL not found');

  // Store ATH/ATL in KV
  await KV.put('tao_ath_atl', JSON.stringify({ ath, ath_date, atl, atl_date, source: 'coingecko', updated: new Date().toISOString() }));

    return new Response(JSON.stringify({ ath, ath_date, atl, atl_date, _source: 'coingecko' }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch ATH/ATL', details: e.message }), { status: 500, headers: cors });
  }
}
