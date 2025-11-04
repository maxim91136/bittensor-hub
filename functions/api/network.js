export async function onRequest(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
  if (context.request.method === 'OPTIONS') return new Response(null, { headers: cors });

  const METRICS_URL = context.env?.METRICS_URL || 'https://bittensor-labs-python-bites.onrender.com/metrics';
  const RPC_ENDPOINT = 'https://entrypoint-finney.opentensor.ai';

  async function rpcCall(method, params = []) {
    const res = await fetch(RPC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params })
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error?.message || `RPC ${method} failed`);
    return json.result;
  }

  try {
    // 1) Warm-up: ping Root (weckt Render-Free-Instanz schneller)
    const rootUrl = METRICS_URL.replace(/\/metrics$/, '/');
    try {
      await fetch(rootUrl, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    } catch {}

    // 2) Hauptabruf mit längerem Timeout (bis zu 60s)
    const r = await fetch(METRICS_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(60000) // 60s für Kaltstart
    });
    if (!r.ok) throw new Error(`metrics ${r.status}`);
    const m = await r.json();

    // Optional: Blockhöhe live nachziehen
    try {
      const header = await rpcCall('chain_getHeader');
      const live = header?.number ? parseInt(header.number, 16) : null;
      if (live && (!m.blockHeight || live > m.blockHeight)) m.blockHeight = live;
    } catch {}

    return new Response(JSON.stringify({
      blockHeight: m.blockHeight ?? null,
      validators: m.validators ?? 0,
      subnets: m.subnets ?? 0,
      emission: m.emission ?? 7200,
      totalNeurons: m.totalNeurons ?? 0,
      _live: true,
      _source: m._source || 'bittensor-sdk'
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (e) {
    // Fallback: nur Blockhöhe
    try {
      const header = await rpcCall('chain_getHeader');
      const blockHeight = header?.number ? parseInt(header.number, 16) : null;
      return new Response(JSON.stringify({
        blockHeight, validators: 0, subnets: 0, emission: 7200, totalNeurons: 0,
        _fallback: true, _error: e.message
      }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    } catch {
      return new Response(JSON.stringify({
        blockHeight: null, validators: 0, subnets: 0, emission: 7200, totalNeurons: 0,
        _fallback: true
      }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
  }
}