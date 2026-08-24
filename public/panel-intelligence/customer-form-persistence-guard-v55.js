(function exposeVitalismenCustomerFormPersistenceGuardV55(root, factory) {
    const api = factory();
    root.VitalismenCustomerFormPersistenceGuardV55 = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    'use strict';

    const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');

    const stableConversationPhone = ({ chat = {}, draft = {} } = {}) => {
        const candidates = [
            chat.phone,
            chat.id,
            chat.chatId,
            chat.remoteJid,
            chat.customerDraft?.phone,
            draft.phone
        ];
        return String(candidates.find((value) => digitsOnly(value).length >= 9) || '').trim();
    };

    const phonesEquivalent = (left = '', right = '') => {
        const leftDigits = digitsOnly(left);
        const rightDigits = digitsOnly(right);
        if (!leftDigits || !rightDigits) return false;
        const length = Math.min(9, leftDigits.length, rightDigits.length);
        return leftDigits.slice(-length) === rightDigits.slice(-length);
    };

    const protectFormPhone = ({ inputPhone = '', chat = {}, draft = {} } = {}) => {
        const stablePhone = stableConversationPhone({ chat, draft });
        const typedPhone = String(inputPhone || '').trim();
        if (!stablePhone) return Object.freeze({ phone: typedPhone, mismatch: false, restored: false });
        if (!typedPhone) return Object.freeze({ phone: stablePhone, mismatch: false, restored: true });
        if (phonesEquivalent(typedPhone, stablePhone)) {
            return Object.freeze({ phone: stablePhone, mismatch: false, restored: typedPhone !== stablePhone });
        }
        return Object.freeze({ phone: stablePhone, mismatch: true, restored: true });
    };

    return Object.freeze({
        digitsOnly,
        phonesEquivalent,
        protectFormPhone,
        stableConversationPhone
    });
});
