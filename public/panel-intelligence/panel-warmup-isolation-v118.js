(function exposeVitalismenPanelWarmupIsolationV118(root, factory) {
    const api = factory();
    root.VitalismenPanelWarmupIsolationV118 = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    'use strict';

    const DEFAULT_OPERATIONAL_BUCKET = 'attendance';
    const ENGAGEMENT_BUCKET = 'engagement';
    const GLOBAL_NEW_MESSAGES_FILTER = 'unread';
    const ACTIVE_ORDER_STATUSES = new Set([
        'confirmed',
        'confirmado',
        'processing',
        'processando',
        'pedido_enviado',
        'shipped',
        'enviado'
    ]);

    const normalize = (value = '') => String(value || '').trim().toLowerCase().replace(/-/g, '_');
    const resolveBucket = (chat = {}, resolver = null) => normalize(
        typeof resolver === 'function'
            ? resolver(chat)
            : chat?.conversationBucket?.value || chat?.conversationBucket
    ) || DEFAULT_OPERATIONAL_BUCKET;

    const isEngagementChat = (chat = {}, resolver = null) => (
        resolveBucket(chat, resolver) === ENGAGEMENT_BUCKET
    );

    const isChatVisibleInOperationalView = ({
        chat = {},
        conversationBucketFilter = DEFAULT_OPERATIONAL_BUCKET,
        chatFilter = 'all',
        resolveConversationBucket = null
    } = {}) => {
        const bucket = resolveBucket(chat, resolveConversationBucket);
        const filter = normalize(chatFilter) || 'all';
        if (filter === GLOBAL_NEW_MESSAGES_FILTER) return bucket !== ENGAGEMENT_BUCKET;
        const selectedBucket = normalize(conversationBucketFilter) || DEFAULT_OPERATIONAL_BUCKET;
        return bucket === selectedBucket;
    };

    const commercialChats = (chats = [], resolver = null) => (
        (Array.isArray(chats) ? chats : []).filter((chat) => !isEngagementChat(chat, resolver))
    );

    const hasActiveOperationalOrder = (lead = {}) => {
        const status = normalize(lead?._opsStatus || lead?.status);
        if (ACTIVE_ORDER_STATUSES.has(status)) return true;
        const currentOrderId = String(lead?._ops?.currentOrderId || '').trim();
        return Boolean(currentOrderId) && !['delivered', 'entregue', 'finalizado', 'cancelled', 'cancelado', 'returned', 'devolvido'].includes(status);
    };

    const shouldHideLeadFromCommercialPanel = (lead = {}) => (
        lead?._ops?.hideFromBuyerPanel === true && !hasActiveOperationalOrder(lead)
    );

    return Object.freeze({
        DEFAULT_OPERATIONAL_BUCKET,
        ENGAGEMENT_BUCKET,
        GLOBAL_NEW_MESSAGES_FILTER,
        commercialChats,
        hasActiveOperationalOrder,
        isChatVisibleInOperationalView,
        isEngagementChat,
        shouldHideLeadFromCommercialPanel
    });
});
