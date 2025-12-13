// ===== Volume Signal (Ampelsystem) Module (ES6) =====
// Traffic light system for volume/price correlation analysis

import { API_BASE } from './config.js';
import { fetchTaostatsAggregates, fetchFearAndGreed } from './api.js';

// ===== State =====
let _volumeHistory = null;
let _volumeHistoryTs = 0;
let _lastVolumeSignal = null;

// ===== Configurable Thresholds =====
let VOLUME_HISTORY_TTL = 60000; // Cache history for 1 minute
let VOLUME_SIGNAL_THRESHOLD = 3; // ±3% threshold for "significant" change
let PRICE_SPIKE_PCT = 10; // if price moves >= 10% in 24h consider spike
let LOW_VOL_PCT = 5;     // if volume change < 5% treat as low-volume move
let SUSTAIN_VOL_PCT = 6; // sustained volume increase threshold (24h)
let TRADED_SHARE_MIN = 0.1; // percent of circ supply traded to consider move meaningful (0.1%)
let SUSTAIN_PRICE_PCT = 8; // lower price pct that can indicate sustained move when combined with other signals
let HYSTERESIS_REQUIRED = 2; // require 2 consecutive checks to mark sustained
let STRICT_DOWN_ALWAYS_RED = false; // runtime toggle to force strict down->RED rule

// Apply optional runtime overrides from `window.VOLUME_SIGNAL_CONFIG` (set in console)
try {
  if (typeof window !== 'undefined' && window.VOLUME_SIGNAL_CONFIG && typeof window.VOLUME_SIGNAL_CONFIG === 'object') {
    const cfg = window.VOLUME_SIGNAL_CONFIG;
    if (typeof cfg.VOLUME_HISTORY_TTL === 'number') VOLUME_HISTORY_TTL = cfg.VOLUME_HISTORY_TTL;
    if (typeof cfg.VOLUME_SIGNAL_THRESHOLD === 'number') VOLUME_SIGNAL_THRESHOLD = cfg.VOLUME_SIGNAL_THRESHOLD;
    if (typeof cfg.PRICE_SPIKE_PCT === 'number') PRICE_SPIKE_PCT = cfg.PRICE_SPIKE_PCT;
    if (typeof cfg.LOW_VOL_PCT === 'number') LOW_VOL_PCT = cfg.LOW_VOL_PCT;
    if (typeof cfg.SUSTAIN_VOL_PCT === 'number') SUSTAIN_VOL_PCT = cfg.SUSTAIN_VOL_PCT;
    if (typeof cfg.TRADED_SHARE_MIN === 'number') TRADED_SHARE_MIN = cfg.TRADED_SHARE_MIN;
    if (typeof cfg.SUSTAIN_PRICE_PCT === 'number') SUSTAIN_PRICE_PCT = cfg.SUSTAIN_PRICE_PCT;
    if (typeof cfg.HYSTERESIS_REQUIRED === 'number') HYSTERESIS_REQUIRED = cfg.HYSTERESIS_REQUIRED;
    if (typeof cfg.STRICT_DOWN_ALWAYS_RED === 'boolean') STRICT_DOWN_ALWAYS_RED = cfg.STRICT_DOWN_ALWAYS_RED;
  }
} catch (e) { /* ignore */ }

/**
 * Apply a volume signal config at runtime without reloading the page.
 * Usage: window.applyVolumeConfig({ VOLUME_SIGNAL_THRESHOLD: 2, STRICT_DOWN_ALWAYS_RED: true })
 */
export function applyVolumeConfig(cfg) {
  try {
    window.VOLUME_SIGNAL_CONFIG = Object.assign({}, window.VOLUME_SIGNAL_CONFIG || {}, cfg || {});
    const c = window.VOLUME_SIGNAL_CONFIG;
    if (typeof c.VOLUME_HISTORY_TTL === 'number') VOLUME_HISTORY_TTL = c.VOLUME_HISTORY_TTL;
    if (typeof c.VOLUME_SIGNAL_THRESHOLD === 'number') VOLUME_SIGNAL_THRESHOLD = c.VOLUME_SIGNAL_THRESHOLD;
    if (typeof c.PRICE_SPIKE_PCT === 'number') PRICE_SPIKE_PCT = c.PRICE_SPIKE_PCT;
    if (typeof c.LOW_VOL_PCT === 'number') LOW_VOL_PCT = c.LOW_VOL_PCT;
    if (typeof c.SUSTAIN_VOL_PCT === 'number') SUSTAIN_VOL_PCT = c.SUSTAIN_VOL_PCT;
    if (typeof c.TRADED_SHARE_MIN === 'number') TRADED_SHARE_MIN = c.TRADED_SHARE_MIN;
    if (typeof c.SUSTAIN_PRICE_PCT === 'number') SUSTAIN_PRICE_PCT = c.SUSTAIN_PRICE_PCT;
    if (typeof c.HYSTERESIS_REQUIRED === 'number') HYSTERESIS_REQUIRED = c.HYSTERESIS_REQUIRED;
    if (typeof c.STRICT_DOWN_ALWAYS_RED === 'boolean') STRICT_DOWN_ALWAYS_RED = c.STRICT_DOWN_ALWAYS_RED;
    if (window._debug) console.log('applyVolumeConfig applied', window.VOLUME_SIGNAL_CONFIG);
    return true;
  } catch (e) {
    console.warn('applyVolumeConfig failed', e);
    return false;
  }
}

/**
 * Fetch taostats history for volume change calculation
 */
export async function fetchVolumeHistory() {
  // Use cached history if fresh
  if (_volumeHistory && (Date.now() - _volumeHistoryTs) < VOLUME_HISTORY_TTL) {
    return _volumeHistory;
  }
  try {
    const res = await fetch(`${API_BASE}/taostats_history`);
    if (!res.ok) throw new Error(`History API error: ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      _volumeHistory = data;
      _volumeHistoryTs = Date.now();
      return data;
    }
    return null;
  } catch (err) {
    if (window._debug) console.warn('⚠️ Volume history fetch failed:', err);
    return null;
  }
}

/**
 * Calculate volume change percentage from history
 * Compares current volume with volume from ~24h ago (or oldest available)
 * Returns: { change: number, confidence: 'high'|'medium'|'low', samples: number }
 */
export function calculateVolumeChange(history, currentVolume) {
  if (!Array.isArray(history) || history.length < 2 || !currentVolume) return null;

  // Find entry from ~24h ago (or use oldest available)
  const now = Date.now();
  const targetTime = now - 24 * 60 * 60 * 1000; // 24h ago

  // Sort by timestamp ascending
  const sorted = [...history].sort((a, b) =>
    new Date(a._timestamp).getTime() - new Date(b._timestamp).getTime()
  );

  // Find the entry closest to 24h ago
  let oldEntry = sorted[0]; // fallback to oldest
  for (const entry of sorted) {
    const entryTime = new Date(entry._timestamp).getTime();
    if (entryTime <= targetTime) {
      oldEntry = entry;
    } else {
      break;
    }
  }

  const oldVolume = oldEntry?.volume_24h;
  if (!oldVolume || oldVolume <= 0) return null;

  const change = ((currentVolume - oldVolume) / oldVolume) * 100;

  // Calculate confidence based on history coverage for 24h comparison
  const oldestTime = new Date(sorted[0]._timestamp).getTime();
  const hoursOfData = (now - oldestTime) / (60 * 60 * 1000);
  const samples = sorted.length;

  // Confidence levels for 24h volume change:
  // - High: ≥22h coverage with ≥50 samples (near-complete 24h data)
  // - Medium: ≥16h coverage with ≥30 samples (decent coverage)
  // - Low: less data, signal may be unreliable
  let confidence = 'low';
  if (hoursOfData >= 22 && samples >= 50) {
    confidence = 'high';
  } else if (hoursOfData >= 16 && samples >= 30) {
    confidence = 'medium';
  }

  return { change, confidence, samples, hoursOfData: Math.round(hoursOfData), oldVolume, oldTimestamp: oldEntry?._timestamp };
}

/**
 * Volume Signal (Ampelsystem) Logic
 * Returns: { signal: 'green'|'red'|'yellow'|'orange'|'neutral', tooltip: string }
 *
 * Signals:
 * 🟢 GREEN:  Volume ↑ + Price ↑ = Bullish (strong demand, healthy uptrend)
 * 🔴 RED:    Volume ↑ + Price ↓ = Bearish/Distribution (panic selling)
 * 🟡 YELLOW: Volume ↓ + Price ↑ = Weak uptrend (losing momentum)
 *            Volume ↓ + Price ↓ = Consolidation (low interest)
 * 🟠 ORANGE: Volume ↑ + Price stable = Potential breakout incoming
 * ⚪ NEUTRAL: No significant change
 */
export function getVolumeSignal(volumeData, priceChange, currentVolume = null, aggregates = null, fngData = null, lastPrice = null) {
  // Handle missing data
  if (volumeData === null || priceChange === null) {
    return { signal: 'neutral', tooltip: 'Insufficient data for signal' };
  }

  // Check if weekend (UTC) and adjust thresholds
  const now = new Date();
  const dayUTC = now.getUTCDay(); // 0=Sunday, 6=Saturday
  const isWeekend = (dayUTC === 0 || dayUTC === 6);
  const weekendNote = isWeekend ? '\n\n📅 Weekend — typically lower activity' : '';

  // Support both old format (number) and new format (object with change, confidence)
  const volumeChange = typeof volumeData === 'object' ? volumeData.change : volumeData;
  const confidence = typeof volumeData === 'object' ? volumeData.confidence : null;
  const samples = typeof volumeData === 'object' ? volumeData.samples : null;
  const hoursOfData = typeof volumeData === 'object' ? volumeData.hoursOfData : null;

  // Weekend mode: Higher thresholds (lower activity is normal)
  const threshold = isWeekend ? VOLUME_SIGNAL_THRESHOLD * 1.5 : VOLUME_SIGNAL_THRESHOLD;
  const volUp = volumeChange > threshold;
  const volDown = volumeChange < -threshold;
  const priceUp = priceChange > threshold;
  const priceDown = priceChange < -threshold;
  const priceStable = !priceUp && !priceDown;

  const volStr = volumeChange >= 0 ? `+${volumeChange.toFixed(2)}%` : `${volumeChange.toFixed(2)}%`;
  const priceStr = priceChange >= 0 ? `+${priceChange.toFixed(2)}%` : `${priceChange.toFixed(2)}%`;

  // Build confidence line
  let confidenceLine = '';
  if (confidence) {
    confidenceLine = `\n\nConfidence: ${confidence} (${samples} samples, ${hoursOfData}h data)`;
  }

  // Composite detection: Sustained bullish vs short spikes + Market phase
  try {
    // Determine MA alignment and market phase
    const maShortVal = aggregates?.ma_short ?? null;
    const maMedVal = aggregates?.ma_med ?? null;
    const ma3dVal = aggregates?.ma_3d ?? null;
    const ma7dVal = aggregates?.ma_7d ?? null;

    // MA alignment (bullish structure)
    const masAligned = maShortVal !== null && maMedVal !== null && ma3dVal !== null && (maShortVal > maMedVal && maMedVal > ma3dVal);

    // Long-term market phase (7d trend) + Fear & Greed integration
    let marketPhase = 'neutral';
    let marketPhaseNote = '';

    // Get Fear & Greed status
    let fngSentiment = null;
    let fngValue = null;
    let fngClass = null;
    if (fngData && fngData.current) {
      fngValue = parseInt(fngData.current.value);
      fngClass = fngData.current.value_classification?.toLowerCase();
      // Map to sentiment
      if (fngClass === 'extreme fear') fngSentiment = 'extreme_fear';
      else if (fngClass === 'fear') fngSentiment = 'fear';
      else if (fngClass === 'neutral') fngSentiment = 'neutral';
      else if (fngClass === 'greed') fngSentiment = 'greed';
      else if (fngClass === 'extreme greed') fngSentiment = 'extreme_greed';
    }

    if (ma3dVal && ma7dVal) {
      const ma7dTrend = ((ma3dVal - ma7dVal) / ma7dVal) * 100;

      // Base market phase from MA trend
      if (ma7dTrend > 5) {
        marketPhase = 'bullish';
        let phaseText = `📈 Market: Bullish (+${ma7dTrend.toFixed(2)}% Vol. MA 3d/7d)`;

        // Add Fear & Greed context
        if (fngSentiment === 'extreme_greed') {
          phaseText += `\n⚠️ Sentiment: Extreme Greed (${fngValue})\n🌡️ overheating?\n📊 max optimism`;
        } else if (fngSentiment === 'greed') {
          phaseText += `\n🔥 Sentiment: Greed (${fngValue})\n✨ euphoria?\n📊 high optimism`;
        } else if (fngSentiment === 'extreme_fear' || fngSentiment === 'fear') {
          phaseText += `\n✅ Sentiment: ${fngClass} (${fngValue})\n🤔 divergence?\n📊 fear in uptrend`;
        }

        marketPhaseNote = `\n${phaseText}`;
      } else if (ma7dTrend < -5) {
        marketPhase = 'bearish';
        let phaseText = `📉 Market: Bearish (-${Math.abs(ma7dTrend).toFixed(2)}% Vol. MA 3d/7d)`;

        // Add Fear & Greed context
        if (fngSentiment === 'extreme_fear') {
          phaseText += `\n🔻 Sentiment: Extreme Fear (${fngValue})\n💀 capitulation?\n📊 max selling pressure`;
        } else if (fngSentiment === 'fear') {
          phaseText += `\n😰 Sentiment: Fear (${fngValue})\n😟 panic?\n📊 selling pressure`;
        } else if (fngSentiment === 'extreme_greed' || fngSentiment === 'greed') {
          phaseText += `\n⚠️ Sentiment: ${fngClass} (${fngValue})\n🔀 disconnect?\n📊 greed in downtrend`;
        }

        marketPhaseNote = `\n${phaseText}`;
      } else {
        const absValue = Math.abs(ma7dTrend).toFixed(2);
        const sign = ma7dTrend >= 0 ? '+' : '-';
        let phaseText = `➡️ Market: Neutral (${sign}${absValue}% Vol. MA 3d/7d)`;

        // Add Fear & Greed as primary indicator in neutral markets
        if (fngSentiment === 'extreme_greed') {
          phaseText += `\n⚠️ Sentiment: Extreme Greed (${fngValue})\n🎯 correction?\n📊 high sentiment`;
        } else if (fngSentiment === 'extreme_fear') {
          phaseText += `\n💎 Sentiment: Extreme Fear (${fngValue})\n😰 extreme fear?\n📊 low sentiment`;
        } else if (fngSentiment) {
          phaseText += `\n😐 Sentiment: ${fngClass} (${fngValue})`;
        }

        marketPhaseNote = `\n${phaseText}`;
      }
    } else if (fngSentiment) {
      // No MA data available, use Fear & Greed as fallback
      marketPhaseNote = `\n😐 Sentiment: ${fngClass} (${fngValue})`;
    }

    // STRICT RULE (refined): Only RED when significant drop + no MA support
    const significantDrop = volumeChange < -threshold * 1.5 && priceChange < -threshold * 1.5;

    if (STRICT_DOWN_ALWAYS_RED && significantDrop && marketPhase !== 'bullish') {
      const volStrStrict = volumeChange >= 0 ? `+${volumeChange.toFixed(2)}%` : `${volumeChange.toFixed(2)}%`;
      const priceStrStrict = priceChange >= 0 ? `+${priceChange.toFixed(2)}%` : `${priceChange.toFixed(2)}%`;
      if (window._debug) console.debug('Ampelsystem strict rule: significant drop in non-bullish phase', {priceChange, volumeChange, marketPhase});
      return {
        signal: 'red',
        tooltip: `🔴 Bearish
Volume: ${volStrStrict}
Price: ${priceStrStrict}
Both declining — downward momentum${marketPhaseNote}` + (confidenceLine || '') + weekendNote
      };
    }
    if (volumeChange < 0 && priceChange < 0 && (confidence !== 'high' || !masAligned) && marketPhase !== 'bullish') {
      const volStrStrict = volumeChange >= 0 ? `+${volumeChange.toFixed(2)}%` : `${volumeChange.toFixed(2)}%`;
      const priceStrStrict = priceChange >= 0 ? `+${priceChange.toFixed(2)}%` : `${priceChange.toFixed(2)}%`;
      if (window._debug) console.debug('Ampelsystem soft strict: both down, no MA support', {priceChange, volumeChange, confidence, masAligned, marketPhase});
      return {
        signal: 'red',
        tooltip: `🔴 Bearish\nVolume: ${volStrStrict}\nPrice: ${priceStrStrict}\nBoth declining — downward momentum${marketPhaseNote}` + (confidenceLine || '') + weekendNote
      };
    }
    // traded share (percent) if data available — convert USD volume to TAO using lastPrice when possible
    let tradedSharePct = null;
    if (currentVolume && window.circulatingSupply) {
      try {
        if (typeof lastPrice === 'number' && lastPrice > 0) {
          const volumeInTao = Number(currentVolume) / Number(lastPrice);
          tradedSharePct = (volumeInTao / window.circulatingSupply) * 100;
        } else {
          tradedSharePct = null;
        }
      } catch (e) {
        tradedSharePct = null;
      }
    }
    // sustain if MAs aligned AND (volume up OR traded share large (with non-negative price) OR strong price move)
    const tradedShareGood = (tradedSharePct !== null && tradedSharePct >= TRADED_SHARE_MIN && priceChange >= -2.0);
    const sustainCondition = masAligned && (
      volumeChange >= SUSTAIN_VOL_PCT ||
      tradedShareGood ||
      (priceChange >= SUSTAIN_PRICE_PCT)
    );
    // If traded-share or strong price move is present, consider sustained immediately
    if (masAligned && (tradedShareGood || priceChange >= SUSTAIN_PRICE_PCT)) {
      return {
        signal: 'green',
        tooltip: `🟢 Strong Bullish\nVolume: ${volStr}\nPrice: ${priceStr}\nSustained upward momentum confirmed${marketPhaseNote}` + (confidenceLine || '') + weekendNote
      };
    }
    // Otherwise use hysteresis to avoid flapping for marginal signals
    if (sustainCondition) {
      window._sustainedBullishCount = (window._sustainedBullishCount || 0) + 1;
    } else {
      window._sustainedBullishCount = 0;
    }
    if ((window._sustainedBullishCount || 0) >= HYSTERESIS_REQUIRED) {
      return {
        signal: 'green',
        tooltip: `🟢 Strong Bullish\nVolume: ${volStr}\nPrice: ${priceStr}\nSustained upward momentum confirmed${marketPhaseNote}` + (confidenceLine || '') + weekendNote
      };
    }
  } catch (e) {
    if (window._debug) console.debug('sustained detection failed', e);
  }

  // Build market phase note for standard signals (fallback if not in try block)
  let marketPhaseNote = '';
  try {
    const ma3dVal = aggregates?.ma_3d ?? null;
    const ma7dVal = aggregates?.ma_7d ?? null;

    // Get Fear & Greed status (fallback)
    let fngSentiment = null;
    let fngValue = null;
    let fngClass = null;
    if (fngData && fngData.current) {
      fngValue = parseInt(fngData.current.value);
      fngClass = fngData.current.value_classification?.toLowerCase();
      if (fngClass === 'extreme fear') fngSentiment = 'extreme_fear';
      else if (fngClass === 'fear') fngSentiment = 'fear';
      else if (fngClass === 'neutral') fngSentiment = 'neutral';
      else if (fngClass === 'greed') fngSentiment = 'greed';
      else if (fngClass === 'extreme greed') fngSentiment = 'extreme_greed';
    }

    if (ma3dVal && ma7dVal) {
      const ma7dTrend = ((ma3dVal - ma7dVal) / ma7dVal) * 100;

      if (ma7dTrend > 5) {
        let phaseText = `📈 Market: Bullish (+${ma7dTrend.toFixed(2)}% Vol. MA 3d/7d)`;
        if (fngSentiment === 'extreme_greed') {
          phaseText += `\n⚠️ Sentiment: Extreme Greed (${fngValue})\n🌡️ overheating?\n📊 max optimism`;
        } else if (fngSentiment === 'greed') {
          phaseText += `\n🔥 Sentiment: Greed (${fngValue})\n✨ euphoria?\n📊 high optimism`;
        } else if (fngSentiment === 'extreme_fear' || fngSentiment === 'fear') {
          phaseText += `\n✅ Sentiment: ${fngClass} (${fngValue})\n🤔 divergence?\n📊 fear in uptrend`;
        }
        marketPhaseNote = `\n${phaseText}`;
      } else if (ma7dTrend < -5) {
        let phaseText = `📉 Market: Bearish (-${Math.abs(ma7dTrend).toFixed(2)}% Vol. MA 3d/7d)`;
        if (fngSentiment === 'extreme_fear') {
          phaseText += `\n🔻 Sentiment: Extreme Fear (${fngValue})\n💀 capitulation?\n📊 max selling pressure`;
        } else if (fngSentiment === 'fear') {
          phaseText += `\n😰 Sentiment: Fear (${fngValue})\n😟 panic?\n📊 selling pressure`;
        } else if (fngSentiment === 'extreme_greed' || fngSentiment === 'greed') {
          phaseText += `\n⚠️ Sentiment: ${fngClass} (${fngValue})\n🔀 disconnect?\n📊 greed in downtrend`;
        }
        marketPhaseNote = `\n${phaseText}`;
      } else {
        const absValue = Math.abs(ma7dTrend).toFixed(2);
        const sign = ma7dTrend >= 0 ? '+' : '-';
        let phaseText = `➡️ Market: Neutral (${sign}${absValue}% Vol. MA 3d/7d)`;
        if (fngSentiment === 'extreme_greed') {
          phaseText += `\n⚠️ Sentiment: Extreme Greed (${fngValue})\n🎯 correction?\n📊 high sentiment`;
        } else if (fngSentiment === 'extreme_fear') {
          phaseText += `\n💎 Sentiment: Extreme Fear (${fngValue})\n😰 extreme fear?\n📊 low sentiment`;
        } else if (fngSentiment) {
          phaseText += `\n😐 Sentiment: ${fngClass} (${fngValue})`;
        }
        marketPhaseNote = `\n${phaseText}`;
      }
    } else if (fngSentiment) {
      marketPhaseNote = `\n😐 Sentiment: ${fngClass} (${fngValue})`;
    }
  } catch (e) { /* ignore */ }

  // 🟢 GREEN: Volume up + Price up = Strong buying pressure
  if (volUp && priceUp) {
    return {
      signal: 'green',
      tooltip: `🟢 Bullish\nVolume: ${volStr}\nPrice: ${priceStr}\nStrong buying interest${marketPhaseNote}${confidenceLine}${weekendNote}`
    };
  }

  // 🔴 RED: Volume up + Price down = Distribution/Panic selling
  if (volUp && priceDown) {
    return {
      signal: 'red',
      tooltip: `🔴 Bearish\nVolume: ${volStr}\nPrice: ${priceStr}\nHigh selling pressure${marketPhaseNote}${confidenceLine}${weekendNote}`
    };
  }

  // 🟠 ORANGE: Volume up + Price stable = High activity, direction unclear
  if (volUp && priceStable) {
    return {
      signal: 'orange',
      tooltip: `🟠 Watch\nVolume: ${volStr}\nPrice: ${priceStr}\nHigh activity — direction unclear${marketPhaseNote}${confidenceLine}${weekendNote}`
    };
  }

  // Detect low-volume strong price moves (price spike on thin liquidity)
  if (priceUp && Math.abs(volumeChange) < LOW_VOL_PCT && priceChange >= PRICE_SPIKE_PCT) {
    let pctTraded = null;
    if (currentVolume && window.circulatingSupply) {
      pctTraded = (currentVolume / window.circulatingSupply) * 100;
    }
    const spikeLines = [`🟡 Low Volume Spike`, `Volume: ${volStr}`, `Price: ${priceStr}`];
    if (pctTraded !== null) spikeLines.push(`Traded: ${pctTraded.toFixed(4)}% of supply`);
    spikeLines.push('Price surge on low liquidity', confidenceLine);
    if (weekendNote) spikeLines.push(weekendNote.trim());
    return { signal: 'yellow', tooltip: spikeLines.join('\n') };
  }

  // 🟡 YELLOW: Volume down + Price up = Weak uptrend
  if (volDown && priceUp) {
    // Special-case: if price moved strongly but volume change is small, mark as low-volume price spike
    if (priceChange >= PRICE_SPIKE_PCT && Math.abs(volumeChange) < LOW_VOL_PCT) {
      let pctTraded = null;
      if (currentVolume && window.circulatingSupply) {
        pctTraded = (currentVolume / window.circulatingSupply) * 100;
      }
      const spikeLines = [`🟡 Low Volume Spike`,`Volume: ${volStr}`,`Price: ${priceStr}`];
      if (pctTraded !== null) spikeLines.push(`Traded: ${pctTraded.toFixed(4)}% of supply`);
      spikeLines.push('Price surge on low liquidity — may reverse', confidenceLine);
      if (marketPhaseNote) spikeLines.push(marketPhaseNote.trim());
      if (weekendNote) spikeLines.push(weekendNote.trim());
      return { signal: 'yellow', tooltip: spikeLines.join('\n') };
    }

    return {
      signal: 'yellow',
      tooltip: `🟡 Caution\nVolume: ${volStr}\nPrice: ${priceStr}\nWeak momentum — needs volume confirmation${marketPhaseNote}${confidenceLine}${weekendNote}`
    };
  }

  // Vol↓ + Price↓: Consolidation or Slightly bearish
  if (volDown && priceDown) {
    // If price drop is meaningful, mark as bearish
    const SLIGHT_BEAR_PCT = 2.0; // 2% price drop threshold
    if (priceChange <= -SLIGHT_BEAR_PCT) {
      return {
        signal: 'red',
        tooltip: `🔴 Bearish\nVolume: ${volStr}\nPrice: ${priceStr}\nDecline on reduced interest${marketPhaseNote}${confidenceLine}${weekendNote}`
      };
    }
    return {
      signal: 'yellow',
      tooltip: `🟡 Consolidation\nVolume: ${volStr}\nPrice: ${priceStr}\nLow activity — sideways movement${marketPhaseNote}${confidenceLine}${weekendNote}`
    };
  }

  // ⚪ STABLE: No significant movement
  return {
    signal: 'neutral',
    tooltip: `⚪ Stable\nVolume: ${volStr}\nPrice: ${priceStr}\nQuiet market${marketPhaseNote}${confidenceLine}${weekendNote}`
  };
}

/**
 * Apply volume signal to the Volume card
 * All signals (including neutral/white) get their own glow animation.
 */
function applyVolumeSignal(signal, tooltip) {
  const volumeCard = document.getElementById('volume24h')?.closest('.stat-card');
  if (!volumeCard) return;

  const infoBadge = volumeCard.querySelector('.info-badge');
  const baseTooltip = 'TAO trading volume in the last 24 hours';

  // Always update tooltip
  if (infoBadge && tooltip) {
    infoBadge.setAttribute('data-tooltip', `${baseTooltip}\n\n${tooltip}`);
  }

  // If same signal as before, don't touch the classes (keeps animation smooth)
  if (signal === _lastVolumeSignal) {
    if (window._debug) console.log(`📊 Volume Signal: unchanged (${signal})`);
    return;
  }

  // Signal changed - update classes
  const allBlinkClasses = ['blink-green', 'blink-red', 'blink-yellow', 'blink-orange', 'blink-white'];

  // Map neutral to white for CSS class
  const cssSignal = signal === 'neutral' ? 'white' : signal;

  // Add new class first, then remove others (prevents flash to default)
  volumeCard.classList.add(`blink-${cssSignal}`);
  allBlinkClasses.filter(c => c !== `blink-${cssSignal}`).forEach(c => volumeCard.classList.remove(c));
  _lastVolumeSignal = signal;
  if (window._debug) console.log(`📊 Volume Signal: changed to ${signal}`, tooltip);

  // Ensure we don't inject a subtitle that shifts layout; remove any existing `.stat-sub`
  try {
    const existingSub = volumeCard.querySelector('.stat-sub');
    if (existingSub) existingSub.remove();
  } catch (e) {
    if (window._debug) console.debug('Failed to cleanup volume subtitle', e);
  }
}

/**
 * Format compact dollar amount for MA display
 */
function formatMADollar(num) {
  if (num === null || num === undefined) return '—';
  if (Math.abs(num) >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
  if (Math.abs(num) >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
  if (Math.abs(num) >= 1e3) return '$' + (num / 1e3).toFixed(2) + 'k';
  return '$' + Number(num).toLocaleString();
}

/**
 * Format percentage for MA display
 */
function formatMAPct(num) {
  if (num === null || num === undefined) return '—';
  const pct = (num * 100).toFixed(2);
  return num >= 0 ? `+${pct}%` : `${pct}%`;
}

/**
 * Update volume signal - call this when refreshing data
 * @param {number} currentVolume - Current 24h volume
 * @param {number} priceChange24h - Price change percentage
 * @param {number} lastPrice - Current TAO price (for traded share calculation)
 */
export async function updateVolumeSignal(currentVolume, priceChange24h, lastPrice = null) {
  const history = await fetchVolumeHistory();
  const volumeData = calculateVolumeChange(history, currentVolume);
  // Fetch MA aggregates to help detect sustained moves
  const aggregates = await fetchTaostatsAggregates();
  // Fetch Fear & Greed data for sentiment analysis
  const fngData = await fetchFearAndGreed();
  let { signal, tooltip } = getVolumeSignal(volumeData, priceChange24h, currentVolume, aggregates, fngData, lastPrice);
  // Add last updated if available
  let lastUpdatedStr = null;
  if (aggregates && aggregates.last_updated) {
    lastUpdatedStr = new Date(aggregates.last_updated).toLocaleString();
  } else if (volumeData && volumeData.last_updated) {
    lastUpdatedStr = new Date(volumeData.last_updated).toLocaleString();
  }

  // Fetch MA data and append to tooltip (we already fetched `aggregates` above)
  if (aggregates && aggregates.ma_short) {
    const maLines = [];
    maLines.push('\n\n📈 Moving Averages:');
    if (aggregates.ma_short) {
      maLines.push(`MA-2h: ${formatMADollar(aggregates.ma_short)} (${formatMAPct(aggregates.pct_change_vs_ma_short)})`);
    }
    if (aggregates.ma_med) {
      maLines.push(`MA-4h: ${formatMADollar(aggregates.ma_med)} (${formatMAPct(aggregates.pct_change_vs_ma_med)})`);
    }
    if (aggregates.ma_3d) {
      maLines.push(`MA-3d: ${formatMADollar(aggregates.ma_3d)} (${formatMAPct(aggregates.pct_change_vs_ma_3d)})`);
    }
    if (aggregates.ma_7d) {
      maLines.push(`MA-7d: ${formatMADollar(aggregates.ma_7d)} (${formatMAPct(aggregates.pct_change_vs_ma_7d)})`);
    }
    tooltip += maLines.join('\n');
  }

  // Add last updated to tooltip
  if (lastUpdatedStr) {
    tooltip += `\n\nLast updated: ${lastUpdatedStr}`;
  }

  // Always log signal calculation for debugging
  const volPct = volumeData?.change?.toFixed(1) ?? 'null';
  const conf = volumeData?.confidence ?? 'n/a';
  console.log(`📊 Signal calc: vol=${volPct}%, price=${priceChange24h?.toFixed(1)}%, conf=${conf} → ${signal}`);

  applyVolumeSignal(signal, tooltip);
}

// Expose applyVolumeConfig on window for console debugging
if (typeof window !== 'undefined') {
  window.applyVolumeConfig = applyVolumeConfig;
}
