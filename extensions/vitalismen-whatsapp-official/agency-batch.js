(function exposeAgencyBatch(root, factory) {
    const api = factory();
    root.VitalismenAgencyBatch = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    'use strict';

    const optionNumber = (offset = 0, index = 0) => (
        Math.max(0, Number(offset) || 0) + Math.max(0, Number(index) || 0) + 1
    );

    const buildMessages = ({
        agencies = [],
        startNumber = 1,
        includeIntro = false,
        intro = '',
        formatOption
    } = {}) => {
        const selected = agencies.filter(Boolean).slice(0, 4);
        const firstNumber = Math.max(1, Number(startNumber) || 1);
        const messages = includeIntro && String(intro || '').trim()
            ? [String(intro).trim()]
            : [];
        selected.forEach((agency, index) => {
            messages.push(formatOption(agency, firstNumber + index));
        });
        return messages.filter(Boolean);
    };

    return Object.freeze({
        optionNumber,
        buildMessages
    });
});
