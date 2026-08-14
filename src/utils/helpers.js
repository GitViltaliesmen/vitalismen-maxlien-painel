// Helper utilities

/**
 * Format phone number by country
 */
export const formatPhone = (phone, country) => {
    const cleaned = phone.replace(/\D/g, '');

    if (country === 'EC') {
        // Ecuador: +593 XX XXX XXXX
        if (cleaned.startsWith('593')) {
            return `+${cleaned}`;
        }
        return `+593${cleaned}`;
    }

    return `+${cleaned}`;
};

/**
 * Generate random string for IDs
 */
export const generateId = (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

/**
 * Format currency display
 */
export const formatCurrency = (amount, currency) => {
    return `$${amount} USD`;
};
