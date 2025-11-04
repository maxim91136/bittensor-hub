export async function onRequest(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    // Korrekter Subscan Endpoint (ohne /scan prefix)
    const res = await fetch('https://bittensor.api.subscan.io/api/v2/scan/metadata', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': '' // Subscan braucht keinen Key für Metadata
      },
      body: JSON.stringify({})
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Subscan error:', res.status, text);
      throw new Error(`Subscan ${res.status}`);
    }

    const json = await res.json();
    const data = json.data || {};

    return new Response(JSON.stringify({
      blockHeight: data.blockNum || data.block_num || null,
      validators: data.count_validator || 500,
      subnets: 142,
      emission: '7,200'
    }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('Network API error:', e);
    // Fallback mit statischen Daten
    return new Response(JSON.stringify({
      blockHeight: null,
      validators: 500,
      subnets: 142,
      emission: '7,200',
      _fallback: true
    }), {
      status: 200, // ← Trotzdem 200, damit Frontend nicht crasht
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
}