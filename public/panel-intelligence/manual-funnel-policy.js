(function exposeManualFunnelPolicy(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.VitalismenManualFunnelPolicy = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createManualFunnelPolicy() {
    const normalizeCountry = (value = '') => String(value || '').trim().toUpperCase();
    const normalizeHumanMode = (value = '') => String(value || '').trim().toLowerCase();

    const isAvailable = ({ hasSelectedChat = false, country = '', humanMode = '' } = {}) => (
        Boolean(hasSelectedChat)
        && normalizeCountry(country) === 'EC'
        && normalizeHumanMode(humanMode) === 'manual'
    );

    const titleFor = (context = {}) => {
        if (isAvailable(context)) return 'Manual EC · Funil rapido Tex Ultra';
        if (!context.hasSelectedChat) return 'Selecione um cliente EC';
        if (normalizeCountry(context.country) !== 'EC') return 'Disponivel somente para clientes EC';
        return 'Assuma o atendimento para liberar';
    };

    return Object.freeze({
        isAvailable,
        titleFor
    });
}));
