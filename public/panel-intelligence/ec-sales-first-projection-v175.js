(function exposeEcSalesFirstProjectionV175(root, factory) {
    const api = factory();
    root.VitalismenEcSalesFirstProjectionV175 = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    'use strict';

    const SALES_STATUSES = new Set(['confirmado', 'pedido_enviado', 'entregue', 'recompra']);
    const LOST_STATUSES = new Set(['comprar_depois', 'cancelado', 'devolvido']);
    const PANEL_STATUSES = new Set([
        'novo',
        'atendendo',
        'comprar_depois',
        'confirmado',
        'pedido_enviado',
        'entregue',
        'recompra',
        'cancelado',
        'devolvido'
    ]);

    const STATUS_ALIASES = Object.freeze({
        draft: 'novo',
        pending: 'novo',
        manual: 'atendendo',
        in_service: 'atendendo',
        buy_later: 'comprar_depois',
        confirmed: 'confirmado',
        processing: 'pedido_enviado',
        shipped: 'pedido_enviado',
        enviado: 'pedido_enviado',
        delivered: 'entregue',
        cancelled: 'cancelado',
        canceled: 'cancelado',
        returned: 'devolvido'
    });

    const normalize = (value = '') => String(value || '').trim().toLowerCase().replace(/-/g, '_');

    const normalizePanelStatus = (value = '') => {
        const normalized = normalize(value);
        if (!normalized) return 'novo';
        return STATUS_ALIASES[normalized]
            || (PANEL_STATUSES.has(normalized) ? normalized : 'novo');
    };

    const authoritativeStatus = (chat = {}) => {
        const operational = chat.operationalStatus || {};
        if (normalize(operational.source) === 'shipment') {
            const shipmentStatus = normalizePanelStatus(operational.key);
            if (['pedido_enviado', 'entregue', 'devolvido'].includes(shipmentStatus)) {
                return shipmentStatus;
            }
        }
        const draftStatus = String(chat.customerDraft?.status || '').trim();
        return draftStatus
            ? normalizePanelStatus(draftStatus)
            : normalizePanelStatus(chat.orderStatus || 'novo');
    };

    const conversationBucket = (chat = {}) => {
        const bucket = normalize(chat.conversationBucket?.value || chat.conversationBucket);
        return ['attendance', 'engagement', 'orders', 'review'].includes(bucket)
            ? bucket
            : 'attendance';
    };

    const percentage = (numerator, denominator) => (
        denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
    );

    const bucketCounts = (chats = []) => chats.reduce((counts, chat) => {
        const bucket = conversationBucket(chat);
        counts[bucket] += 1;
        return counts;
    }, { attendance: 0, engagement: 0, orders: 0, review: 0 });

    const projectEcSalesFirstMetrics = ({ chats = [], dashboardMetrics = {} } = {}) => {
        const operationalChats = Array.isArray(chats) ? chats : [];
        const commercialChats = operationalChats.filter((chat) => conversationBucket(chat) !== 'engagement');
        const anonymousPreleads = commercialChats.filter((chat) => chat?.vslPrelead === true);
        const identifiedCommercialChats = commercialChats.filter((chat) => chat?.vslPrelead !== true);
        const sales = commercialChats.filter((chat) => SALES_STATUSES.has(authoritativeStatus(chat))).length;
        const lost = commercialChats.filter((chat) => LOST_STATUSES.has(authoritativeStatus(chat))).length;
        const historicalClients = Number(
            dashboardMetrics?.commercialTotalClients
            ?? dashboardMetrics?.totalClients
            ?? 0
        ) || 0;

        return Object.freeze({
            country: 'EC',
            generatedAt: dashboardMetrics?.generatedAt || new Date().toISOString(),
            historicalClients,
            operationalChats: operationalChats.length,
            commercialVisible: commercialChats.length,
            identifiedCommercialChats: identifiedCommercialChats.length,
            anonymousVslPreleads: anonymousPreleads.length,
            engagementChats: operationalChats.length - commercialChats.length,
            sales,
            lost,
            panelConversion: percentage(sales, commercialChats.length),
            identifiedConversion: percentage(sales, identifiedCommercialChats.length),
            buckets: Object.freeze(bucketCounts(operationalChats)),
            source: Object.freeze({
                metrics: 'GET /api/whatsapp/dashboard-metrics?country=EC',
                chats: 'GET /api/whatsapp/chats?country=EC&fast=1',
                writes: 0
            })
        });
    };

    return Object.freeze({
        authoritativeStatus,
        conversationBucket,
        normalizePanelStatus,
        projectEcSalesFirstMetrics
    });
});
