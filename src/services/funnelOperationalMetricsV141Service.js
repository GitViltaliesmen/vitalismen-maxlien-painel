const TIMEZONE = 'America/Guayaquil';
const PURCHASE_ELIGIBLE = new Set(['confirmed', 'processing', 'shipped', 'delivered']);

const asDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const inWindow = (value, startAt, endAt) => {
    const date = asDate(value);
    return Boolean(date && date >= asDate(startAt) && date < asDate(endAt));
};

const digits = (value) => String(value || '').replace(/\D/g, '');
const phoneKey = (value) => {
    const normalized = digits(value);
    return normalized.length >= 9 ? normalized.slice(-9) : normalized;
};

const contactPhone = (contact = {}) => phoneKey(
    contact.phoneDigits
    || contact.metadata?.customerPhoneDigits
    || contact.metadata?.customerDraft?.phone
    || contact.chatId
);

const messagePhone = (message = {}) => phoneKey(
    message.peerPhone || message.chatId || message.to || message.from
);

const orderPhone = (order = {}) => phoneKey(order.customer?.phone);

const contactEntryAt = (contact = {}) => (
    contact.firstInboundAt
    || contact.metadata?.zapiCapturedAt
    || contact.metadata?.zapiInboundAt
    || contact.metadata?.vslEntryPanelLeadAt
    || contact.createdAt
);

const messageAt = (message = {}) => {
    if (message.createdAt) return message.createdAt;
    const raw = Number(message.timestamp || 0);
    if (!raw) return null;
    return new Date(raw > 1e12 ? raw : raw * 1000);
};

const orderEntryAt = (order = {}) => order.entryAt || order.draftCreatedAt || order.createdAt;
const hasTag = (contact, tag) => (contact.tags || []).includes(tag);
const isBot = (message = {}) => {
    if (!message.isFromMe) return false;
    if (message.isBot === true) return true;
    if (message.isBot === false) return false;
    if (String(message.senderRole || '').toLowerCase() === 'human' || message.attendantId) return false;
    return String(message.senderRole || '').toLowerCase() === 'bot'
        || String(message.from || '').toLowerCase() === 'bot';
};
const isHuman = (message = {}) => Boolean(message.isFromMe) && !isBot(message) && (
    String(message.senderRole || '').toLowerCase() === 'human'
    || Boolean(message.attendantId)
);
const isDelivered = (message = {}) => Boolean(
    message.deliveredAt
    || Number(message.ack) >= 2
    || ['delivered', 'read'].includes(String(message.deliveryStatus || '').toLowerCase())
);
const isFailed = (message = {}) => Boolean(
    message.sendError || String(message.deliveryStatus || '').toLowerCase() === 'failed'
);
const metaEventsReceived = (response = {}) => Math.max(0, ...[
    response?.events_received,
    response?.eventsReceived,
    response?.data?.events_received,
    response?.data?.eventsReceived,
    response?.response?.events_received,
    response?.response?.eventsReceived
].map((value) => Number(value || 0)));

const maxDate = (values = []) => values
    .map(asDate)
    .filter(Boolean)
    .sort((left, right) => right - left)[0] || null;

const rate = (part, total) => total > 0 ? Math.round((part / total) * 1000) / 10 : 0;

const unmatchedClass = (correlation = {}) => {
    const reason = String(correlation.reason || '').toLowerCase();
    if (Number(correlation.candidateCount || 0) > 1 || reason.includes('multiple') || reason.includes('ambiguous')) return 'MULTIPLE_MATCHES';
    if (reason.includes('customer')) return 'NO_CUSTOMER_LINK';
    if (reason.includes('order')) return 'NO_ORDER_LINK';
    if (reason.includes('external')) return 'NO_EXTERNAL_ID';
    if (reason.includes('fbc')) return 'NO_FBC';
    if (reason.includes('fbp')) return 'NO_FBP';
    if (reason.includes('ad_id') || reason.includes('ad id')) return 'NO_AD_ID';
    if (reason.includes('legacy')) return 'LEGACY_RECORD';
    if (reason.includes('no_unique_exact_visit') || reason.includes('visit')) return 'NO_ATTRIBUTION_CONTEXT';
    return 'OTHER';
};

const publicUnmatched = (correlations = []) => {
    const causes = {};
    for (const correlation of correlations) {
        if (String(correlation.status || '').toUpperCase() === 'CLAIMED') continue;
        const cause = unmatchedClass(correlation);
        causes[cause] = (causes[cause] || 0) + 1;
    }
    return causes;
};

const botFailureReason = (message = {}) => {
    const value = `${message.sendError || ''} ${message.providerStatus || ''}`.toLowerCase();
    if (value.includes('route')) return 'NO_ROUTE';
    if (value.includes('pause')) return 'PAUSED';
    if (value.includes('human') || value.includes('manual')) return 'HUMAN_LOCK';
    if (value.includes('queue')) return 'QUEUE_ERROR';
    if (value.includes('zapi') || value.includes('provider')) return 'ZAPI_ERROR';
    if (value.includes('duplicate')) return 'DUPLICATE_SUPPRESSED';
    return 'OTHER';
};

export const buildFunnelOperationalMetricsV141 = ({
    contacts = [],
    messages = [],
    orders = [],
    correlations = [],
    metaAds = {},
    startAt,
    endAt,
    computedAt = new Date()
} = {}) => {
    const start = asDate(startAt);
    const end = asDate(endAt);
    if (!start || !end || start >= end) throw new Error('Invalid V141 metrics window.');

    const entryContacts = contacts.filter((contact) => (
        (!contact.countryCode || contact.countryCode === 'EC')
        && inWindow(contactEntryAt(contact), start, end)
    ));
    const sourceContacts = entryContacts.filter((contact) => (
        hasTag(contact, 'VSL_EC')
        || String(contact.metadata?.vslVariant || '').toLowerCase() === 'protocolo_g'
    ));
    const sourcePhones = new Set(sourceContacts.map(contactPhone).filter(Boolean));
    const zapiPhones = new Set(sourceContacts
        .filter((contact) => hasTag(contact, 'ZAPI_INBOUND_CAPTURED') || contact.metadata?.zapiCapturedAt)
        .map(contactPhone).filter(Boolean));

    const windowMessages = messages.filter((message) => inWindow(messageAt(message), start, end));
    const inboundMessages = windowMessages.filter((message) => (
        !message.isFromMe
        && String(message.provider || '').toLowerCase() === 'zapi'
        && Boolean(message.providerMessageId || message._id)
    ));
    const sourceInboundMessages = inboundMessages.filter((message) => sourcePhones.has(messagePhone(message)));
    const botMessages = windowMessages.filter(isBot);
    const deliveredBotMessages = botMessages.filter(isDelivered);
    const failedBotMessages = botMessages.filter((message) => isFailed(message) && sourcePhones.has(messagePhone(message)));
    const botPhones = new Set(botMessages.map(messagePhone).filter((phone) => sourcePhones.has(phone)));
    const deliveredBotPhones = new Set(deliveredBotMessages.map(messagePhone).filter((phone) => sourcePhones.has(phone)));
    const humanPhones = new Set([
        ...windowMessages.filter(isHuman).map(messagePhone),
        ...entryContacts.filter((contact) => contact.human?.mode === 'manual').map(contactPhone)
    ].filter((phone) => phone && sourcePhones.has(phone)));

    const windowOrders = orders.filter((order) => (
        (!order.country || order.country === 'EC') && inWindow(orderEntryAt(order), start, end)
    ));
    const linkedOrders = windowOrders.filter((order) => sourcePhones.has(orderPhone(order)));
    const commercialOrders = linkedOrders.length ? linkedOrders : windowOrders;
    const eligibleOrders = commercialOrders.filter((order) => PURCHASE_ELIGIBLE.has(String(order.status || '').toLowerCase()));
    const sentOrders = eligibleOrders.filter((order) => Boolean(asDate(order.tracking?.metaPurchaseSentAt)));
    const acceptedOrders = sentOrders.filter((order) => metaEventsReceived(order.tracking?.metaPurchaseResponse) > 0);
    const attributedOrders = acceptedOrders.filter((order) => Boolean(
        order.tracking?.metaPurchaseAttributedAt
        || order.tracking?.metaPurchaseInsightsVisibleAt
        || String(order.tracking?.metaPurchaseAttributionStatus || '').toUpperCase() === 'ATTRIBUTED'
    ));

    const failedReasons = {};
    for (const message of failedBotMessages) {
        const reason = botFailureReason(message);
        failedReasons[reason] = (failedReasons[reason] || 0) + 1;
    }

    const totals = {
        zapiInbound: zapiPhones.size,
        zapiInboundMessages: new Set(sourceInboundMessages.map((message) => String(message.providerMessageId || message._id))).size,
        vslEcTagged: sourceContacts.filter((contact) => hasTag(contact, 'VSL_EC')).length,
        whatsappClickTagged: sourceContacts.filter((contact) => hasTag(contact, 'WHATSAPP_CLICK')).length,
        texUltraEcTagged: sourceContacts.filter((contact) => hasTag(contact, 'TEX_ULTRA_EC')).length,
        conversationsCreated: sourceContacts.length,
        botTriggered: botPhones.size,
        botSent: botMessages.filter((message) => sourcePhones.has(messagePhone(message))).length,
        botDelivered: deliveredBotMessages.filter((message) => sourcePhones.has(messagePhone(message))).length,
        botConversationsDelivered: deliveredBotPhones.size,
        botAudioSent: botMessages.filter((message) => sourcePhones.has(messagePhone(message)) && ['audio', 'ptt'].includes(message.type)).length,
        botMediaSent: botMessages.filter((message) => sourcePhones.has(messagePhone(message)) && message.hasMedia).length,
        botFailed: failedBotMessages.filter((message) => sourcePhones.has(messagePhone(message))).length,
        humanTakeovers: humanPhones.size,
        ordersCreated: commercialOrders.length,
        ordersConfirmed: eligibleOrders.length,
        salesFinalized: eligibleOrders.length,
        purchaseEligible: eligibleOrders.length,
        purchaseEventCreated: eligibleOrders.filter((order) => Boolean(order.tracking?.metaPurchaseEventId)).length,
        purchaseSent: sentOrders.length,
        metaAccepted: acceptedOrders.length,
        metaAttributed: attributedOrders.length,
        unattributed: Math.max(0, acceptedOrders.length - attributedOrders.length),
        revenue: Math.round(eligibleOrders.reduce((sum, order) => sum + Number(order.total || 0), 0) * 100) / 100
    };
    const rates = {
        lpvToInbound: rate(totals.zapiInbound, Number(metaAds.totals?.landingPageViews || 0)),
        inboundToBot: rate(totals.botTriggered, totals.zapiInbound),
        inboundToOrder: rate(totals.ordersCreated, totals.zapiInbound),
        orderToPurchase: rate(totals.purchaseSent, totals.purchaseEligible),
        purchaseToMetaAccepted: rate(totals.metaAccepted, totals.purchaseSent),
        metaAttributionRate: rate(totals.metaAttributed, totals.metaAccepted)
    };
    const invariantFailures = [];
    if (totals.botTriggered > totals.zapiInbound) invariantFailures.push('BOT_TRIGGERED_GT_ZAPI_INBOUND');
    if (totals.botDelivered > totals.botSent) invariantFailures.push('BOT_DELIVERED_GT_BOT_SENT');
    if (totals.ordersConfirmed > totals.ordersCreated) invariantFailures.push('ORDERS_CONFIRMED_GT_ORDERS_CREATED');
    if (totals.purchaseSent > totals.purchaseEligible) invariantFailures.push('PURCHASE_SENT_GT_PURCHASE_ELIGIBLE');
    if (totals.metaAttributed > totals.metaAccepted) invariantFailures.push('META_ATTRIBUTED_GT_META_ACCEPTED');

    const alerts = [];
    if (metaAds.stale || metaAds.fetchStatus === 'failed') alerts.push('META_CACHE_STALE_OR_FETCH_FAILED');
    if (totals.zapiInbound > 0 && totals.botTriggered === 0) alerts.push('ZAPI_INBOUND_WITHOUT_BOT_METRICS');
    if (totals.ordersConfirmed > 0 && totals.purchaseEligible === 0) alerts.push('CONFIRMED_WITHOUT_PURCHASE_ELIGIBILITY');
    if (totals.purchaseSent > 0 && totals.metaAccepted === 0) alerts.push('PURCHASE_SENT_WITHOUT_META_ACCEPTANCE');

    const freshness = {
        timezone: TIMEZONE,
        metaFetchedAt: asDate(metaAds.fetchedAt),
        metaDataThrough: metaAds.dataThrough || metaAds.endDay || '',
        zapiDataThrough: maxDate(sourceInboundMessages.map(messageAt)),
        botDataThrough: maxDate(botMessages.map(messageAt)),
        orderDataThrough: maxDate(commercialOrders.map(orderEntryAt)),
        capiDataThrough: maxDate(sentOrders.map((order) => order.tracking?.metaPurchaseSentAt)),
        metricsComputedAt: asDate(computedAt) || new Date()
    };
    const health = {
        meta: {
            status: metaAds.fetchStatus === 'failed' || metaAds.status === 'unavailable'
                ? 'FAILED' : metaAds.stale ? 'STALE' : 'OK',
            lastSuccess: freshness.metaFetchedAt,
            lastError: metaAds.lastError || null,
            queueBacklog: 0,
            dataThrough: freshness.metaDataThrough
        },
        zapi: {
            status: totals.zapiInbound > 0 ? 'OK' : 'DEGRADED',
            lastSuccess: freshness.zapiDataThrough,
            lastError: null,
            queueBacklog: 0,
            dataThrough: freshness.zapiDataThrough
        },
        bot: {
            status: totals.zapiInbound > 0 && totals.botTriggered === 0 ? 'DEGRADED' : 'OK',
            lastSuccess: freshness.botDataThrough,
            lastError: totals.botFailed ? failedReasons : null,
            queueBacklog: 0,
            dataThrough: freshness.botDataThrough
        },
        orders: {
            status: 'OK',
            lastSuccess: freshness.orderDataThrough,
            lastError: null,
            queueBacklog: 0,
            dataThrough: freshness.orderDataThrough
        },
        capi: {
            status: totals.purchaseEligible > totals.purchaseSent ? 'DEGRADED' : 'OK',
            lastSuccess: freshness.capiDataThrough,
            lastError: totals.purchaseEligible > totals.purchaseSent ? 'PURCHASE_ELIGIBLE_BACKLOG' : null,
            queueBacklog: Math.max(0, totals.purchaseEligible - totals.purchaseSent),
            dataThrough: freshness.capiDataThrough
        },
        metrics: {
            status: invariantFailures.length ? 'FAILED' : 'OK',
            lastSuccess: freshness.metricsComputedAt,
            lastError: invariantFailures.length ? invariantFailures : null,
            queueBacklog: 0,
            dataThrough: freshness.metricsComputedAt
        }
    };

    return {
        version: 'V141',
        semantics: 'event_history_in_canonical_window',
        timezone: TIMEZONE,
        startAt: start,
        endAt: end,
        totals,
        rates,
        botFailureReasons: failedReasons,
        unmatchedRootCauses: publicUnmatched(correlations),
        integrity: { status: invariantFailures.length ? 'FAIL' : 'PASS', failures: invariantFailures },
        alerts,
        freshness,
        health
    };
};

export const classifyUnmatchedRootCauseV141 = unmatchedClass;
