import fs from 'node:fs';
import path from 'node:path';
import { getZapiStatus, zapiConfig } from './zapiClient.js';
import { getQueueSize } from '../whatsapp/queue.js';
import { acceptedV145, dateV145, latestV145, summarizeCapiQueueV145 } from './funnelIntegrationHealthV145Service.js';

const successfulMessage = { provider: 'zapi', isFromMe: true,
    deliveryStatus: { $in: ['sent', 'delivered', 'read'] }, providerMessageId: { $nin: ['', null] } };
const messageFailure = { provider: 'zapi', isFromMe: true,
    $or: [{ deliveryStatus: 'failed' }, { sendError: { $exists: true, $nin: ['', null] } }] };
const timeProjection = 'createdAt updatedAt deliveredAt readAt sendError providerStatus deliveryStatus';
const safeFailure = message => !message ? null : /subscribe to this instance again/i.test(message.sendError || '')
    ? 'ZAPI_SUBSCRIPTION_INACTIVE' : /timeout/i.test(message.sendError || '') ? 'ZAPI_TIMEOUT' : 'ZAPI_OUTBOUND_FAILED';

export const readMetaHealthV145 = ({ env = process.env, now = new Date() } = {}) => {
    const file = env.META_ADS_INSIGHTS_CACHE_FILE_EC || (process.platform === 'win32'
        ? path.resolve('.local/meta-ads-insights/ec.json')
        : '/opt/vitalismen-automacao/shared/runtime/meta-ads-insights/ec.json');
    try {
        const cache = JSON.parse(fs.readFileSync(file, 'utf8'));
        const lastSuccessAt = dateV145(cache.lastSuccessAt || cache.fetchedAt);
        const age = lastSuccessAt ? now - lastSuccessAt : Infinity;
        return { available: cache.status === 'available' && cache.fetchStatus !== 'failed',
            stale: age < 0 || age > Number(env.META_ADS_INSIGHTS_CACHE_SECONDS_EC || 300) * 1000,
            lastSuccessAt, dataThrough: cache.dataThrough || cache.endDay || null,
            lastError: cache.fetchStatus === 'failed' ? 'META_FETCH_FAILED' : null };
    } catch { return { available: false, stale: true, lastError: 'META_CACHE_UNAVAILABLE' }; }
};

// The provider documents GET /me as a configuration read. Never return URLs, tokens or instance IDs.
// https://developer.z-api.io/instance/me
export const readZapiProviderHealthV145 = async ({
    statusReader = getZapiStatus, configReader = zapiConfig, fetchImpl = fetch
} = {}) => {
    const cfg = configReader();
    if (!cfg.enabled) return { providerConnected: false, webhookConfigured: false, lastError: 'ZAPI_NOT_CONFIGURED' };
    try {
        const [status, response] = await Promise.all([
            statusReader(),
            fetchImpl(`${cfg.baseUrl}/instances/${cfg.instanceId}/token/${cfg.instanceToken}/me`, {
                method: 'GET', headers: { 'Client-Token': cfg.clientToken }, signal: AbortSignal.timeout(15000)
            })
        ]);
        if (!response.ok) return { providerConnected: Boolean(status.connected || status.smartphoneConnected),
            webhookConfigured: false, lastError: `ZAPI_CONFIGURATION_HTTP_${response.status}` };
        const instance = await response.json();
        const officialCallback = value => {
            try { const url = new URL(value); return url.origin === 'https://ec.maxlien.shop'
                && /^\/api\/zapi\/webhook(?:\/(?:received|delivery))?$/.test(url.pathname); }
            catch { return false; }
        };
        return {
            providerConnected: Boolean(status.connected || status.smartphoneConnected || /already connected/i.test(status.error || '')),
            webhookConfigured: officialCallback(instance.receivedCallbackUrl)
                && officialCallback(instance.deliveryCallbackUrl || instance.receivedAndDeliveryCallbackUrl || instance.messageStatusCallbackUrl),
            lastError: null
        };
    } catch { return { providerConnected: null, webhookConfigured: false, lastError: 'ZAPI_STATUS_READ_FAILED' }; }
};

export const readIntegrationHealthV145 = async ({
    OrderModel, ShipmentModel, MessageModel, now = new Date(),
    providerReader = readZapiProviderHealthV145, queueReader = getQueueSize,
    metaReader = readMetaHealthV145
} = {}) => {
    // Injected legacy fixtures without operational models cannot establish provider health.
    if (![OrderModel, ShipmentModel, MessageModel].every(model => typeof model?.findOne === 'function')) {
        return { available: false, checkedAt: now };
    }
    try {
        const lastMessage = (query, sort = { createdAt: -1 }) => MessageModel.findOne(query).sort(sort).select(timeProjection).lean();
        const [pendingOrders, lastSentOrders, lastOrder, inbound, outbound, ack, failure, botSuccess, botFailure, provider] = await Promise.all([
            OrderModel.find({ country: 'EC', status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
                'tracking.metaPurchaseSentAt': null }).select('_id orderId country status createdAt confirmedAt dropiOrderId tracking.metaPurchaseEventId tracking.metaPurchaseSentAt tracking.metaPurchaseResponse').lean(),
            OrderModel.find({ country: 'EC', 'tracking.metaPurchaseSentAt': { $ne: null } })
                .select('orderId tracking.metaPurchaseSentAt tracking.metaPurchaseResponse').lean(),
            OrderModel.findOne({ country: 'EC' }).sort({ createdAt: -1 }).select('createdAt').lean(),
            lastMessage({ provider: 'zapi', isFromMe: false }),
            lastMessage(successfulMessage),
            lastMessage({ provider: 'zapi', isFromMe: true, $or: [{ deliveredAt: { $ne: null } }, { readAt: { $ne: null } }] }, { updatedAt: -1 }),
            lastMessage(messageFailure),
            lastMessage({ ...successfulMessage, isBot: true }),
            lastMessage({ ...messageFailure, isBot: true }),
            providerReader()
        ]);
        const pendingIds = pendingOrders.map(order => order.orderId).filter(Boolean);
        const shipments = pendingIds.length ? await ShipmentModel.find({ country: 'EC', orderId: { $in: pendingIds } })
            .select('orderId automation.submittedToDroppiAt automation.dropiSubmitAuthorizedAt').lean() : [];
        const capi = summarizeCapiQueueV145({ orders: pendingOrders, shipments });
        const invalidSent = lastSentOrders.filter(order => !acceptedV145(order.tracking?.metaPurchaseResponse));
        capi.activeQueue += invalidSent.length;
        if (invalidSent.length) capi.lastError = 'SENT_MARKER_WITHOUT_META_ACCEPTANCE';
        capi.lastAcceptedPurchaseAt = latestV145(lastSentOrders.filter(order => acceptedV145(order.tracking?.metaPurchaseResponse))
            .map(order => order.tracking.metaPurchaseSentAt));
        const lastWebhookAt = latestV145([inbound?.createdAt, ack?.deliveredAt, ack?.readAt]);
        const failureAt = dateV145(failure?.createdAt);
        const outboundAt = dateV145(outbound?.createdAt);
        const recentFailure = Boolean(failureAt && now - failureAt < 15 * 60 * 1000
            && (!outboundAt || failureAt > outboundAt));
        const subscriptionBlocked = safeFailure(failure) === 'ZAPI_SUBSCRIPTION_INACTIVE'
            && (!outboundAt || failureAt > outboundAt);
        const botFailureAt = dateV145(botFailure?.createdAt);
        return { available: true, checkedAt: now, capi, meta: metaReader({ now }),
            orders: { lastSuccessAt: lastOrder?.createdAt || null },
            bot: { lastSuccessAt: botSuccess?.createdAt || null, lastError: safeFailure(botFailure),
                recentFailure: Boolean(botFailureAt && now - botFailureAt < 15 * 60 * 1000
                    && (!botSuccess || botFailureAt > dateV145(botSuccess.createdAt))) },
            zapi: { ...provider, queueDepth: queueReader(),
                webhookHealthy: provider.webhookConfigured === true && Boolean(lastWebhookAt),
                lastWebhookAt, lastInboundAt: inbound?.createdAt || null, lastOutboundAt: outboundAt,
                lastSuccessAt: latestV145([inbound?.createdAt, outboundAt, lastWebhookAt]),
                lastError: provider.lastError || safeFailure(failure), lastErrorAt: provider.lastError ? now : failureAt,
                recentOperationalError: Boolean(provider.lastError || recentFailure || subscriptionBlocked) }
        };
    } catch { return { available: false, checkedAt: now, meta: metaReader({ now }) }; }
};
