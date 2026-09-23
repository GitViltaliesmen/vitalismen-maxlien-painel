// Read models only. This classification never grants permission to send/retry CAPI.
export const V144_ACTIVATED_AT = '2026-09-08T06:13:58.000Z';
export const dateV145 = value => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};
export const latestV145 = values => values.map(dateV145).filter(Boolean).sort((a, b) => b - a)[0] || null;
export const acceptedV145 = response => Math.max(0, ...[
    response?.events_received, response?.eventsReceived,
    response?.data?.events_received, response?.data?.eventsReceived,
    response?.response?.events_received, response?.response?.eventsReceived
].map(value => Number(value) || 0)) > 0;

export const classifyCapiOrderV145 = (order = {}, shipment = {}) => {
    const tracking = order.tracking || {};
    const response = tracking.metaPurchaseResponse || {};
    const submittedAt = dateV145(shipment.automation?.submittedToDroppiAt);
    const sentAt = dateV145(tracking.metaPurchaseSentAt);
    const hasDropi = Boolean(order.dropiOrderId || submittedAt);
    const base = {
        itemId: String(order._id || order.orderId || ''), orderId: order.orderId || '',
        eventName: 'Purchase', eventId: tracking.metaPurchaseEventId || null,
        createdAt: dateV145(order.createdAt), eligibleAt: dateV145(order.confirmedAt),
        submittedAt, sentAt, retryAuthorized: false, retryCount: null,
        metaCalls: null, active: false, retryable: false, historical: false,
        lastError: null
    };
    if (sentAt && acceptedV145(response)) return { ...base, classification: 'ACCEPTED', blockReason: null };
    // Submission evidence, never order creation time or the dashboard window, proves history.
    if (!sentAt && hasDropi && submittedAt && submittedAt < new Date(V144_ACTIVATED_AT)) {
        return { ...base, classification: 'HISTORICAL_NOT_RETROACTIVE',
            status: 'historical_not_retroactive', historical: true,
            blockReason: 'RETROACTIVE_PURCHASE_ALLOWED=NO' };
    }
    if (!hasDropi && !tracking.metaPurchaseEventId && !sentAt && !Object.keys(response).length) {
        return { ...base, classification: 'OTHER', blockReason: 'AWAITING_HUMAN_DROPI_SUBMISSION' };
    }
    const error = `${response.error || ''} ${response.reason || ''} ${response.code || ''} ${response.status || ''}`.toLowerCase();
    let classification = 'NEW_POST_V144_PENDING';
    let blockReason = 'PURCHASE_PENDING_AFTER_DROPI';
    let retryable = true;
    if (/v78|blocked|ec_bot_core|permission/.test(error)) {
        classification = 'V78_BLOCK'; blockReason = 'META_PURCHASE_CONTEXT_BLOCKED'; retryable = false;
    } else if (/payload|invalid|parameter/.test(error)) {
        classification = 'INVALID_PAYLOAD'; blockReason = 'META_INVALID_PAYLOAD'; retryable = false;
    } else if (/timeout|network|econn|fetch failed/.test(error)) {
        classification = 'NETWORK_ERROR'; blockReason = 'META_NETWORK_ERROR';
    } else if (sentAt || Object.keys(response).length) {
        classification = 'META_NOT_ACCEPTED'; blockReason = 'META_EVENTS_RECEIVED_MISSING';
    } else if (!submittedAt) {
        classification = 'OTHER'; blockReason = 'DROPI_SUBMISSION_TIME_UNVERIFIED'; retryable = false;
    }
    return { ...base, classification, blockReason, active: true, retryable,
        lastError: Object.keys(response).length || sentAt ? blockReason : null };
};

export const summarizeCapiQueueV145 = ({ orders = [], shipments = [] } = {}) => {
    const byOrder = new Map();
    for (const shipment of shipments) {
        const previous = byOrder.get(shipment.orderId);
        if (!previous || (dateV145(shipment.automation?.submittedToDroppiAt) || 0)
            > (dateV145(previous.automation?.submittedToDroppiAt) || 0)) byOrder.set(shipment.orderId, shipment);
    }
    const items = orders.map(order => classifyCapiOrderV145(order, byOrder.get(order.orderId)));
    return {
        items, activeQueue: items.filter(item => item.active).length,
        activeRetryableQueue: items.filter(item => item.active && item.retryable).length,
        historicalBlockedCount: items.filter(item => item.historical).length,
        awaitingHumanDropiCount: items.filter(item => item.blockReason === 'AWAITING_HUMAN_DROPI_SUBMISSION').length,
        lastError: items.find(item => item.active && item.lastError)?.lastError || null
    };
};

const healthRow = ({ healthStatus, providerConnected = null, lastSuccessAt = null,
    lastError = null, queueDepth = 0, ...extra }) => ({
    healthStatus, status: healthStatus, providerConnected, lastSuccessAt: dateV145(lastSuccessAt),
    lastSuccess: dateV145(lastSuccessAt), lastError, queueDepth, queueBacklog: queueDepth, ...extra
});

export const buildIntegrationHealthV145 = (evidence = {}) => {
    const { zapi = {}, capi = {}, meta = {}, bot = {}, orders = {}, checkedAt } = evidence;
    const unavailable = evidence.available !== true;
    const zapiProblem = unavailable ? 'OPERATIONAL_EVIDENCE_UNAVAILABLE'
        : zapi.providerConnected !== true ? 'ZAPI_PROVIDER_NOT_CONNECTED'
            : zapi.webhookHealthy !== true ? 'ZAPI_WEBHOOK_UNVERIFIED'
                : zapi.queueDepth > 50 ? 'ZAPI_QUEUE_ABOVE_LIMIT'
                    : zapi.recentOperationalError ? zapi.lastError || 'ZAPI_RECENT_ERROR' : null;
    return {
        meta: healthRow({ healthStatus: meta.available !== true ? 'FAILED' : meta.stale ? 'DEGRADED' : 'OK',
            lastSuccessAt: meta.lastSuccessAt, lastError: meta.lastError || (meta.stale ? 'META_CACHE_STALE' : null),
            operationalDataThrough: meta.dataThrough || null }),
        zapi: healthRow({ healthStatus: zapi.providerConnected === false ? 'FAILED' : zapiProblem ? 'DEGRADED' : 'OK',
            providerConnected: zapi.providerConnected ?? null, lastSuccessAt: zapi.lastSuccessAt,
            lastError: zapi.lastError || zapiProblem, lastErrorAt: dateV145(zapi.lastErrorAt),
            queueDepth: zapi.queueDepth ?? null, reason: zapiProblem,
            webhookHealthy: zapi.webhookHealthy ?? null, lastWebhookAt: dateV145(zapi.lastWebhookAt),
            lastInboundAt: dateV145(zapi.lastInboundAt), lastOutboundAt: dateV145(zapi.lastOutboundAt) }),
        bot: healthRow({ healthStatus: unavailable || bot.recentFailure || zapi.queueDepth > 50 ? 'DEGRADED' : 'OK',
            lastSuccessAt: bot.lastSuccessAt, lastError: bot.lastError || null, queueDepth: zapi.queueDepth ?? null }),
        orders: healthRow({ healthStatus: unavailable ? 'DEGRADED' : 'OK', lastSuccessAt: orders.lastSuccessAt,
            lastError: unavailable ? 'OPERATIONAL_EVIDENCE_UNAVAILABLE' : null }),
        capi: healthRow({ healthStatus: unavailable || capi.activeQueue > 0 ? 'DEGRADED' : 'OK',
            lastSuccessAt: capi.lastAcceptedPurchaseAt, lastError: capi.lastError || (unavailable ? 'CAPI_EVIDENCE_UNAVAILABLE' : null),
            queueDepth: unavailable ? null : capi.activeQueue || 0,
            activeRetryableQueue: capi.activeRetryableQueue || 0,
            historicalBlockedCount: capi.historicalBlockedCount || 0,
            awaitingHumanDropiCount: capi.awaitingHumanDropiCount || 0,
            lastAcceptedPurchaseAt: dateV145(capi.lastAcceptedPurchaseAt),
            items: capi.items || [] }),
        metrics: healthRow({ healthStatus: unavailable ? 'DEGRADED' : 'OK', lastSuccessAt: checkedAt,
            lastError: unavailable ? 'OPERATIONAL_EVIDENCE_UNAVAILABLE' : null })
    };
};

export const applyIntegrationHealthV145 = (operational, evidence, metaAds = {}) => {
    const selectedWindow = { startAt: operational.startAt, endAt: operational.endAt, timezone: operational.timezone };
    const t = operational.totals;
    const counts = { meta: Number(metaAds.totals?.landingPageViews || 0), zapi: t.zapiInboundMessages,
        bot: t.botSent, orders: t.ordersCreated, capi: t.purchaseSent, metrics: t.ordersCreated + t.zapiInboundMessages };
    const dataThrough = { meta: metaAds.dataThrough || null, zapi: operational.freshness.zapiDataThrough,
        bot: operational.freshness.botDataThrough, orders: operational.freshness.orderDataThrough,
        capi: operational.freshness.capiDataThrough, metrics: operational.freshness.metricsComputedAt };
    const health = buildIntegrationHealthV145(evidence);
    for (const [key, row] of Object.entries(health)) {
        row.selectedWindow = selectedWindow;
        row.eventCountInWindow = counts[key] || 0;
        row.lastEventInWindow = counts[key] ? dataThrough[key] : null;
        row.dataThroughInWindow = dataThrough[key];
        row.dataThrough = dataThrough[key]; // Compatibility alias: never used for provider health.
        row.dataStatus = counts[key] ? 'OK' : 'NO_DATA_IN_WINDOW';
    }
    const failures = [...operational.integrity.failures];
    if (t.metaAccepted > t.purchaseSent) failures.push('META_ACCEPTED_GT_CAPI_SENT');
    if (t.purchaseSent > t.purchaseEligible) failures.push('CAPI_SENT_GT_CAPI_ELIGIBLE');
    if (t.metaAttributed > t.metaAccepted) failures.push('META_ATTRIBUTED_GT_META_ACCEPTED');
    if (failures.length) {
        health.metrics.healthStatus = health.metrics.status = 'FAILED';
        health.metrics.lastError = [...new Set(failures)];
    }
    return { ...operational, healthVersion: 'V145', selectedWindow, health,
        integrity: { status: failures.length ? 'FAIL' : 'PASS', failures: [...new Set(failures)] } };
};
