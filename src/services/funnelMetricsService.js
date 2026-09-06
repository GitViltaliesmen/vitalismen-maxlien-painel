import { isEcuadorTexUltraProtocoloG } from './metaProtocoloGAttributionService.js';

const ECUADOR_UTC_OFFSET_MS = -5 * 60 * 60 * 1000;
const PURCHASE_ELIGIBLE_STATUSES = new Set(['confirmed', 'processing', 'shipped', 'delivered']);
export const PROTOCOLO_G_MEASUREMENT_STARTED_AT = '2026-08-26T05:13:18.000Z';

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

export const ecuadorHourKey = (value) => {
    const date = asDate(value);
    if (!date) return -1;
    return new Date(date.getTime() + ECUADOR_UTC_OFFSET_MS).getUTCHours();
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

const protocoloGRowTemplate = (day) => ({
    day,
    landing: 0,
    videoStarted: 0,
    watched25: 0,
    watched50: 0,
    earlyCtaVisible: 0,
    formOpened: 0,
    formSubmitted: 0,
    whatsappClicks: 0,
    attributedConversations: 0,
    salesCreated: 0,
    purchasesSent: 0
});

const protocoloGAdTemplate = ({
    campaignId = '',
    adsetId = '',
    adId = '',
    campaignName = '',
    adName = '',
    placement = ''
} = {}) => ({
    campaignId,
    adsetId,
    adId,
    campaignName,
    adName,
    placements: placement ? [placement] : [],
    landing: 0,
    videoStarted: 0,
    watched25: 0,
    watched50: 0,
    earlyCtaVisible: 0,
    formOpened: 0,
    formSubmitted: 0,
    whatsappClicks: 0,
    attributedConversations: 0,
    salesCreated: 0,
    purchasesSent: 0
});

const trackingName = (value, id) => {
    const name = String(value || '').trim();
    const suffix = id ? `|${id}` : '';
    return suffix && name.endsWith(suffix) ? name.slice(0, -suffix.length).trim() : name;
};

const protocoloGAdIdentity = (source = {}, { order = false } = {}) => {
    const tracking = source.tracking || {};
    const campaignId = String(order ? tracking.campaign_id || '' : source.campaignId || '').trim();
    const adsetId = String(order ? tracking.adset_id || '' : source.adsetId || '').trim();
    const adId = String(order ? tracking.ad_id || '' : source.adId || '').trim();
    return {
        key: adId || `sem-ad-id:${campaignId}:${adsetId}`,
        campaignId,
        adsetId,
        adId,
        campaignName: trackingName(tracking.utm_campaign, campaignId),
        adName: trackingName(tracking.utm_content, adId),
        placement: String(order ? tracking.placement || '' : source.placement || '').trim()
    };
};

const addProtocoloGAdMetric = (rowsByAd, source, field, { order = false } = {}) => {
    const identity = protocoloGAdIdentity(source, { order });
    let row = rowsByAd.get(identity.key);
    if (!row) {
        row = protocoloGAdTemplate(identity);
        rowsByAd.set(identity.key, row);
    }
    row[field] += 1;
    if (identity.placement && !row.placements.includes(identity.placement)) {
        row.placements.push(identity.placement);
    }
};

const finishProtocoloGAdRow = (row) => ({
    ...row,
    videoStartRate: percentage(row.videoStarted, row.landing),
    watched25Rate: percentage(row.watched25, row.videoStarted),
    watched50Rate: percentage(row.watched50, row.videoStarted),
    formOpenRate: percentage(row.formOpened, row.landing),
    formSubmitRate: percentage(row.formSubmitted, row.formOpened),
    whatsappRate: percentage(row.whatsappClicks, row.landing),
    conversationRate: percentage(row.attributedConversations, row.whatsappClicks),
    salesRate: percentage(row.salesCreated, row.landing)
});

const addToDay = (rowsByDay, value, field, amount = 1) => {
    const row = rowsByDay.get(ecuadorDayKey(value));
    if (row) row[field] += finiteNumber(amount);
};

const investmentRadarHourTemplate = (hour) => ({
    hour,
    entries: 0,
    videoStarted: 0,
    watched25: 0,
    whatsappClicks: 0,
    attributedConversations: 0
});

const isInvestmentRadarQaVisit = (visit = {}) => String(
    visit.placement || visit.tracking?.placement || ''
).trim().toLowerCase().startsWith('qa_');

const normalizedTargetScore = (value, target) => Math.min(100, percentage(value, target));

const finishInvestmentRadarHour = (row = {}) => {
    const videoStartRate = percentage(row.videoStarted, row.entries);
    const watched25Rate = percentage(row.watched25, row.videoStarted);
    const whatsappRate = percentage(row.whatsappClicks, row.entries);
    const conversationRate = percentage(row.attributedConversations, row.whatsappClicks);
    const confidence = Math.min(100, Math.round((finiteNumber(row.entries) / 20) * 100));
    const quality = (
        normalizedTargetScore(videoStartRate, 55) * 0.20
        + normalizedTargetScore(watched25Rate, 35) * 0.15
        + normalizedTargetScore(whatsappRate, 8) * 0.35
        + normalizedTargetScore(conversationRate, 60) * 0.30
    );
    const score = Math.round(quality * (0.45 + (confidence / 100) * 0.55));
    return {
        ...row,
        videoStartRate,
        watched25Rate,
        whatsappRate,
        conversationRate,
        confidence,
        score: Math.max(0, Math.min(100, score))
    };
};

const investmentWindowSummary = (rows = [], startHour = 0) => {
    const aggregate = rows.reduce((result, row) => {
        ['entries', 'videoStarted', 'watched25', 'whatsappClicks', 'attributedConversations']
            .forEach((field) => { result[field] += finiteNumber(row[field]); });
        return result;
    }, investmentRadarHourTemplate(startHour));
    const finished = finishInvestmentRadarHour(aggregate);
    return {
        startHour,
        endHour: startHour + rows.length,
        label: `${String(startHour).padStart(2, '0')}h–${String(startHour + rows.length).padStart(2, '0')}h`,
        entries: finished.entries,
        whatsappClicks: finished.whatsappClicks,
        attributedConversations: finished.attributedConversations,
        score: finished.score,
        confidence: finished.confidence
    };
};

const buildInvestmentRadar = (hourRows = []) => {
    const hours = hourRows.map(finishInvestmentRadarHour);
    const totalEntries = hours.reduce((sum, row) => sum + finiteNumber(row.entries), 0);
    const windows = [];
    for (let startHour = 0; startHour <= 21; startHour += 1) {
        windows.push(investmentWindowSummary(hours.slice(startHour, startHour + 3), startHour));
    }
    const bestWindow = windows
        .filter((row) => row.entries > 0)
        .sort((left, right) => (
            right.score - left.score
            || right.entries - left.entries
            || left.startHour - right.startHour
        ))[0] || null;
    return {
        version: 'V134',
        mode: 'READ_ONLY_RECOMMENDATION',
        timezone: 'America/Guayaquil',
        state: totalEntries === 0 ? 'no_data' : totalEntries < 20 ? 'learning' : 'ready',
        sampleEntries: totalEntries,
        bestWindow,
        hours
    };
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
    const protocoloGRows = [];
    const protocoloGRowsByDay = new Map();
    const protocoloGRowsByAd = new Map();
    const investmentRadarHours = Array.from({ length: 24 }, (_, hour) => investmentRadarHourTemplate(hour));
    const protocoloGMeasurementStartedAt = asDate(PROTOCOLO_G_MEASUREMENT_STARTED_AT);
    const protocoloGStartAt = new Date(Math.max(
        range.startAt.getTime(),
        protocoloGMeasurementStartedAt.getTime()
    ));
    const firstDay = ecuadorDayKey(range.startAt);
    const [year, month, date] = firstDay.split('-').map(Number);

    for (let offset = 0; offset < range.days; offset += 1) {
        const day = new Date(Date.UTC(year, month - 1, date + offset)).toISOString().slice(0, 10);
        const row = rowTemplate(day);
        rows.push(row);
        rowsByDay.set(day, row);
        const protocoloGRow = protocoloGRowTemplate(day);
        protocoloGRows.push(protocoloGRow);
        protocoloGRowsByDay.set(day, protocoloGRow);
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

        if (!isEcuadorTexUltraProtocoloG(visit)) return;
        const stages = visit.protocoloGStages || {};
        const radarEntryAt = stages.landingAt || visit.firstSeenAt;
        if (!isInvestmentRadarQaVisit(visit) && isWithin(radarEntryAt, protocoloGStartAt, range.endAt)) {
            const radarHour = ecuadorHourKey(radarEntryAt);
            const radarRow = investmentRadarHours[radarHour];
            if (radarRow) {
                radarRow.entries += 1;
                if (isWithin(stages.videoStartedAt, radarEntryAt, range.endAt)) radarRow.videoStarted += 1;
                if (isWithin(stages.watched25At, radarEntryAt, range.endAt)) radarRow.watched25 += 1;
                if (isWithin(visit.lastClickAt, radarEntryAt, range.endAt)) radarRow.whatsappClicks += 1;
                if (isWithin(visit.attributionClaimedAt, radarEntryAt, range.endAt)) radarRow.attributedConversations += 1;
            }
        }
        [
            ['landingAt', 'landing'],
            ['videoStartedAt', 'videoStarted'],
            ['watched25At', 'watched25'],
            ['watched50At', 'watched50'],
            ['earlyCtaVisibleAt', 'earlyCtaVisible'],
            ['formOpenedAt', 'formOpened'],
            ['formSubmittedAt', 'formSubmitted']
        ].forEach(([timestamp, field]) => {
            if (isWithin(stages[timestamp], protocoloGStartAt, range.endAt)) {
                addToDay(protocoloGRowsByDay, stages[timestamp], field);
                addProtocoloGAdMetric(protocoloGRowsByAd, visit, field);
            }
        });
        if (isWithin(visit.lastClickAt, protocoloGStartAt, range.endAt)) {
            addToDay(protocoloGRowsByDay, visit.lastClickAt, 'whatsappClicks');
            addProtocoloGAdMetric(protocoloGRowsByAd, visit, 'whatsappClicks');
        }
        if (isWithin(visit.attributionClaimedAt, protocoloGStartAt, range.endAt)) {
            addToDay(protocoloGRowsByDay, visit.attributionClaimedAt, 'attributedConversations');
            addProtocoloGAdMetric(protocoloGRowsByAd, visit, 'attributedConversations');
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
        if (!isEcuadorTexUltraProtocoloG(order)) return;
        if (isWithin(createdAt, protocoloGStartAt, range.endAt)) {
            addToDay(protocoloGRowsByDay, createdAt, 'salesCreated');
            addProtocoloGAdMetric(protocoloGRowsByAd, order, 'salesCreated', { order: true });
        }
        if (isWithin(sentAt, protocoloGStartAt, range.endAt)) {
            addToDay(protocoloGRowsByDay, sentAt, 'purchasesSent');
            addProtocoloGAdMetric(protocoloGRowsByAd, order, 'purchasesSent', { order: true });
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

    const protocoloGTotals = protocoloGRows.reduce((result, row) => {
        [
            'landing',
            'videoStarted',
            'watched25',
            'watched50',
            'earlyCtaVisible',
            'formOpened',
            'formSubmitted',
            'whatsappClicks',
            'attributedConversations',
            'salesCreated',
            'purchasesSent'
        ].forEach((field) => { result[field] += finiteNumber(row[field]); });
        return result;
    }, {
        landing: 0,
        videoStarted: 0,
        watched25: 0,
        watched50: 0,
        earlyCtaVisible: 0,
        formOpened: 0,
        formSubmitted: 0,
        whatsappClicks: 0,
        attributedConversations: 0,
        salesCreated: 0,
        purchasesSent: 0
    });
    protocoloGTotals.videoStartRate = percentage(protocoloGTotals.videoStarted, protocoloGTotals.landing);
    protocoloGTotals.watched25Rate = percentage(protocoloGTotals.watched25, protocoloGTotals.videoStarted);
    protocoloGTotals.watched50Rate = percentage(protocoloGTotals.watched50, protocoloGTotals.videoStarted);
    protocoloGTotals.formOpenRate = percentage(protocoloGTotals.formOpened, protocoloGTotals.landing);
    protocoloGTotals.formSubmitRate = percentage(protocoloGTotals.formSubmitted, protocoloGTotals.formOpened);
    protocoloGTotals.whatsappRate = percentage(protocoloGTotals.whatsappClicks, protocoloGTotals.landing);
    protocoloGTotals.conversationRate = percentage(protocoloGTotals.attributedConversations, protocoloGTotals.whatsappClicks);
    protocoloGTotals.salesRate = percentage(protocoloGTotals.salesCreated, protocoloGTotals.landing);
    const protocoloGAds = [...protocoloGRowsByAd.values()]
        .map(finishProtocoloGAdRow)
        .sort((left, right) => (
            right.landing - left.landing
            || right.whatsappClicks - left.whatsappClicks
            || right.salesCreated - left.salesCreated
            || left.adId.localeCompare(right.adId)
        ));
    const investmentRadar = buildInvestmentRadar(investmentRadarHours);

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
        protocoloG: {
            version: 'V63',
            productKey: 'tex_ultra_ec',
            funnel: 'PROTOCOLO_G',
            sourceUrl: 'https://vilaliemen.shop/protocolo-g',
            measurementStartedAt: PROTOCOLO_G_MEASUREMENT_STARTED_AT,
            rows: protocoloGRows,
            totals: protocoloGTotals,
            ads: protocoloGAds
        },
        investmentRadar,
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
                { metaLeadSentAt: between },
                { attributionClaimedAt: between },
                { 'protocoloGStages.landingAt': between },
                { 'protocoloGStages.videoStartedAt': between },
                { 'protocoloGStages.watched25At': between },
                { 'protocoloGStages.watched50At': between },
                { 'protocoloGStages.earlyCtaVisibleAt': between },
                { 'protocoloGStages.formOpenedAt': between },
                { 'protocoloGStages.formSubmittedAt': between }
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
