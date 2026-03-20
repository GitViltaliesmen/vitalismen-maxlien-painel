export async function getPrice(country, qty) {
    // Stub placeholder logic
    const prices = {
        'CO': { 1: 89900, 2: 139900, 3: 179900 },
        'EC': { 1: 25, 2: 40, 3: 50 }
    };
    const price = prices[country]?.[qty] || 0;
    return { ok: true, country, qty, price, currency: country === 'CO' ? 'COP' : 'USD' };
}
