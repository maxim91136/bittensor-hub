import * as ath from './functions/api/ath-atl.js';
import * as athHealth from './functions/api/ath-atl-health.js';
import * as network from './functions/api/network.js';
import * as issuance from './functions/api/issuance_history.js';
import * as topSubnets from './functions/api/top_subnets.js';
import * as taostats from './functions/api/taostats.js';
import * as taostatsHistory from './functions/api/taostats_history.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const context = { request, env, waitUntil: ctx.waitUntil };

    // Health endpoint
    if (url.pathname === '/api/ath-atl/health' || url.pathname.startsWith('/api/ath-atl/health')) {
      if (typeof athHealth.onRequest === 'function') return athHealth.onRequest(context);
    }

    // ATH/ATL endpoint
    if (url.pathname === '/api/ath-atl' || url.pathname.startsWith('/api/ath-atl')) {
      if (typeof ath.onRequest === 'function') return ath.onRequest(context);
    }

    // Network metrics endpoint
    if (url.pathname === '/api/network' || url.pathname.startsWith('/api/network')) {
      if (typeof network.onRequest === 'function') return network.onRequest(context);
    }

    // Issuance history endpoint
    if (url.pathname === '/api/issuance_history' || url.pathname.startsWith('/api/issuance_history')) {
      if (typeof issuance.onRequest === 'function') return issuance.onRequest(context);
    }

    // Top subnets endpoint
    if (url.pathname === '/api/top_subnets' || url.pathname.startsWith('/api/top_subnets')) {
      if (typeof topSubnets.onRequest === 'function') return topSubnets.onRequest(context);
    }

    // Taostats history endpoint
    if (url.pathname === '/api/taostats_history' || url.pathname.startsWith('/api/taostats_history')) {
      if (typeof taostatsHistory.onRequest === 'function') return taostatsHistory.onRequest(context);
    }

    // Taostats latest endpoint
    if (url.pathname === '/api/taostats' || url.pathname.startsWith('/api/taostats')) {
      if (typeof taostats.onRequest === 'function') return taostats.onRequest(context);
    }

    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }
};
