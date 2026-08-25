const ECUADOR_UTC_OFFSET_MS = -5 * 60 * 60 * 1000;
const PURCHASE_ELIGIBLE_STATUSES = new Set(['confirmed', 'processing', 'shipped', 'delivered']);

const asDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const finiteNumber = (value) => {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
};

const percentage = (part, total) => (
    total > 0 ? Math.round((finiteNumber(part) / finiteNumber(total)) * 1000) / 10 : 0
);

export const clampFunnelMetricsDays = (value, { fallback = 7, maximum = 90 } = {}) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(maximum, Math.max(1, parsed));
};

export const ecuadorMetricsRange = ({ days = 7, now = new Date() } = {}) => {
    const safeDays = clampFunnelMetricsDays(days);
    const endAt = asDate(now) || new Date();
    const ecuadorNow = new Date(endAt.getTime() + ECUADOR_UTC_OFFSET_MS);
    const startOfFirstEcuadorDayAsUtc = Date.UTC(
        ecuadorNow.getUTCFullYear(),
        ecuadorNow.getUTCMonth(),
        ecuadorNow.getUTCDate() - (safeDays - 1)
    );
    const startAt = new Date(startOfFirstEcuadorDayAsUtc - ECUADOR_UTC_OFFSET_MS);
    return { days: safeDays, startAt, endAt };
};

export const ecuadorDayKey = (value) => {
    const date = asDate(value);
    if (!date) return '';
    return new Date(date.getTime() + ECUADOR_UTC_OFFSET_MS).toISOString().slice(0, 10);
};

const isWithin = (value, startAt, endAt) => {
    const date = asDate(value);
    return Boolean(date && date >= startAt && date <= endAt);
};

const orderCreatedAt = (order = {}) => (
    asDate(order.entryAt)
    || asDate(order.draftCreatedAt)
    || asDate(order.createdAt)
);

const isPurchaseEligible = (order = {}) => PURCHASE_ELIGIBLE_STATUSES.has(
    String(order.status || '').trim().toLowerCase()
);

const metaEventsReceived = (response = {}) => {
    const candidates = [
        response?.events_received,
        response?.eventsReceived,
        response?.data?.events_received,
        response?.data?.eventsReceived,
        response?.response?.events_received,
        response?.response?.eventsReceived
    ];
    return candidates.reduce((highest, candidate) => Math.max(highest, finiteNumber(candidate)), 0);
};

const rowTemplate = (day) => ({
    day,
    entries: 0,
    repeatViews: 0,
    pageViewsSent: 0,
    whatsappVisitors: 0,
    clickRate: 0,
    leadsSent: 0,
    salesCreated: 0,
    salesValue: 0,
    purchasesSent: 0,
    purchaseValueSent: 0
});

const addToDay = (rowsByDay, value, field, amount = 1) => {
    const row = rowsByDay.get(ecuadorDayKey(value));
    if (row) row[field] += finiteNumber(amount);
};

const publicOrder = (order = {}, pixelId = '', datasetIdForOrder = () => '') => {
    const sentAt = asDate(order.tracking?.metaPurchaseSentAt);
    const eventsReceived = metaEventsReceived(order.tracking?.metaPurchaseResponse);
    const eligible = isPurchaseEligible(order);
    const datasetId = String(
        order.tracking?.metaPurchaseDatasetId
        || datasetIdForOrder(order)
        || pixelId
        || ''
    );
    const externalId = String(order.tracking?.external_id || order.tracking?.ext_id || '');
    return {
        orderId: String(order.orderId || ''),
        customer: { name: String(order.customer?.name || '') },
        country: String(order.country || order.tracking?.country || ''),
        product: {
            key: String(order.tracking?.productKey || ''),
            name: String(order.tracking?.productName || order.tracking?.product || '')
        },
        funnel: String(order.tracking?.funnel || ''),
        status: String(order.status || ''),
        total: finiteNumber(order.total),
        createdAt: orderCreatedAt(order),
        tracking: {
            metaPurchaseSentAt: sentAt,
            fbclid: String(order.tracking?.fbclid || ''),
            fbp: String(order.tracking?.fbp || ''),
            fbc: String(order.tracking?.fbc || ''),
            external_id: externalId,
            campaign_id: String(order.tracking?.campaign_id || ''),
            adset_id: String(order.tracking?.adset_id || ''),
            ad_id: String(order.tracking?.ad_id || ''),
            placement: String(order.tracking?.placement || ''),
            utm_source: String(order.tracking?.utm_source || ''),
            utm_medium: String(order.tracking?.utm_medium || ''),
            utm_campaign: String(order.tracking?.utm_campaign || ''),
            utm_content: String(order.tracking?.utm_content || ''),
            utm_term: String(order.tracking?.utm_term || ''),
            hasFbc: Boolean(order.tracking?.fbc),
            hasFbp: Boolean(order.tracking?.fbp),
            hasExternalId: Boolean(externalId),
            correlationStatus: String(
                order.tracking?.attributionCorrelationStatus
                || (order.tracking?.attributionSource ? 'CLAIMED' : '')
            ),
            correlationReason: String(order.tracking?.attributionCorrelationReason || '')
        },
        metaDelivery: {
            destination: 'Meta CAPI',
            pixelId: datasetId,
            datasetRoute: String(order.tracking?.metaPurchaseDatasetRoute || ''),
            eventsReceived,
            facebookStatus: eventsReceived > 0
                ? 'Recebido pela Meta'
                : sentAt ? 'Enviado; aguardando confirmacao da Meta' : 'Venda ainda nao apareceu no Facebook',
            panelStatus: sentAt
                ? 'Purchase registrado pela automacao'
                : eligible ? 'Elegivel, sem Purchase registrado' : 'Pedido ainda nao elegivel'
        }
    };
};

export const buildFunnelMetricsSnapshot = ({
    visits = [],
    orders = [],
    correlations = [],
    days = 7,
    now = new Date(),
    pixelId = '',
    datasetIdForOrder = () => ''
} = {}) => {
    const range = ecuadorMetricsRange({ days, now });
    const rows = [];
    const rowsByDay = new Map();
    const firstDay = ecuadorDayKey(range.startAt);
    const [year, month, date] = firstDay.split('-').map(Number);

    for (let offset = 0; offset < range.days; offset += 1) {
        const day = new Date(Date.UTC(year, month - 1, date + offset)).toISOString().slice(0, 10);
        const row = rowTemplate(day);
        rows.push(row);
        rowsByDay.set(day, row);
    }

    visits.forEach((visit) => {
        if (isWithin(visit.firstSeenAt, range.startAt, range.endAt)) {
            addToDay(rowsByDay, visit.firstSeenAt, 'entries');
            addToDay(rowsByDay, visit.firstSeenAt, 'repeatViews', Math.max(0, finiteNumber(visit.visits) - 1));
        }
        if (isWithin(visit.metaPageViewSentAt, range.startAt, range.endAt)) {
            addToDay(rowsByDay, visit.metaPageViewSentAt, 'pageViewsSent');
        }
        if (isWithin(visit.lastClickAt, range.startAt, range.endAt)) {
            addToDay(rowsByDay, visit.lastClickAt, 'whatsappVisitors');
        }
        if (isWithin(visit.metaLeadSentAt, range.startAt, range.endAt)) {
            addToDay(rowsByDay, visit.metaLeadSentAt, 'leadsSent');
        }
    });

    orders.forEach((order) => {
        const createdAt = orderCreatedAt(order);
        const sentAt = asDate(order.tracking?.metaPurchaseSentAt);
        if (isWithin(createdAt, range.startAt, range.endAt)) {
            addToDay(rowsByDay, createdAt, 'salesCreated');
            addToDay(rowsByDay, createdAt, 'salesValue', order.total);
        }
        if (isWithin(sentAt, range.startAt, range.endAt)) {
            addToDay(rowsByDay, sentAt, 'purchasesSent');
            addToDay(rowsByDay, sentAt, 'purchaseValueSent', order.total);
        }
    });

    rows.forEach((row) => {
        row.clickRate = percentage(row.whatsappVisitors, row.entries);
        row.salesValue = Math.round(row.salesValue * 100) / 100;
        row.purchaseValueSent = Math.round(row.purchaseValueSent * 100) / 100;
    });

    const totals = rows.reduce((result, row) => {
        ['entries', 'repeatViews', 'pageViewsSent', 'whatsappVisitors', 'leadsSent', 'salesCreated', 'salesValue', 'purchasesSent', 'purchaseValueSent']
            .forEach((field) => { result[field] += finiteNumber(row[field]); });
        return result;
    }, {
        entries: 0,
        repeatViews: 0,
        pageViewsSent: 0,
        whatsappVisitors: 0,
        clickRate: 0,
        leadsSent: 0,
        salesCreated: 0,
        salesValue: 0,
        purchasesSent: 0,
        purchaseValueSent: 0,
        purchaseCoverage: 0,
        missingPurchaseEligible: 0,
        correlationClaimed: 0,
        correlationAmbiguous: 0,
        correlationUnmatched: 0
    });

    correlations.forEach((correlation) => {
        if (!isWithin(correlation.evaluatedAt, range.startAt, range.endAt)) return;
        const status = String(correlation.status || '').trim().toUpperCase();
        if (status === 'CLAIMED') totals.correlationClaimed += 1;
        if (status === 'AMBIGUOUS') totals.correlationAmbiguous += 1;
        if (status === 'UNMATCHED') totals.correlationUnmatched += 1;
    });

    const eligibleOrders = orders.filter((order) => (
        isPurchaseEligible(order)
        && isWithin(orderCreatedAt(order), range.startAt, range.endAt)
    ));
    const missingOrders = eligibleOrders.filter((order) => !asDate(order.tracking?.metaPurchaseSentAt));
    const eligibleWithPurchase = eligibleOrders.length - missingOrders.length;
    totals.clickRate = percentage(totals.whatsappVisitors, totals.entries);
    totals.purchaseCoverage = percentage(eligibleWithPurchase, eligibleOrders.length);
    totals.missingPurchaseEligible = missingOrders.length;
    totals.salesValue = Math.round(totals.salesValue * 100) / 100;
    totals.purchaseValueSent = Math.round(totals.purchaseValueSent * 100) / 100;

    const byPurchaseNewest = (a, b) => (
        (asDate(b.tracking?.metaPurchaseSentAt)?.getTime() || 0)
        - (asDate(a.tracking?.metaPurchaseSentAt)?.getTime() || 0)
    );
    const byCreatedNewest = (a, b) => (
        (orderCreatedAt(b)?.getTime() || 0) - (orderCreatedAt(a)?.getTime() || 0)
    );
    const recentPurchases = orders
        .filter((order) => isWithin(order.tracking?.metaPurchaseSentAt, range.startAt, range.endAt))
        .sort(byPurchaseNewest)
        .slice(0, 50)
        .map((order) => publicOrder(order, pixelId, datasetIdForOrder));
    const recentMissingPurchases = missingOrders
        .sort(byCreatedNewest)
        .slice(0, 50)
        .map((order) => publicOrder(order, pixelId, datasetIdForOrder));
    const recentAttributionOrders = orders
        .filter((order) => isWithin(orderCreatedAt(order), range.startAt, range.endAt))
        .sort(byCreatedNewest)
        .slice(0, 50)
        .map((order) => publicOrder(order, pixelId, datasetIdForOrder));

    return {
        generatedAt: (asDate(now) || new Date()).toISOString(),
        startAt: range.startAt,
        endAt: range.endAt,
        days: range.days,
        rows,
        totals,
        recentPurchases,
        recentMissingPurchases,
        recentAttributionOrders
    };
};

export const funnelMetricsMongoWindow = ({ days = 7, now = new Date() } = {}) => {
    const range = ecuadorMetricsRange({ days, now });
    const between = { $gte: range.startAt, $lte: range.endAt };
    return {
        ...range,
        visitQuery: {
            country: 'EC',
            $or: [
                { firstSeenAt: between },
                { metaPageViewSentAt: between },
                { lastClickAt: between },
                { metaLeadSentAt: between }
            ]
        },
        orderQuery: {
            country: 'EC',
            $or: [
                { entryAt: between },
                { draftCreatedAt: between },
                { createdAt: between },
                { 'tracking.metaPurchaseSentAt': between }
            ]
        },
        correlationQuery: {
            country: 'EC',
            evaluatedAt: between
        }
    };
};
