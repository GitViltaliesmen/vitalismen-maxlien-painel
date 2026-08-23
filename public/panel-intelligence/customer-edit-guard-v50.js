(function exposeVitalismenCustomerEditGuardV50(root, factory) {
    const api = factory();
    root.VitalismenCustomerEditGuardV50 = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    'use strict';

    const normalizeRevision = (value) => {
        const revision = Number(value || 0);
        return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
    };

    const captureSaveSnapshot = ({
        chatId = '',
        contactStateKey = '',
        editRevision = 0,
        correctedFields = []
    } = {}) => Object.freeze({
        chatId: String(chatId || ''),
        contactStateKey: String(contactStateKey || ''),
        editRevision: normalizeRevision(editRevision),
        correctedFields: Object.freeze([...new Set(
            (Array.isArray(correctedFields) ? correctedFields : [])
                .map((field) => String(field || '').trim())
                .filter(Boolean)
        )])
    });

    const isSaveSnapshotCurrent = ({
        snapshot = {},
        selectedChatId = '',
        editRevision = 0
    } = {}) => (
        Boolean(snapshot.chatId)
        && snapshot.chatId === String(selectedChatId || '')
        && normalizeRevision(snapshot.editRevision) === normalizeRevision(editRevision)
    );

    const shouldPreserveManualEdit = ({
        dirty = false,
        dirtyChatId = '',
        selectedChatId = ''
    } = {}) => (
        dirty === true
        && Boolean(String(selectedChatId || ''))
        && String(dirtyChatId || '') === String(selectedChatId || '')
    );

    const queueSave = (previousSave, operation) => Promise.resolve(previousSave)
        .catch(() => undefined)
        .then(() => operation());

    return Object.freeze({
        captureSaveSnapshot,
        isSaveSnapshotCurrent,
        shouldPreserveManualEdit,
        queueSave
    });
});
