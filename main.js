// main.js
// Central loader for robust dashboard boot and modular initialization

(function() {
  // Wait for DOM and all scripts to be ready
  function startDashboard() {
    // 1. Terminal boot overlay (if present)
    if (typeof window.runTerminalBoot === 'function') {
      window.runTerminalBoot();
    } else {
      // If no boot overlay, start dashboard immediately
      if (typeof window.initDashboard === 'function') window.initDashboard();
    }
    // Listen for terminal boot done event (if overlay is used)
    document.addEventListener('terminalBootDone', function() {
      if (typeof window.initDashboard === 'function') window.initDashboard();
      if (typeof window.startAutoRefresh === 'function') window.startAutoRefresh();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDashboard);
  } else {
    startDashboard();
  }
})();
