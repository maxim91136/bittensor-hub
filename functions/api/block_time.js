/**
 * API endpoint for block time data
 * Returns average block time calculated from recent blocks
 */

export async function onRequest(context) {
  const { env } = context;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300'
  };

  try {
    // Fetch from KV
    const data = await env.BITTENSOR_METRICS.get('block_time', 'json');

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'No block time data available' }),
        { status: 404, headers }
      );
    }

    return new Response(JSON.stringify(data), { status: 200, headers });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch block time data', details: err.message }),
      { status: 500, headers }
    );
  }
}
