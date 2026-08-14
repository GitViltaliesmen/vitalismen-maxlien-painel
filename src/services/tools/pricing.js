export async function getPrice(country, qty) {
    // Stub placeholder logic
    const prices = {
        'EC': { 1: 39, 3: 95.99, 6: 167.99 }
    };
    const price = prices[country]?.[qty] || 0;
    return { ok: true, country: 'EC', qty, price, currency: 'USD' };
}
