// refresh.js
// Auto-Refresh Button and Logic

const REFRESH_SECONDS = 60;
let refreshCountdown = REFRESH_SECONDS;
let refreshTimer = null;

function renderRefreshIndicator() {
  const el = document.getElementById('refresh-indicator');
  if (!el) return;
  const radius = 7;
  const stroke = 2.2;
  const circ = 2 * Math.PI * radius;
  const progress = (refreshCountdown / REFRESH_SECONDS);
  el.innerHTML = `
    <svg viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" stroke="#222" stroke-width="2.2" fill="none"/>
      <circle cx="10" cy="10" r="8" stroke="#22c55e" stroke-width="2.2" fill="none"
        stroke-dasharray="${2 * Math.PI * 8}" stroke-dashoffset="${2 * Math.PI * 8 * (1 - progress)}"
        style="transition: stroke-dashoffset 0.5s;"/>
    </svg>
    <span class="refresh-label">${refreshCountdown}</span>
  `;
  el.title = `Auto-refresh in ${refreshCountdown}s`;
  el.style.pointerEvents = "none";
}

function startAutoRefresh() {
  renderRefreshIndicator();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    refreshCountdown--;
    if (refreshCountdown <= 0) {
      refreshCountdown = REFRESH_SECONDS;
      if (typeof refreshDashboard === 'function') {
        refreshDashboard();
        if (typeof window.showMatrixGlitch === 'function') {
          setTimeout(() => window.showMatrixGlitch(), 0);
        }
      }
    }
    renderRefreshIndicator();
  }, 1000);
  // No click handler: refresh indicator is not clickable
}

window.startAutoRefresh = startAutoRefresh;
