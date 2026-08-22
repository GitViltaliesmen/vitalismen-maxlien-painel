(function exposeVitalismenGlobalNewMessagesV44(root, factory) {
    const api = factory();
    root.VitalismenGlobalNewMessagesV44 = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    'use strict';

    const DEFAULT_OPERATIONAL_BUCKET = 'attendance';
    const GLOBAL_NEW_MESSAGES_FILTER = 'unread';

    const messageFilterState = ({
        filter = 'all',
        conversationBucketFilter = DEFAULT_OPERATIONAL_BUCKET
    } = {}) => {
        const chatFilter = String(filter || 'all').trim().toLowerCase() || 'all';
        if (chatFilter === GLOBAL_NEW_MESSAGES_FILTER) {
            return {
                chatFilter,
                conversationBucketFilter: ''
            };
        }
        return {
            chatFilter,
            conversationBucketFilter: String(conversationBucketFilter || DEFAULT_OPERATIONAL_BUCKET)
                .trim()
                .toLowerCase() || DEFAULT_OPERATIONAL_BUCKET
        };
    };

    const shouldApplyOperationalBucketFilter = ({
        searchActive = false,
        chatFilter = 'all',
        conversationBucketFilter = ''
    } = {}) => (
        !searchActive
        && String(chatFilter || '').trim().toLowerCase() !== GLOBAL_NEW_MESSAGES_FILTER
        && Boolean(String(conversationBucketFilter || '').trim())
    );

    return Object.freeze({
        DEFAULT_OPERATIONAL_BUCKET,
        GLOBAL_NEW_MESSAGES_FILTER,
        messageFilterState,
        shouldApplyOperationalBucketFilter
    });
});
