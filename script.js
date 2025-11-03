const CACHE_DURATION = 5 * 60 * 1000; // 5 Min.

// Make safeParseJSON synchronous since it doesn't need to be async
function safeParseJSON(str) {
    try { return JSON.parse(str); } catch { return null; }
}

// Add error type to catch block
async function getCachedOrFetch(key, fetchFn) {
    try {
        const cachedRaw = localStorage.getItem(key);
        if (cachedRaw) {
            const cached = safeParseJSON(cachedRaw);
            if (cached?.timestamp && (Date.now() - cached.timestamp < CACHE_DURATION)) {
                return cached.data;
            }
        }
    } catch (error) {
        console.warn('Cache read failed:', error);
    }

    const data = await fetchFn();
    try {
        localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (error) {
        console.warn('Cache write failed:', error);
    }
    return data;
}

// Use optional chaining and nullish coalescing
async function fetchTaoPrice() {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bittensor&vs_currencies=usd');
    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
    const json = await res.json();
    const price = json?.bittensor?.usd ?? null;
    if (price == null) throw new Error('TAO price not found');
    return Number(price);
}

// Memoize chart instance to prevent memory leaks
let chartInstance = null;

async function fetchValidators() {
    const res = await fetch('https://api.opentensor.ai/subnets/1/validators');
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = await res.json();
    return {
        hotkeys: json.map(v => v.hotkey),
        stakes: json.map(v => v.stake)
    };
}

async function loadDashboard() {
    try {
        const [price, validators] = await Promise.all([
            getCachedOrFetch('taoPrice', fetchTaoPrice),
            getCachedOrFetch('validators', fetchValidators)
        ]);

        const priceEl = safeGetEl('taoPrice');
        if (priceEl) priceEl.textContent = `$${Number(price).toFixed(2)}`;

        const canvas = safeGetEl('validatorsChart');
        if (canvas && window.Chart) {
            // Destroy previous chart instance
            if (chartInstance) chartInstance.destroy();

            const labels = validators.hotkeys.slice(0,5).map(h => `${h?.slice(0,8)}...`);
            const data = validators.stakes.slice(0,5).map(Number);

            chartInstance = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{ 
                        label: 'Stake',
                        data,
                        backgroundColor: '#ff6b35'
                    }]
                },
                options: { 
                    responsive: true,
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    } catch (error) {
        console.error('Dashboard loading error:', error);
    }
}

// Use immediate function for initialization
(() => {
    document.addEventListener('DOMContentLoaded', () => {
        const refreshBtn = safeGetEl('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                localStorage.removeItem('taoPrice');
                localStorage.removeItem('validators');
                loadDashboard();
            });
        }
        loadDashboard();
    });
})();