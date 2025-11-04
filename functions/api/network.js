export async function onRequest(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  const RPC_ENDPOINT = 'https://entrypoint-finney.opentensor.ai';

  async function rpcCall(method, params = []) {
    const res = await fetch(RPC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method,
        params
      })
    });

    if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`);
    
    const json = await res.json();
    if (json.error) throw new Error(`RPC error: ${json.error.message}`);
    
    return json.result;
  }

  try {
    const [header, subnetsInfo] = await Promise.all([
      rpcCall('chain_getHeader'),
      rpcCall('subnetInfo_getSubnetsInfo'),
    ]);

    const blockHeight = header?.number ? parseInt(header.number, 16) : null;

    // Analysiere die Struktur
    const sample = subnetsInfo?.[0];

    return new Response(JSON.stringify({
      blockHeight,
      validators: 500,
      subnets: 142,
      emission: '7,200',
      _live: true,
      _debug: {
        message: 'Analyzing data structure',
        subnetsInfoType: typeof subnetsInfo,
        subnetsInfoIsArray: Array.isArray(subnetsInfo),
        subnetsInfoLength: subnetsInfo?.length,
        firstItemSample: sample,
        firstItemKeys: sample ? Object.keys(sample) : null,
        firstItemType: typeof sample,
      }
    }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('RPC error:', e.message);
    
    return new Response(JSON.stringify({
      blockHeight: null,
      validators: 500,
      subnets: 142,
      emission: '7,200',
      _fallback: true,
      _error: e.message
    }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
}