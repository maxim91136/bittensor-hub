// ===== Seasonal Effects (ES6 Module) =====
// Holiday Snowfall, NYE Sparkles, Spring Elements, Autumn Leaves

/**
 * Check if holiday snowfall is enabled
 */
function isHolidayEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('holiday') === '1') return true;
    if (params.get('holiday') === '0') return false;
  } catch (e) { /* ignore */ }
  if (document.body.classList.contains('holiday')) return true;
  // Auto-enable during winter season by default: Dec 1 → Feb 28/29
  const now = new Date();
  const m = now.getMonth() + 1; // 1-12
  if (m === 12 || m === 1 || m === 2) return true;
  return false;
}

/**
 * Enable snowfall effect
 */
function enableSnowfall() {
  const container = document.getElementById('snowfall');
  if (!container) return;
  // Keep it small and performant (reduced counts for lower CPU/GPU)
  const baseFlakes = window.innerWidth < 420 ? 12 : 18;
  const flakes = Math.max(1, Math.floor(baseFlakes * 0.5));
  container.innerHTML = '';
  for (let i = 0; i < flakes; i++) {
    const s = document.createElement('span');
    s.className = 'snowflake';
    const left = Math.random() * 100;
    const size = Math.floor(6 + Math.random() * 10); // px (smaller)
    const dur = (8 + Math.random() * 12).toFixed(2); // seconds (slower fall)
    const delay = (Math.random() * -12).toFixed(2);
    s.style.left = `${left}%`;
    s.style.fontSize = `${size}px`;
    s.style.opacity = (0.35 + Math.random() * 0.55).toString();
    s.style.animationDuration = `${dur}s, ${10 + Math.random() * 8}s`;
    s.style.animationDelay = `${delay}s, ${delay}s`;
    container.appendChild(s);
  }
  // Add a couple of larger, slower flakes for visual interest
  const baseLarge = window.innerWidth < 420 ? 1 : 3;
  const largeCount = Math.max(0, Math.floor(baseLarge * 0.5));
  for (let i = 0; i < largeCount; i++) {
    const L = document.createElement('span');
    L.className = 'snowflake large';
    const leftL = Math.random() * 100;
    const sizeL = Math.floor(22 + Math.random() * 24); // px - big flakes
    const durL = (14 + Math.random() * 12).toFixed(2); // seconds, slow fall
    const delayL = (Math.random() * -20).toFixed(2);
    L.style.left = `${leftL}%`;
    L.style.fontSize = `${sizeL}px`;
    L.style.opacity = (0.7 + Math.random() * 0.3).toString();
    L.style.animationDuration = `${durL}s, ${14 + Math.random() * 10}s`;
    L.style.animationDelay = `${delayL}s, ${delayL}s`;
    container.appendChild(L);
  }
}

/**
 * Initialize holiday snowfall
 */
export function initHolidaySnowfall() {
  try {
    if (isHolidayEnabled()) {
      enableSnowfall();
    } else {
      const c = document.getElementById('snowfall');
      if (c) c.innerHTML = '';
    }
  } catch (e) {
    if (window._debug) console.warn('Snowfall init failed', e);
  }
}

// ===== NYE Sparkles =====

function isNyeEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('nye') === '1') return true;
    if (params.get('nye') === '0') return false;
  } catch (e) { /* ignore */ }
  if (document.body.classList.contains('nye')) return true;
  // Auto-enable on Dec 31 and Jan 1
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  if ((m === 12 && d === 31) || (m === 1 && d === 1)) return true;
  return false;
}

function spawnSparkle(container) {
  if (!container) return;
  if (container.childElementCount > 20) return;
  const s = document.createElement('span');
  s.className = 'sparkle';
  const left = Math.random() * 100;
  const top = Math.random() * 28;
  const dur = 900 + Math.random() * 900;
  s.style.left = `${left}%`;
  s.style.top = `${top}%`;
  s.style.width = `${Math.round(6 + Math.random() * 8)}px`;
  s.style.height = s.style.width;
  s.style.animationDuration = `${Math.round(dur)}ms`;
  if (Math.random() > 0.6) s.style.background = 'radial-gradient(circle at 30% 30%, #fff, #ffcf33 60%)';
  container.appendChild(s);
  s.addEventListener('animationend', () => { try { s.remove(); } catch (e) {} });
}

function spawnConfettiBurst() {
  const container = document.getElementById('confetti');
  if (!container) return;
  if (container.childElementCount > 60) return;
  const pieces = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < pieces; i++) {
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    const colors = ['#ff3884','#ffd166','#7ee787','#7cc8ff','#ffb47b','#c77cff'];
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    const left = Math.random() * 100;
    const delay = Math.random() * 300;
    const dur = 2200 + Math.random() * 1000;
    const sizeW = 4 + Math.random()*6;
    const sizeH = 6 + Math.random()*8;
    p.style.left = `${left}%`;
    p.style.top = `${-6 - Math.random()*8}vh`;
    p.style.width = `${sizeW}px`;
    p.style.height = `${sizeH}px`;
    p.style.animationDuration = `${dur}ms`;
    p.style.animationDelay = `${delay}ms`;
    container.appendChild(p);
    setTimeout(() => { try { p.remove(); } catch (e) {} }, dur + delay + 100);
  }
}

function launchRocket() {
  const container = document.getElementById('rockets');
  if (!container) return;
  if (container.childElementCount > 3) return;
  const r = document.createElement('span');
  r.className = 'rocket';
  r.textContent = '🚀';
  const left = 8 + Math.random() * 84;
  const bottom = 4 + Math.random() * 10;
  r.style.left = `${left}%`;
  r.style.bottom = `${bottom}px`;
  const dur = 1400 + Math.random() * 800;
  r.style.animationDuration = `${dur}ms`;
  container.appendChild(r);
  setTimeout(() => { try { r.remove(); } catch (e) {} }, dur + 120);
}

function enableNye() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const container = document.getElementById('nye-sparkles');
  if (!container) return;
  const initial = window.innerWidth < 420 ? 4 : 8;
  for (let i = 0; i < initial; i++) spawnSparkle(container);
  const interval = setInterval(() => {
    const count = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) spawnSparkle(container);
    if (Math.random() < 0.12) spawnConfettiBurst();
    if (Math.random() < 0.05) launchRocket();
  }, 1000 + Math.random() * 800);
  window._nyeSparklesInterval = interval;
}

/**
 * Initialize NYE sparkles
 */
export function initNyeSparkles() {
  try {
    if (isNyeEnabled()) {
      enableNye();
    } else {
      const c = document.getElementById('nye-sparkles');
      if (c) c.innerHTML = '';
    }
  } catch (e) {
    if (window._debug) console.warn('NYE init failed', e);
  }
}

// ===== Spring Elements (Birds & Bees) =====

function isSpringEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('spring') === '1') return true;
    if (params.get('spring') === '0') return false;
  } catch (e) { /* ignore */ }
  if (document.body.classList.contains('spring')) return true;
  const now = new Date();
  const m = now.getMonth() + 1;
  if (m === 3 || m === 4 || m === 5) return true;
  return false;
}

function enableSpring() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const container = document.getElementById('spring-elements');
  if (!container) return;

  function spawnSpringElement() {
    if (container.childElementCount > 12) return;
    const elem = document.createElement('span');
    const isBird = Math.random() > 0.5;
    elem.className = isBird ? 'spring-element bird' : 'spring-element bee';
    const top = Math.random() * 70;
    elem.style.top = `${top}vh`;
    const size = isBird ? (16 + Math.random() * 12) : (14 + Math.random() * 8);
    elem.style.fontSize = `${size}px`;
    const duration = (12 + Math.random() * 10).toFixed(2);
    const verticalMove = (Math.random() - 0.5) * 20;
    elem.style.setProperty('--fly-y', `${verticalMove}vh`);
    elem.style.animationDuration = `${duration}s`;
    const delay = (Math.random() * -8).toFixed(2);
    elem.style.animationDelay = `${delay}s`;
    container.appendChild(elem);
    const totalTime = (parseFloat(duration) + Math.abs(parseFloat(delay))) * 1000;
    setTimeout(() => { try { elem.remove(); } catch (e) {} }, totalTime + 500);
  }

  const initial = window.innerWidth < 420 ? 3 : 5;
  for (let i = 0; i < initial; i++) {
    setTimeout(() => spawnSpringElement(), i * 800);
  }

  const interval = setInterval(() => {
    if (Math.random() > 0.3) spawnSpringElement();
  }, 3000 + Math.random() * 2000);

  window._springInterval = interval;
}

/**
 * Initialize spring elements
 */
export function initSpringElements() {
  try {
    if (isSpringEnabled()) {
      enableSpring();
    } else {
      const c = document.getElementById('spring-elements');
      if (c) c.innerHTML = '';
    }
  } catch (e) {
    if (window._debug) console.warn('Spring init failed', e);
  }
}

// ===== Autumn Leaves =====

function isAutumnEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autumn') === '1') return true;
    if (params.get('autumn') === '0') return false;
  } catch (e) { /* ignore */ }
  if (document.body.classList.contains('autumn')) return true;
  const now = new Date();
  const m = now.getMonth() + 1;
  if (m === 9 || m === 10 || m === 11) return true;
  return false;
}

function enableAutumn() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const container = document.getElementById('autumn-leaves');
  if (!container) return;

  const baseLeaves = window.innerWidth < 420 ? 10 : 15;
  const leafCount = Math.max(1, Math.floor(baseLeaves * 0.8));
  container.innerHTML = '';

  for (let i = 0; i < leafCount; i++) {
    const leaf = document.createElement('span');
    const types = ['maple', 'oak', 'yellow'];
    const weights = [0.4, 0.4, 0.2];
    const rand = Math.random();
    let type;
    if (rand < weights[0]) type = types[0];
    else if (rand < weights[0] + weights[1]) type = types[1];
    else type = types[2];

    leaf.className = `autumn-leaf ${type}`;
    const left = Math.random() * 100;
    const size = Math.floor(12 + Math.random() * 14);
    const fallDuration = (10 + Math.random() * 12).toFixed(2);
    const swayDuration = (3 + Math.random() * 4).toFixed(2);
    const delay = (Math.random() * -15).toFixed(2);
    const swayDistance = (15 + Math.random() * 30).toFixed(0);

    leaf.style.left = `${left}%`;
    leaf.style.fontSize = `${size}px`;
    leaf.style.opacity = (0.75 + Math.random() * 0.25).toString();
    leaf.style.setProperty('--sway-distance', `${swayDistance}px`);
    leaf.style.animationDuration = `${fallDuration}s, ${swayDuration}s`;
    leaf.style.animationDelay = `${delay}s, ${delay}s`;
    container.appendChild(leaf);
  }

  // Add larger leaves for variety
  const baseLarge = window.innerWidth < 420 ? 2 : 4;
  const largeCount = Math.max(0, Math.floor(baseLarge * 0.8));

  for (let i = 0; i < largeCount; i++) {
    const leaf = document.createElement('span');
    const types = ['maple', 'oak'];
    const type = types[Math.floor(Math.random() * types.length)];
    leaf.className = `autumn-leaf ${type}`;

    const left = Math.random() * 100;
    const size = Math.floor(28 + Math.random() * 18);
    const fallDuration = (16 + Math.random() * 10).toFixed(2);
    const swayDuration = (4 + Math.random() * 5).toFixed(2);
    const delay = (Math.random() * -20).toFixed(2);
    const swayDistance = (25 + Math.random() * 40).toFixed(0);

    leaf.style.left = `${left}%`;
    leaf.style.fontSize = `${size}px`;
    leaf.style.opacity = (0.8 + Math.random() * 0.2).toString();
    leaf.style.setProperty('--sway-distance', `${swayDistance}px`);
    leaf.style.animationDuration = `${fallDuration}s, ${swayDuration}s`;
    leaf.style.animationDelay = `${delay}s, ${delay}s`;
    container.appendChild(leaf);
  }
}

/**
 * Initialize autumn leaves
 */
export function initAutumnLeaves() {
  try {
    if (isAutumnEnabled()) {
      enableAutumn();
    } else {
      const c = document.getElementById('autumn-leaves');
      if (c) c.innerHTML = '';
    }
  } catch (e) {
    if (window._debug) console.warn('Autumn init failed', e);
  }
}

/**
 * Initialize all seasonal effects
 */
export function initAllSeasonalEffects() {
  initHolidaySnowfall();
  initNyeSparkles();
  initSpringElements();
  initAutumnLeaves();
}
