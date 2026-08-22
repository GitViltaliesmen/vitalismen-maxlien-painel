(function exposeVitalismenEngagementPriorityV43(root, factory) {
    const api = factory();
    root.VitalismenEngagementPriorityV43 = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    'use strict';

    const DEFAULT_CHAT_FILTER = 'all';

    const fallbackBucket = (chat = {}) => {
        const stored = String(chat.conversationBucket?.value || '').trim().toLowerCase();
        if (['attendance', 'engagement', 'orders', 'review'].includes(stored)) return stored;
        const tags = Array.isArray(chat.tags) ? chat.tags.map((tag) => String(tag || '').toLowerCase()) : [];
        if (tags.includes('warmup:allowed') || tags.includes('conversation:engagement')) return 'engagement';
        return 'attendance';
    };

    const resolveBucket = (chat = {}, resolver = null) => (
        (typeof resolver === 'function' ? resolver(chat) : '') || fallbackBucket(chat)
    );

    const isEngagementChat = (chat = {}, resolver = null) => resolveBucket(chat, resolver) === 'engagement';

    const isNewMessagesChat = (chat = {}, {
        resolveConversationBucket = null,
        isVslAwaitingHuman = null
    } = {}) => {
        if (isEngagementChat(chat, resolveConversationBucket)) return false;
        return Number(chat.unreadCount || 0) > 0
            || (typeof isVslAwaitingHuman === 'function' && isVslAwaitingHuman(chat));
    };

    const bucketUnreadCounts = (chats = [], resolver = null) => {
        const counts = { attendance: 0, engagement: 0, orders: 0, review: 0 };
        for (const chat of Array.isArray(chats) ? chats : []) {
            if (Number(chat?.unreadCount || 0) <= 0) continue;
            const bucket = resolveBucket(chat, resolver);
            if (Object.prototype.hasOwnProperty.call(counts, bucket)) counts[bucket] += 1;
        }
        return counts;
    };

    return Object.freeze({
        DEFAULT_CHAT_FILTER,
        isEngagementChat,
        isNewMessagesChat,
        bucketUnreadCounts
    });
});
