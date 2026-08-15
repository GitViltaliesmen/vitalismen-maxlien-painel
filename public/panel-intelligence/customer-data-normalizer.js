(function exposeCustomerDataNormalizer(root, factory) {
    const api = factory();
    root.VitalismenCustomerDataNormalizer = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    'use strict';

    const LOWERCASE_CONNECTORS = new Set([
        'da', 'das', 'de', 'del', 'do', 'dos', 'e', 'la', 'las', 'los', 'y'
    ]);

    const cleanSpaces = (value) => String(value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const lower = (value) => String(value || '').toLocaleLowerCase('es-EC');
    const upperFirstLetter = (value) => String(value || '').replace(
        /\p{L}/u,
        (letter) => letter.toLocaleUpperCase('es-EC')
    );
    const connectorKey = (value) => lower(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z]/g, '');
    const formatCompoundWord = (value) => lower(value)
        .split(/([-’'])/u)
        .map((part) => (/^[-’']$/u.test(part) ? part : upperFirstLetter(part)))
        .join('');

    const formatWords = (value) => cleanSpaces(value)
        .split(' ')
        .filter(Boolean)
        .map((word, index) => (
            index > 0 && LOWERCASE_CONNECTORS.has(connectorKey(word))
                ? lower(word)
                : formatCompoundWord(word)
        ))
        .join(' ');

    const formatPersonName = (value) => formatWords(value);
    const formatLocationName = (value) => formatWords(String(value || '').replace(/_/g, ' '));
    const formatReference = (value) => cleanSpaces(value);
    const formatAddress = (value) => cleanSpaces(value);

    const normalizeCustomerData = (data = {}) => {
        const normalized = { ...data };
        if (Object.prototype.hasOwnProperty.call(normalized, 'name')) {
            normalized.name = formatPersonName(normalized.name);
        }
        if (Object.prototype.hasOwnProperty.call(normalized, 'city')) {
            normalized.city = formatLocationName(normalized.city);
        }
        if (Object.prototype.hasOwnProperty.call(normalized, 'province')) {
            normalized.province = formatLocationName(normalized.province);
        }
        if (Object.prototype.hasOwnProperty.call(normalized, 'reference')) {
            normalized.reference = formatReference(normalized.reference);
        }
        if (Object.prototype.hasOwnProperty.call(normalized, 'address')) {
            normalized.address = formatAddress(normalized.address);
        }
        return normalized;
    };

    return Object.freeze({
        cleanSpaces,
        formatPersonName,
        formatLocationName,
        formatReference,
        formatAddress,
        normalizeCustomerData
    });
});
