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
    const isAdministrativeOrderId = (orderId = '') => /^[A-Z]{2}-ADMIN-\d+$/i.test(String(orderId || '').trim());

    const historicalOrderId = ({
        orderId = '',
        status = '',
        tags = [],
        currentNegotiationOrderId = '',
        legacyEntry = false
    } = {}) => {
        const normalizedOrderId = String(orderId || '').trim();
        if (!normalizedOrderId) return '';
        if (historicalStatuses.has(normalizeStatus(status))) return normalizedOrderId;
        const belongsToCurrentNegotiation = String(currentNegotiationOrderId || '').trim() === normalizedOrderId;
        const importedHistoricalLead = Boolean(legacyEntry) && isAdministrativeOrderId(normalizedOrderId);
        return !belongsToCurrentNegotiation && (tags.some(isLegacyCustomerTag) || importedHistoricalLead)
            ? normalizedOrderId
            : '';
    };

    return Object.freeze({
        historicalOrderId,
        isAdministrativeOrderId,
        isLegacyCustomerTag
    });
}));
