export const sentDedupeFields = ({ provider = '', providerMessageId = '', now = new Date() } = {}) => {
    const fields = { status: 'sent', sentAt: now };
    if (provider !== 'baileys') return fields;
    const receiptId = String(providerMessageId || '').trim().slice(0, 250);
    if (!receiptId) throw new Error('baileys_provider_receipt_missing');
    return { ...fields, provider: 'baileys', providerMessageId: receiptId };
};
