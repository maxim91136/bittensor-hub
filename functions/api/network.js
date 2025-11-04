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
    const [header, subnetsInfo, allMetagraphs] = await Promise.all([
      rpcCall('chain_getHeader'),
      rpcCall('subnetInfo_getSubnetsInfo'), // Alle Subnet-Infos
      rpcCall('subnetInfo_getAllMetagraphs'), // Alle Metagraphs mit Neuron-Infos
    ]);

    const blockHeight = header?.number ? parseInt(header.number, 16) : null;

    // Anzahl der Subnets
    const totalSubnets = Array.isArray(subnetsInfo) ? subnetsInfo.length : 142;

    // Validators über alle Subnets zählen
    let totalValidators = 0;
    let totalEmission = 0;

    if (Array.isArray(allMetagraphs)) {
      allMetagraphs.forEach(metagraph => {
        if (metagraph?.neurons) {
          totalValidators += metagraph.neurons.length;
        }
        if (metagraph?.emission) {
          // Emission ist in Rao (1e9 = 1 TAO)
          totalEmission += parseInt(metagraph.emission) / 1e9;
        }
      });
    }

    return new Response(JSON.stringify({
      blockHeight,
      validators: totalValidators || 500,
      subnets: totalSubnets,
      emission: Math.round(totalEmission).toLocaleString(),
      _live: true,
      _debug: {
        subnetsInfoCount: Array.isArray(subnetsInfo) ? subnetsInfo.length : 0,
        metagraphsCount: Array.isArray(allMetagraphs) ? allMetagraphs.length : 0,
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