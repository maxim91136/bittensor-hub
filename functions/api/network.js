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
      body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params })
    });
    if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(`RPC error: ${json.error.message}`);
    return json.result;
  }

  // SCALE compact-u32 decoder (for Vec length in neuronsLite)
  function decodeCompactU32(bytes) {
    if (!bytes || bytes.length === 0) return { value: 0, consumed: 0 };
    const b0 = bytes[0];
    const mode = b0 & 0b11;
    if (mode === 0b00) {
      return { value: b0 >>> 2, consumed: 1 };
    } else if (mode === 0b01) {
      if (bytes.length < 2) return { value: 0, consumed: 0 };
      const v = ((b0 >>> 2) | (bytes[1] << 6)) >>> 0;
      return { value: v, consumed: 2 };
    } else if (mode === 0b10) {
      if (bytes.length < 4) return { value: 0, consumed: 0 };
      const v = ((b0 >>> 2) |
        (bytes[1] << 6) |
        (bytes[2] << 14) |
        (bytes[3] << 22)) >>> 0;
      return { value: v, consumed: 4 };
    } else {
      const byteLen = (b0 >>> 2) + 4;
      if (bytes.length < 1 + byteLen) return { value: 0, consumed: 0 };
      let v = 0n;
      for (let i = 0; i < byteLen; i++) {
        v |= BigInt(bytes[1 + i]) << (8n * BigInt(i));
      }
      const max = BigInt(Number.MAX_SAFE_INTEGER);
      return { value: v > max ? Number(max) : Number(v), consumed: 1 + byteLen };
    }
  }

  // Small pool to limit concurrency
  async function mapPool(items, concurrency, mapper) {
    const results = new Array(items.length);
    let i = 0;
    async function worker() {
      while (i < items.length) {
        const idx = i++;
        try {
          results[idx] = await mapper(items[idx], idx);
        } catch {
          results[idx] = null;
        }
      }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
    await Promise.all(workers);
    return results;
  }

  try {
    const header = await rpcCall('chain_getHeader');
    const blockHeight = header?.number ? parseInt(header.number, 16) : null;

    // Discover existing subnets using typed V2 RPC
    const RANGE_MAX = 512; // wide enough to include SN64 and beyond
    const netuids = Array.from({ length: RANGE_MAX }, (_, i) => i);

    const subnetInfos = await mapPool(netuids, 24, async (netuid) => {
      const info = await rpcCall('subnetInfo_getSubnetInfo_v2', [netuid]).catch(() => null);
      // Expect typed JSON with a netuid or something non-null when exists
      if (info && typeof info === 'object') return { netuid, info };
      return null;
    });

    const activeNetuids = subnetInfos.filter(Boolean).map(s => s.netuid);

    // Fetch hyperparams (V2) and neuronsLite counts with proper decoding
    const [hyperparamsList, neuronCounts] = await Promise.all([
      mapPool(activeNetuids, 24, async (netuid) => {
        const hp = await rpcCall('subnetInfo_getSubnetHyperparamsV2', [netuid]).catch(() => null);
        // Expect { max_n: number, ... }
        return hp && typeof hp === 'object' ? hp : null;
      }),
      mapPool(activeNetuids, 16, async (netuid) => {
        const raw = await rpcCall('neuronInfo_getNeuronsLite', [netuid]).catch(() => null);
        if (Array.isArray(raw) && raw.length > 0) {
          const bytes = Uint8Array.from(raw);
          const { value: vecLen } = decodeCompactU32(bytes);
          return Number.isFinite(vecLen) ? vecLen : 0;
        }
        return 0;
      })
    ]);

    // Sum validators via max_n from V2 hyperparams, fallback to 0 if absent
    const validators = hyperparamsList.reduce((sum, hp) => {
      const v = hp && typeof hp.max_n === 'number' ? hp.max_n : 0;
      // sanity: cap per subnet to a reasonable range
      return sum + (v >= 0 && v <= 4096 ? v : 0);
    }, 0);

    const totalNeurons = neuronCounts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

    return new Response(JSON.stringify({
      blockHeight,
      validators,
      subnets: activeNetuids.length,
      emission: '7,200',
      totalNeurons,
      _live: true,
      _source: 'rpc-v2',
      _debug: {
        checkedRange: `0-${RANGE_MAX - 1}`,
        activeSample: activeNetuids.slice(0, 20),
        activeCount: activeNetuids.length,
        validatorsFrom: 'subnetInfo_getSubnetHyperparamsV2',
        neuronsFrom: 'neuronInfo_getNeuronsLite (compact-u32 length)'
      }
    }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({
      blockHeight: null,
      validators: 0,
      subnets: 0,
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