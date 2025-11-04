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

  // Helper: SCALE-decode u64 (little-endian, 8 bytes)
  function decodeU64(hex) {
    if (!hex || hex === '0x') return null;
    const cleaned = hex.replace('0x', '');
    if (cleaned.length < 16) return null;
    
    // Little-endian: bytes rückwärts lesen
    let result = 0n;
    for (let i = 0; i < 16; i += 2) {
      const byte = BigInt(parseInt(cleaned.substr(i, 2), 16));
      result += byte << BigInt((i / 2) * 8);
    }
    return Number(result);
  }

  try {
    const [header, subnetCountHex, validatorCountHex, blockEmissionHex] = await Promise.all([
      rpcCall('chain_getHeader'),
      rpcCall('state_call', ['SubtensorModule_get_total_subnets', '0x']).catch(() => null),
      rpcCall('state_call', ['SubtensorModule_get_subnetwork_n', '0x00000000']).catch(() => null),
      // Block Emission (TAO per block, in RAO = 1e9)
      rpcCall('state_call', ['SubtensorModule_get_block_emission', '0x']).catch(() => null)
    ]);

    const blockHeight = header?.number ? parseInt(header.number, 16) : null;

    // Subnet Count
    let subnets = 142;
    if (subnetCountHex) {
      const hex = subnetCountHex.replace('0x', '');
      if (hex.length >= 4) {
        subnets = parseInt(hex.substring(0, 4), 16);
      }
    }

    // Validator Count
    let validators = 500;
    if (validatorCountHex) {
      const hex = validatorCountHex.replace('0x', '');
      if (hex.length >= 4) {
        validators = parseInt(hex.substring(0, 4), 16);
      }
    }

    // Block Emission (RAO → TAO, dann * 7200 blocks/day)
    let emission = '7,200'; // Fallback
    if (blockEmissionHex) {
      const raoPerBlock = decodeU64(blockEmissionHex);
      if (raoPerBlock) {
        const taoPerBlock = raoPerBlock / 1e9; // RAO to TAO
        const taoPerDay = taoPerBlock * 7200; // 12s Blocktime → 7200 blocks/day
        emission = taoPerDay.toLocaleString('en-US', { 
          minimumFractionDigits: 0,
          maximumFractionDigits: 2 
        });
      }
    }

    return new Response(JSON.stringify({
      blockHeight,
      validators,
      subnets,
      emission,
      _live: true
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