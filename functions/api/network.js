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
  
  // Taostats API (ohne Key für öffentliche Endpoints)
  const TAOSTATS_API = 'https://api.taostats.io';

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
    // Block Height von RPC
    const header = await rpcCall('chain_getHeader');
    const blockHeight = header?.number ? parseInt(header.number, 16) : null;

    // Versuche Taostats öffentliche API
    let taostatsData = null;
    try {
      const taostatsRes = await fetch(`${TAOSTATS_API}/subnets`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Bittensor-Labs/1.0'
        }
      });

      if (taostatsRes.ok) {
        taostatsData = await taostatsRes.json();
      }
    } catch (taostatsError) {
      console.log('Taostats API unavailable:', taostatsError.message);
    }

    // Wenn Taostats funktioniert, nutze deren Daten
    if (taostatsData && Array.isArray(taostatsData)) {
      const totalSubnets = taostatsData.length;
      
      // Summiere Validators und Neurons aus Taostats
      let totalValidators = 0;
      let totalNeurons = 0;
      
      taostatsData.forEach(subnet => {
        if (subnet.max_n) totalValidators += subnet.max_n;
        if (subnet.n) totalNeurons += subnet.n;
      });

      return new Response(JSON.stringify({
        blockHeight,
        validators: totalValidators || 1024,
        subnets: totalSubnets,
        emission: '7,200',
        totalNeurons: totalNeurons || 0,
        _live: true,
        _source: 'taostats+rpc'
      }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Fallback: RPC-basierte Daten
    const subnetsData = await rpcCall('subnetInfo_getSubnetsInfo_v2', []);
    const dynamicInfoData = await rpcCall('subnetInfo_getAllDynamicInfo', []);

    let activeSubnetIds = [];
    let totalValidators = 0;
    
    if (Array.isArray(subnetsData) && subnetsData.length > 1) {
      const count = subnetsData[0];
      for (let i = 1; i < Math.min(subnetsData.length, count * 100); i++) {
        const netuid = subnetsData[i];
        if (typeof netuid === 'number' && netuid < 1024 && !activeSubnetIds.includes(netuid)) {
          activeSubnetIds.push(netuid);
        }
      }
    }

    if (Array.isArray(dynamicInfoData) && dynamicInfoData.length > 1) {
      for (let i = 1; i < Math.min(dynamicInfoData.length, 5000); i += 40) {
        if (dynamicInfoData[i + 2] !== undefined && dynamicInfoData[i + 3] !== undefined) {
          const maxN = dynamicInfoData[i + 2] | (dynamicInfoData[i + 3] << 8);
          if (maxN > 0 && maxN < 10000) {
            totalValidators += maxN;
          }
        }
      }
    }

    const neuronPromises = activeSubnetIds.slice(0, 100).map(netuid =>
      rpcCall('neuronInfo_getNeuronsLite', [netuid])
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            const count = data[0];
            return count < 252 ? count : 0;
          }
          return 0;
        })
        .catch(() => 0)
    );

    const neuronCounts = await Promise.all(neuronPromises);
    const totalNeurons = neuronCounts.reduce((sum, count) => sum + count, 0);

    return new Response(JSON.stringify({
      blockHeight,
      validators: totalValidators || 1024,
      subnets: activeSubnetIds.length || 128,
      emission: '7,200',
      totalNeurons: totalNeurons || 0,
      _live: true,
      _source: 'rpc-only'
    }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('API error:', e.message);
    
    return new Response(JSON.stringify({
      blockHeight: null,
      validators: 1024,
      subnets: 128,
      emission: '7,200',
      totalNeurons: 0,
      _fallback: true,
      _error: e.message
    }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
}