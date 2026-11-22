const accepted = (order) => Boolean(order?.tracking?.metaPurchaseSentAt)
    && Number(order?.tracking?.metaPurchaseResponse?.events_received || 0) > 0;
const confirmedStatus = new Set(['confirmed', 'processing', 'shipped', 'delivered']);
const inWindow = (value, startAt, endAt) => {
    const time = new Date(value || '').getTime();
    return Number.isFinite(time) && time >= +startAt && time < +endAt;
};

export const metricsSiteKeyV257 = (sourceUrl) => {
    try {
        const url = new URL(String(sourceUrl || ''));
        if (url.protocol !== 'https:') return 'SEM_ORIGEM_COMPROVADA';
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        const section = url.pathname.split('/').filter(Boolean)[0] || '';
        return `${host}${section ? `/${section}` : ''}`;
    } catch {
        return 'SEM_ORIGEM_COMPROVADA';
    }
};

export const buildMetricsSiteSummaryV257 = ({ visits = [], orders = [], startAt, endAt } = {}) => {
    const rows = new Map();
    const rowFor = (site) => {
        if (!rows.has(site)) rows.set(site, {
            site, visits: 0, confirmedSales: 0, purchasePending: 0,
            metaAccepted: 0, metaAttributed: 0, revenue: 0
        });
        return rows.get(site);
    };
    for (const visit of visits) {
        if (visit.country !== 'EC' || !inWindow(visit.firstSeenAt, startAt, endAt)) continue;
        rowFor(metricsSiteKeyV257(visit.sourceUrl)).visits += 1;
    }
    const countedOrders = new Set();
    for (const order of orders) {
        if (order.country !== 'EC' || !confirmedStatus.has(order.status)
            || !inWindow(order.confirmedAt, startAt, endAt) || !order.orderId
            || countedOrders.has(order.orderId)) continue;
        countedOrders.add(order.orderId);
        const row = rowFor(metricsSiteKeyV257(order.tracking?.sourceUrl));
        row.confirmedSales += 1;
        const value = Number(order.total || 0);
        if (Number.isFinite(value)) row.revenue += value;
        if (['pending', 'retry_wait', 'sending'].includes(order.purchaseDeliveryV254?.state)) row.purchasePending += 1;
        if (accepted(order)) row.metaAccepted += 1;
        if (accepted(order) && (order.tracking?.metaPurchaseAttributedAt || order.tracking?.metaPurchaseInsightsVisibleAt
            || order.tracking?.metaPurchaseAttributionStatus === 'ATTRIBUTED')) row.metaAttributed += 1;
    }
    return [...rows.values()]
        .map((row) => ({ ...row, revenue: Math.round(row.revenue * 100) / 100 }))
        .sort((a, b) => b.confirmedSales - a.confirmedSales || b.visits - a.visits || a.site.localeCompare(b.site));
};
