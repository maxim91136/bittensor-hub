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

  function hexToInt(hex) {
    if (!hex || hex === '0x') return 0;
    const cleaned = hex.replace('0x', '');
    // Little-endian für kleine Zahlen
    if (cleaned.length <= 8) {
      let reversed = '';
      for (let i = cleaned.length - 2; i >= 0; i -= 2) {
        reversed += cleaned.substr(i, 2);
      }
      return parseInt(reversed || cleaned, 16);
    }
    return parseInt(cleaned, 16);
  }

  try {
    const header = await rpcCall('chain_getHeader');
    const blockHeight = header?.number ? parseInt(header.number, 16) : null;

    // Teste alle verfügbaren RPC-Methoden
    const rpcMethods = await rpcCall('rpc_methods');
    
    // Versuche Runtime-API-Aufrufe
    const runtimeCalls = await Promise.allSettled([
      rpcCall('state_call', ['SubtensorModuleApi_get_total_networks', '0x']),
      rpcCall('state_call', ['SubtensorModuleApi_get_total_subnets', '0x']),
      rpcCall('state_call', ['SubtensorApi_get_total_networks', '0x']),
      // Alternative: Chain-spezifische Calls
      rpcCall('subtensor_getTotalNetworks', []),
      rpcCall('subtensor_getTotalSubnets', []),
    ]);

    return new Response(JSON.stringify({
      blockHeight,
      validators: 500,
      subnets: 142,
      emission: '7,200',
      _live: true,
      _debug: {
        message: 'Testing runtime API calls',
        availableMethods: rpcMethods?.methods || [],
        runtimeResults: runtimeCalls.map((result, i) => ({
          index: i,
          method: [
            'state_call(SubtensorModuleApi_get_total_networks)',
            'state_call(SubtensorModuleApi_get_total_subnets)',
            'state_call(SubtensorApi_get_total_networks)',
            'subtensor_getTotalNetworks',
            'subtensor_getTotalSubnets'
          ][i],
          status: result.status,
          rawValue: result.status === 'fulfilled' ? result.value : null,
          decoded: result.status === 'fulfilled' && result.value ? hexToInt(result.value) : null,
          error: result.status === 'rejected' ? result.reason.message : null
        }))
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