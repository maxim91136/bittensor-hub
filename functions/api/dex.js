// DEX data API endpoint
// Serves TAO DEX trading data from KV (fetched by GitHub Action)

export async function onRequest(context) {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=120'
    };

    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors });
    }

    const KV = env?.METRICS_KV;
    if (!KV) {
        return new Response(JSON.stringify({ error: 'KV not bound' }), { status: 500, headers: cors });
    }

    // Check for specific data type query param
    const url = new URL(request.url);
    const dataType = url.searchParams.get('type'); // 'pairs', 'trades', 'volume', or null for all

    try {
        const raw = await KV.get('dex_data');
        if (!raw) {
            return new Response(JSON.stringify({ error: 'No DEX data found', _source: 'dex' }), {
                status: 404,
                headers: cors
            });
        }

        const data = JSON.parse(raw);

        // Return specific data type if requested
        if (dataType === 'pairs') {
            return new Response(JSON.stringify({
                pairs: data.pairs || [],
                pair_count: data.pair_count || 0,
                _timestamp: data._timestamp
            }), {
                status: 200,
                headers: cors
            });
        }
        if (dataType === 'trades') {
            return new Response(JSON.stringify(data.recent_trades || { error: 'No trades data' }), {
                status: data.recent_trades ? 200 : 404,
                headers: cors
            });
        }
        if (dataType === 'volume') {
            return new Response(JSON.stringify({
                total_volume_24h: data.total_volume_24h || 0,
                pair_count: data.pair_count || 0,
                _timestamp: data._timestamp
            }), {
                status: 200,
                headers: cors
            });
        }

        // Return all data
        return new Response(raw, { status: 200, headers: cors });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to fetch DEX data', details: e.message }), {
            status: 500,
            headers: cors
        });
    }
}
