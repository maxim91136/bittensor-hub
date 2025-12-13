// ===== API Functions (ES6 Module) =====
import { API_BASE } from './config.js';

/**
 * Fetch network data (validator count, active miners, etc.)
 */
export async function fetchNetworkData() {
  try {
    const res = await fetch(`${API_BASE}/network`);
    if (!res.ok) throw new Error(`Network API error: ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('❌ fetchNetworkData:', err);
    return null;
  }
}

/**
 * Fetch Taostats data (main price/volume source)
 */
export async function fetchTaostats() {
  try {
    const res = await fetch(`${API_BASE}/taostats`);
    if (!res.ok) throw new Error(`Taostats API error: ${res.status}`);
    const data = await res.json();
    if (!data || !data.circulating_supply || !data.price) throw new Error('No valid Taostats data');
    return {
      ...data,
      last_updated: data.last_updated || data._timestamp || null,
      _source: 'taostats'
    };
  } catch (err) {
    console.warn('⚠️ Taostats fetch failed:', err);
    return null;
  }
}

/**
 * Fetch Block Time data from our API
 */
export async function fetchBlockTime() {
  try {
    const res = await fetch(`${API_BASE}/block_time`);
    if (!res.ok) throw new Error(`Block Time API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('⚠️ Block Time fetch failed:', err);
    return null;
  }
}

/**
 * Fetch Staking APR data from our API
 */
export async function fetchStakingApr() {
  try {
    const res = await fetch(`${API_BASE}/staking_apy`);
    if (!res.ok) throw new Error(`Staking APR API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('⚠️ Staking APR fetch failed:', err);
    return null;
  }
}

/**
 * Fetch ATH/ATL data for distance calculation
 */
export async function fetchAthAtl() {
  try {
    const res = await fetch('/api/ath-atl', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('📊 Failed to fetch ATH/ATL:', e);
    return null;
  }
}

/**
 * Fetch taostats aggregates (for MA data)
 */
export async function fetchTaostatsAggregates() {
  try {
    const res = await fetch('/api/taostats_aggregates', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('📊 Failed to fetch taostats aggregates:', e);
    return null;
  }
}

/**
 * Fetch Fear & Greed Index data with CoinGecko fallback
 */
export async function fetchFearAndGreed() {
  // Primary: Alternative.me via our API
  try {
    const res = await fetch('/api/fear_and_greed_index', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.current && data.current.value !== undefined) {
        data._source = 'alternative.me';
        return data;
      }
    }
  } catch (e) {
    if (window._debug) console.debug('fetchFearAndGreed Alternative.me failed', e);
  }

  // Fallback: Derive F&G from CoinGecko global market data
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const change24h = data?.data?.market_cap_change_percentage_24h_usd;
      if (change24h !== undefined && change24h !== null) {
        // Convert market cap change to F&G scale (0-100)
        // -10% or worse = 10 (Extreme Fear), +10% or better = 90 (Extreme Greed)
        const fgValue = Math.max(0, Math.min(100, 50 + (change24h * 4)));
        let classification = 'Neutral';
        if (fgValue < 25) classification = 'Extreme Fear';
        else if (fgValue < 45) classification = 'Fear';
        else if (fgValue < 55) classification = 'Neutral';
        else if (fgValue < 75) classification = 'Greed';
        else classification = 'Extreme Greed';

        return {
          current: {
            value: Math.round(fgValue),
            classification: classification
          },
          _source: 'coingecko-derived'
        };
      }
    }
  } catch (e) {
    if (window._debug) console.debug('fetchFearAndGreed CoinGecko fallback failed', e);
  }

  return null;
}
