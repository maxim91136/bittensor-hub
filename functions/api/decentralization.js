/**
 * API endpoint: /api/decentralization
 * Returns the Network Decentralization Score from KV.
 */
export async function onRequest(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300'  // 5 min cache
  };

  try {
    const KV = context.env?.METRICS_KV;

    if (!KV) {
      return new Response(JSON.stringify({ error: 'KV not bound' }), { status: 500, headers: cors });
    }

    const raw = await KV.get('decentralization_score', { type: 'json' });

    if (!raw) {
      return new Response(JSON.stringify({
        error: 'No decentralization data found',
        _status: 'empty'
      }), { status: 404, headers: cors });
    }

    return new Response(JSON.stringify(raw), { status: 200, headers: cors });

  } catch (e) {
    return new Response(JSON.stringify({
      error: 'Failed to fetch decentralization score',
      details: e.message
    }), { status: 500, headers: cors });
  }
}
