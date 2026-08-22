(function exposeVitalismenChatSearchV41(root, factory) {
    const api = factory();
    root.VitalismenChatSearchV41 = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    'use strict';

    const MIN_PHONE_QUERY_DIGITS = 3;
    const clean = (value) => String(value ?? '').trim();
    const digitsOnly = (value) => clean(value).replace(/\D/g, '');
    const normalizeName = (value) => clean(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ');

    const unique = (values = []) => [...new Set(values.filter(Boolean))];
    const plausiblePhoneDigits = (value) => {
        const digits = digitsOnly(value);
        return digits.length >= 8 && digits.length <= 15 ? digits : '';
    };

    const isPhoneLikeQuery = (value) => {
        const query = clean(value);
        if (!query) return false;
        return query.replace(/[\s()+\-./]/g, '').replace(/\d/g, '') === '';
    };

    const ecuadorPhoneVariants = (value) => {
        const digits = digitsOnly(value);
        if (!digits) return [];
        const variants = [digits];
        if (/^5939\d{8}$/.test(digits)) {
            variants.push(digits.slice(3), `0${digits.slice(3)}`);
        } else if (/^09\d{8}$/.test(digits)) {
            variants.push(digits.slice(1), `593${digits.slice(1)}`);
        } else if (/^9\d{8}$/.test(digits)) {
            variants.push(`0${digits}`, `593${digits}`);
        }
        return unique(variants);
    };

    const queryDescriptor = (value) => {
        const raw = clean(value);
        if (!raw) return Object.freeze({ kind: 'empty', raw, normalized: '', digits: '' });
        if (isPhoneLikeQuery(raw)) {
            const digits = digitsOnly(raw);
            return Object.freeze({
                kind: digits.length < MIN_PHONE_QUERY_DIGITS ? 'phone_too_short' : 'phone',
                raw,
                normalized: digits,
                digits
            });
        }
        return Object.freeze({ kind: 'name', raw, normalized: normalizeName(raw), digits: '' });
    };

    const nameCandidates = (chat = {}) => unique([
        chat.name,
        chat.customerDraft?.name,
        chat.profileName,
        chat.displayName,
        chat.customer?.name,
        chat.client?.name
    ].map(normalizeName).filter((value) => /[a-z]/i.test(value)));

    const phoneCandidates = (chat = {}) => {
        const direct = [
            chat.phone,
            chat.phoneDigits,
            chat.customerDraft?.phone,
            chat.customer?.phone,
            chat.client?.phone,
            chat.metadata?.lastSenderPn
        ].map(plausiblePhoneDigits).filter(Boolean);
        const technicalIds = [chat.chatId, chat.id]
            .map(clean)
            .filter((value) => /^\+?\d{8,15}(?:@c\.us|@s\.whatsapp\.net)?$/i.test(value))
            .map(plausiblePhoneDigits)
            .filter(Boolean);
        return unique([...direct, ...technicalIds]);
    };

    const matchesPhone = (chat, queryDigits) => {
        const queryVariants = ecuadorPhoneVariants(queryDigits);
        if (!queryVariants.length) return false;
        return phoneCandidates(chat).some((candidate) => {
            const candidateVariants = ecuadorPhoneVariants(candidate);
            return candidateVariants.some((candidateValue) => queryVariants.some((queryValue) => (
                candidateValue === queryValue
                || (queryValue.length >= MIN_PHONE_QUERY_DIGITS && candidateValue.endsWith(queryValue))
            )));
        });
    };

    const matchesChat = (chat = {}, search = '') => {
        const query = queryDescriptor(search);
        if (query.kind === 'empty') return true;
        if (query.kind === 'phone_too_short') return false;
        if (query.kind === 'phone') return matchesPhone(chat, query.digits);
        if (!query.normalized) return false;
        return nameCandidates(chat).some((candidate) => candidate.includes(query.normalized));
    };

    const isSearchActive = (search = '') => queryDescriptor(search).kind !== 'empty';
    const emptyStateMessage = (search = '') => {
        const query = queryDescriptor(search);
        if (query.kind === 'phone_too_short') return `Digite pelo menos ${MIN_PHONE_QUERY_DIGITS} dígitos finais do telefone.`;
        if (query.kind === 'phone' || query.kind === 'name') return 'Nenhum cliente corresponde ao nome ou telefone informado.';
        return 'Nenhum chat encontrado.';
    };

    return Object.freeze({
        MIN_PHONE_QUERY_DIGITS,
        digitsOnly,
        normalizeName,
        isPhoneLikeQuery,
        ecuadorPhoneVariants,
        queryDescriptor,
        nameCandidates,
        phoneCandidates,
        matchesChat,
        isSearchActive,
        emptyStateMessage
    });
});
