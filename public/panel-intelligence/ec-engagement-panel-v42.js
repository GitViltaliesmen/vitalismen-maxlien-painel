(function exposeVitalismenEngagementPanelV42(root, factory) {
    const api = factory();
    root.VitalismenEngagementPanelV42 = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    'use strict';

    const VALID_BUCKETS = new Set(['attendance', 'engagement', 'orders', 'review']);
    const CLOSED_ORDER_STATUSES = new Set([
        'delivered',
        'cancelled',
        'canceled',
        'returned',
        'entregue',
        'entregado',
        'cancelado',
        'devolvido',
        'devuelto'
    ]);

    const normalize = (value = '') => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const resolveConversationBucket = (chat = {}) => {
        const stored = normalize(chat.conversationBucket?.value);
        if (VALID_BUCKETS.has(stored)) return stored;

        const orderStatus = normalize(chat.orderStatus || chat.customerDraft?.status);
        if (chat.orderId && !CLOSED_ORDER_STATUSES.has(orderStatus)) return 'orders';

        const tags = Array.isArray(chat.tags)
            ? chat.tags.map(normalize).filter(Boolean)
            : [];
        if (tags.includes('warmup:risk') || tags.includes('conversation:review')) return 'review';
        if (tags.includes('warmup:allowed') || tags.includes('conversation:engagement')) return 'engagement';
        if (tags.includes('conversation:orders')) return 'orders';
        return 'attendance';
    };

    const dedupeVisibleLabels = (labels = []) => {
        const seen = new Set();
        return (Array.isArray(labels) ? labels : []).filter((item) => {
            const label = normalize(item?.label);
            const className = normalize(item?.className || 'auto');
            if (!label) return false;
            const key = `${label}|${className}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    return Object.freeze({
        resolveConversationBucket,
        dedupeVisibleLabels
    });
});
