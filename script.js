const TAOSTATS_API = 'https://api.taostats.io/v1';

async function fetchTaoPrice() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bittensor&vs_currencies=usd', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log('CoinGecko Response:', response.status);

        if (!response.ok) {
            throw new Error(`CoinGecko API Error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Price data:', data);

        // CoinGecko returns: { bittensor: { usd: price } }
        if (!data.bittensor?.usd) {
            throw new Error('Invalid price format');
        }

        return data.bittensor.usd;
    } catch (error) {
        console.error('CoinGecko fetch failed:', error);
        return null;
    }
}

async function loadDashboard() {
    const priceEl = document.getElementById('taoPrice');
    if (priceEl) {
        priceEl.textContent = 'Loading...';

        const price = await fetchTaoPrice();
        if (price) {
            priceEl.textContent = `$${Number(price).toFixed(2)}`;
        } else {
            priceEl.textContent = 'Price unavailable';
        }
    }
}

async function fetchDashboardData() {
    try {
        // Get price from CoinGecko (working)
        const price = await fetchTaoPrice();

        // Placeholder for subnet data
        // TODO: Implement reliable subnet data source
        const networkData = {
            totalStake: "Data unavailable",
            activeValidators: "Data unavailable",
            currentBlock: "Data unavailable"
        };

        return { price, networkData };
    } catch (error) {
        console.error('Dashboard data fetch failed:', error);
        return { price: null, networkData: null };
    }
}

document.addEventListener('DOMContentLoaded', loadDashboard);