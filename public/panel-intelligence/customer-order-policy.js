(function exposeCustomerOrderPolicy(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.VitalismenCustomerOrderPolicy = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createCustomerOrderPolicy() {
    const historicalStatuses = new Set([
        'pedido_enviado',
        'enviado',
        'processing',
        'shipped',
        'entregue',
        'delivered',
        'devolvido',
        'returned',
        'cancelado',
        'cancelled',
        'canceled'
    ]);

    const normalizeStatus = (value = '') => String(value || '').trim().toLowerCase();
    const isLegacyCustomerTag = (tag = '') => /^(?:CLIENTE[_\s-]*)?ANTIGO$/i.test(String(tag || '').trim());

    const historicalOrderId = ({
        orderId = '',
        status = '',
        tags = [],
        currentNegotiationOrderId = ''
    } = {}) => {
        const normalizedOrderId = String(orderId || '').trim();
        if (!normalizedOrderId) return '';
        if (historicalStatuses.has(normalizeStatus(status))) return normalizedOrderId;
        const belongsToCurrentNegotiation = String(currentNegotiationOrderId || '').trim() === normalizedOrderId;
        return !belongsToCurrentNegotiation && tags.some(isLegacyCustomerTag)
            ? normalizedOrderId
            : '';
    };

    return Object.freeze({
        historicalOrderId,
        isLegacyCustomerTag
    });
}));
