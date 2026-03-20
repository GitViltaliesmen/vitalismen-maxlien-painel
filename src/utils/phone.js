export const formatWhatsAppNumber = ({ phone, country }) => {
    let digits = String(phone ?? '').replace(/\D/g, '');
    if (!digits) return null;

    // TEST NUMBER OVERRIDE (force to a known WhatsApp test number)
    // Accepts inputs like: 3184539234, 5933184539234, +5933184539234, 553184539234
    if (digits === '553184539234' || digits.endsWith('3184539234')) {
        return '553184539234';
    }

    if (country === 'CO') {
        if (digits.startsWith('57')) return digits;
        if (digits.length === 10) return `57${digits}`;
        return digits;
    }

    if (country === 'EC') {
        if (digits.startsWith('593')) return digits;
        if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
        if (digits.length === 9) return `593${digits}`;
        return digits;
    }

    return digits;
};

export const toWhatsAppChatId = (phone, country) => {
    const number = formatWhatsAppNumber({ phone, country });
    if (!number) return null;
    return `${number}@c.us`;
};
