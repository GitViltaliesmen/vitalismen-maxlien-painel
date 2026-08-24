(function exposeVitalismenCustomerSelectionGuardV51(root, factory) {
    const api = factory();
    root.VitalismenCustomerSelectionGuardV51 = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    'use strict';

    const normalizeInteger = (value) => {
        const number = Number(value || 0);
        return Number.isSafeInteger(number) && number >= 0 ? number : 0;
    };

    const normalizeText = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const captureSelectionScope = ({
        epoch = 0,
        chatId = '',
        contactStateKey = ''
    } = {}) => Object.freeze({
        epoch: normalizeInteger(epoch),
        chatId: String(chatId || ''),
        contactStateKey: String(contactStateKey || '')
    });

    const isSelectionScopeCurrent = ({
        scope = {},
        epoch = 0,
        selectedChatId = '',
        contactStateKey = ''
    } = {}) => (
        Boolean(scope.chatId)
        && normalizeInteger(scope.epoch) === normalizeInteger(epoch)
        && String(scope.chatId || '') === String(selectedChatId || '')
        && String(scope.contactStateKey || '') === String(contactStateKey || '')
    );

    const agencyDraftFrom = (agency = {}, current = {}) => ({
        city: agency.city || current.city || '',
        province: agency.province || current.province || '',
        deliveryMode: 'agency',
        agencyId: agency.agency_id || agency.id || '',
        agencyName: agency.name || '',
        address: [
            agency.name ? `Servientrega ${agency.name}` : 'Servientrega',
            agency.address,
            [agency.city, agency.province].filter(Boolean).join(', ')
        ].filter(Boolean).join(' - ')
    });

    const agencySuggestionChangesForm = ({ agency = {}, current = {} } = {}) => {
        if (!agency || typeof agency !== 'object') return false;
        const next = agencyDraftFrom(agency, current);
        return Object.keys(next).some((field) => normalizeText(next[field]) !== normalizeText(current[field]));
    };

    return Object.freeze({
        captureSelectionScope,
        isSelectionScopeCurrent,
        agencyDraftFrom,
        agencySuggestionChangesForm
    });
});
