export async function onRequest(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=30, s-maxage=60'
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const KV = context.env?.METRICS_KV;
  if (!KV) {
    return new Response(JSON.stringify({ error: 'KV not bound' }), { status: 500, headers: cors });
  }

  try {
    if (context.request.method === 'GET') {
      const raw = await KV.get('taostats_aggregates');
      if (!raw) {
        return new Response(JSON.stringify({ error: 'No Taostats aggregates found', _source: 'taostats_aggregates', _status: 'empty' }), {
          status: 404,
          headers: cors
        });
      }
      // Diagnostic mode: parse and validate stored aggregates
      try {
        const url = new URL(context.request.url);
        const validate = url.searchParams.get('validate');
        if (validate === '1' || validate === 'true') {
          let agg = null;
          try {
            agg = JSON.parse(raw);
          } catch (e) {
            return new Response(JSON.stringify({ error: 'Failed to parse KV payload as JSON', details: e.message, _source: 'taostats_aggregates' }), { status: 500, headers: cors });
          }
          const ma3 = agg?.ma_3d ?? null;
          const ma7 = agg?.ma_7d ?? null;
          const identical = (ma3 !== null && ma7 !== null && ma3 === ma7);
          return new Response(JSON.stringify({ _source: 'taostats_aggregates', ma_3d: ma3, ma_7d: ma7, identical, _raw_present: true }), { status: 200, headers: cors });
        }
      } catch (e) {
        // fall through to returning raw payload
        console.warn('Validation check failed', e);
      }

      // Return the raw JSON stored in KV (default behaviour)
      return new Response(raw, { status: 200, headers: cors });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch Taostats aggregates', details: e.message }), {
      status: 500,
      headers: cors
    });
  }
}
