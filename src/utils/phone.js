export const formatWhatsAppNumber = ({ phone, country }) => {
    let digits = String(phone ?? '').replace(/\D/g, '');
    if (!digits) return null;

    if (country === 'EC') {
        if (digits.startsWith('593')) return digits;
        if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
        if (digits.length === 9) return `593${digits}`;
        if (digits.length > 9) return digits;
        return digits;
    }

    return digits;
};

export const toWhatsAppChatId = (phone, country) => {
    const number = formatWhatsAppNumber({ phone, country });
    if (!number) return null;
    return `${number}@c.us`;
};
