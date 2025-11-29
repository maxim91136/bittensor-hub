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

  try {
    const raw = await KV.get('taostats_history');
    if (!raw) {
      return new Response(JSON.stringify({ error: 'No Taostats history found', _source: 'taostats', _status: 'empty' }), {
        status: 404,
        headers: cors
      });
    }
    return new Response(raw, { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch Taostats history', details: e.message }), {
      status: 500,
      headers: cors
    });
  }
}
