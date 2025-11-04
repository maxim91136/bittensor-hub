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
    const header = await rpcCall('chain_getHeader');
    const blockHeight = header?.number ? parseInt(header.number, 16) : null;

    // Versuche Taostats
    try {
      const taostatsRes = await fetch(`${TAOSTATS_API}/subnets`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Bittensor-Labs/1.0'
        }
      });

      if (taostatsRes.ok) {
        const taostatsData = await taostatsRes.json();
        
        if (Array.isArray(taostatsData) && taostatsData.length > 0) {
          let totalValidators = 0;
          let totalNeurons = 0;
          
          taostatsData.forEach(subnet => {
            if (subnet.max_n) totalValidators += subnet.max_n;
            if (subnet.n) totalNeurons += subnet.n;
          });

          return new Response(JSON.stringify({
            blockHeight,
            validators: totalValidators,
            subnets: taostatsData.length,
            emission: '7,200',
            totalNeurons: totalNeurons,
            _live: true,
            _source: 'taostats+rpc'
          }), {
            status: 200,
            headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
      }
    } catch (e) {
      console.log('Taostats failed:', e.message);
    }

    // Fallback: Nutze individuelle Subnet-Abfragen (langsamer aber zuverlässig)
    // Prüfe 0-200 (sollte alle Subnets abdecken)
    const subnetPromises = Array.from({ length: 200 }, (_, netuid) =>
      Promise.all([
        rpcCall('subnetInfo_getSubnetHyperparams', [netuid]).catch(() => null),
        rpcCall('subnetInfo_getSubnetInfo', [netuid]).catch(() => null)
      ]).then(([hyperparams, info]) => ({
        netuid,
        exists: info !== null,
        hyperparams
      }))
    );

    const subnetResults = await Promise.all(subnetPromises);
    const activeSubnets = subnetResults.filter(s => s.exists);

    let totalValidators = 0;
    
    activeSubnets.forEach(subnet => {
      if (subnet.hyperparams && Array.isArray(subnet.hyperparams) && subnet.hyperparams.length > 3) {
        // max_n ist bei Byte-Position 2-3 als u16 little-endian
        const maxN = subnet.hyperparams[2] | (subnet.hyperparams[3] << 8);
        if (maxN > 0 && maxN < 1000) { // Sanity check: max 1000 validators pro subnet
          totalValidators += maxN;
        }
      }
    });

    // Hole Neuron-Counts (nur für erste 50 Subnets wegen Performance)
    const neuronPromises = activeSubnets.slice(0, 50).map(subnet =>
      rpcCall('neuronInfo_getNeuronsLite', [subnet.netuid])
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            // Compact encoding: wenn < 252, ist es direkt die Anzahl
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
      subnets: activeSubnets.length,
      emission: '7,200',
      totalNeurons: totalNeurons || 0,
      _live: true,
      _source: 'rpc-individual',
      _debug: {
        checkedSubnets: 200,
        foundActive: activeSubnets.length,
        sampleHyperparams: activeSubnets[0]?.hyperparams?.slice(0, 10)
      }
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