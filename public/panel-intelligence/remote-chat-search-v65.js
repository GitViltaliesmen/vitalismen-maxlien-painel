(function attachRemoteChatSearchV65(global) {
    'use strict';

    const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
    const clean = (value = '') => String(value || '').trim().replace(/\s+/g, ' ');
    const identityKey = (chat = {}) => {
        const phone = digitsOnly(chat.phone || chat.id || '');
        if (phone.length >= 9) return `phone:${phone.slice(-9)}`;
        return chat.id ? `chat:${chat.id}` : '';
    };

    const queryDescriptor = (value = '') => {
        const raw = clean(value).slice(0, 80);
        const digits = digitsOnly(raw);
        const numeric = Boolean(raw) && raw.replace(/[\s()+\-./]/g, '').replace(/\d/g, '') === '';
        if (!raw) return { valid: false, kind: 'empty', raw };
        if (numeric) return { valid: digits.length >= 3, kind: 'numeric', raw, digits };
        if (/^EC-[A-Z0-9-]{2,}$/i.test(raw)) return { valid: true, kind: 'order', raw, digits };
        return { valid: raw.length >= 2, kind: 'name', raw, digits };
    };

    const mergeChats = (local = [], remote = []) => {
        const merged = [];
        const seen = new Set();
        [...local, ...remote].forEach((chat) => {
            const key = identityKey(chat);
            if (!key || seen.has(key)) return;
            seen.add(key);
            merged.push(chat);
        });
        return merged;
    };

    const matches = (chat = {}, value = '') => {
        const descriptor = queryDescriptor(value);
        if (!descriptor.valid) return descriptor.kind === 'empty';
        const haystack = [
            chat.name,
            chat.contactName,
            chat.officialOrderName,
            chat.phone,
            chat.id,
            chat.orderId,
            chat.order?.dropiOrderId,
            chat.logistics?.trackingNumber,
            chat.customerDraft?.dropiOrderId,
            chat.customerDraft?.trackingNumber
        ].map((item) => clean(item).toLowerCase());
        const textQuery = descriptor.raw.toLowerCase();
        if (haystack.some((item) => item.includes(textQuery))) return true;
        if (!descriptor.digits) return false;
        return haystack.map(digitsOnly).some((item) => item && item.includes(descriptor.digits));
    };

    global.VitalismenRemoteChatSearchV65 = Object.freeze({
        queryDescriptor,
        identityKey,
        mergeChats,
        matches
    });
}(window));
