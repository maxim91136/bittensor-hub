export async function onRequest(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // Handle preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    const res = await fetch('https://bittensor.api.subscan.io/api/scan/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // ← Korrektur: JSON.stringify statt '{}'
    });

    if (!res.ok) {
      throw new Error(`Subscan responded with ${res.status}`);
    }

    const data = await res.json();

    return new Response(JSON.stringify({
      blockHeight: data.data?.blockNum || null,
      validators: data.data?.count_validator || 500,
      subnets: 142,
      emission: '7,200'
    }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
}