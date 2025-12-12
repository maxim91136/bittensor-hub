// ===== Matrix Terminal Boot Sequence =====
(function() {
  const lines = [
    '> connecting to bittensor...',
    '> decrypting network data...',
    '> [pill me]'
  ];
  const delays = [800, 800, 600]; // ms per line
  const fadeDelay = 400;

  function runTerminalBoot() {
    const overlay = document.getElementById('terminalBoot');
    if (!overlay) return;

    const line1 = document.getElementById('termLine1');
    const line2 = document.getElementById('termLine2');
    const line3 = document.getElementById('termLine3');
    const lineEls = [line1, line2, line3];

    let i = 0;
    // safety: if the boot sequence doesn't finish (runtime error or missing elements),
    // force-hide the overlay after a short timeout so init can continue.
    const MAX_BOOT_MS = 5000;
    const forcedTimeout = setTimeout(() => {
      try {
        overlay.classList.add('fade-out');
        setTimeout(() => {
          overlay.classList.add('hidden');
          const ev = new CustomEvent('terminalBootDone');
          document.dispatchEvent(ev);
        }, fadeDelay);
      } catch (e) {
        if (window._debug) console.warn('terminalBoot forced hide failed', e);
      }
    }, MAX_BOOT_MS);
    function showNext() {
      if (i < lines.length) {
        lineEls[i].textContent = lines[i];
        lineEls[i].classList.add('visible');

        i++;
        setTimeout(showNext, delays[i - 1]);
      } else {
        // All lines shown, wait then fade out
        clearTimeout(forcedTimeout);
        setTimeout(() => {
          overlay.classList.add('fade-out');
          setTimeout(() => {
            overlay.classList.add('hidden');
            // Notify that terminal boot finished so UI/data can re-verify
            try {
              const ev = new CustomEvent('terminalBootDone');
              document.dispatchEvent(ev);
            } catch (e) { /* ignore */ }
          }, fadeDelay);
        }, 800);
      }
    }
    showNext();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTerminalBoot);
  } else {
    runTerminalBoot();
  }
})();

// If the terminal boot hides or races with our dashboard init, ensure we re-run init
document.addEventListener('terminalBootDone', async () => {
  try {
    // If dashboard already initialized, do nothing
    if (window._dashboardInitialized) return;
    // If an init is in progress, wait a bit and return
    if (window._dashboardInitInProgress) return;
    // Try to initialize dashboard now that terminal overlay is gone
    await initDashboard();
    // Also ensure other key UI pieces are refreshed in case they failed earlier
    try { await updateAthAtlPills(); } catch (e) {}
    try { await updateBlockTime(); } catch (e) {}
    try { await updateStakingApr(); } catch (e) {}
  } catch (err) {
    if (window._debug) console.warn('terminalBootDone handler error', err);
  }
});

// Ensure auto-refresh runs even if init failed (so periodic retries happen)
function ensureAutoRefreshStarted() {
  try {
    if (typeof refreshTimer === 'undefined' || refreshTimer === null) {
      startAutoRefresh();
    }
  } catch (e) {
    if (window._debug) console.warn('ensureAutoRefreshStarted error', e);
  }
}

// After terminal boot, double-check key UI elements and trigger a refresh if still empty
document.addEventListener('terminalBootDone', () => {
  ensureAutoRefreshStarted();
  // short delay to let any pending UI updates settle
  setTimeout(() => {
    try {
      const priceEl = document.getElementById('taoPrice');
      const changeEl = document.getElementById('priceChange');
      const halvingEl = document.getElementById('halvingCountdown');
      const needRefresh = (
        !priceEl || priceEl.textContent.trim() === '' || priceEl.classList.contains('skeleton-text')
      );
      if (needRefresh) {
        if (window._debug) console.log('terminalBootDone fallback: triggering refreshDashboard()');
        refreshDashboard();
      }
    } catch (e) {
      if (window._debug) console.warn('terminalBootDone fallback check failed', e);
    }
  }, 1200);
});
