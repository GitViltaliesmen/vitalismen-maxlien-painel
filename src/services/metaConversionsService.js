import axios from 'axios';
import crypto from 'crypto';
import Order from '../models/Order.js';
import { enrichOrderWithMetaAttribution } from './metaAttributionService.js';
import { ecuadorProductMetadata, resolveEcuadorProductInfo } from './ecuadorProductService.js';

const normalize = (value) => String(value || '').trim().toLowerCase();

const sha256hex = (value) => {
    const v = normalize(value);
    if (!v) return null;
    return crypto.createHash('sha256').update(v).digest('hex');
};

const normalizePhoneE164 = ({ phone, country }) => {
    let digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;

    if (country === 'EC') {
        // If local starts with 0 (10 digits), drop 0
        if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
        if (!digits.startsWith('593')) digits = `593${digits}`;
        return `+${digits}`;
    }

    return `+${digits}`;
};

const splitName = (fullName) => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: null, lastName: null };
    if (parts.length === 1) return { firstName: parts[0], lastName: null };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const getConfigForCountry = (country) => {
    if (country === 'EC') {
        return {
            pixelId: process.env.META_PIXEL_ID_EC,
            accessToken: process.env.META_ACCESS_TOKEN_EC
        };
    }
    return { pixelId: null, accessToken: null };
};

const websiteUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw);
        if (!['http:', 'https:'].includes(parsed.protocol)) return '';
        const hostname = parsed.hostname.toLowerCase();
        const privateHost = hostname === 'localhost'
            || hostname === '127.0.0.1'
            || hostname === '::1'
            || hostname.endsWith('.local')
            || /^10\./.test(hostname)
            || /^192\.168\./.test(hostname)
            || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
        if (privateHost) return '';
        const path = parsed.pathname.toLowerCase();
        if (/^\/(api|admin)(\/|$)/.test(path)) return '';
        if (/^\/(qr|leads-window|funnel-metrics)(\.html)?(\/|$)/.test(path)) return '';
        parsed.hash = '';
        return parsed.toString();
    } catch {
        return '';
    }
};

export const resolvePurchaseEventSourceUrl = (order = {}) => websiteUrl(
    order?.tracking?.landingUrl || order?.tracking?.sourceUrl
);

export const getActionSourceForOrder = (order = {}) => {
    if (resolvePurchaseEventSourceUrl(order)) return 'website';
    const tracking = order.tracking || {};
    const hasWebAttribution = Boolean(
        tracking.fbc
        || tracking.fbp
        || tracking.fbclid
        || tracking.utm_source
        || tracking.utm_medium
        || tracking.utm_campaign
        || tracking.utm_content
        || tracking.utm_term
    );
    if (String(order.source || '').toLowerCase() === 'checkout' || hasWebAttribution) return 'website';
    if (['manual', 'whatsapp'].includes(String(order.source || '').toLowerCase())) return 'business_messaging';
    return 'website';
};

const VALID_META_PACKAGE_QUANTITIES = new Set([1, 2, 3, 6]);

const normalizeMetaPackageQuantity = (value) => {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return VALID_META_PACKAGE_QUANTITIES.has(parsed) ? parsed : 0;
};

export const getMetaConfigForCountry = getConfigForCountry;

export const hashMetaUserValue = sha256hex;

export const normalizeMetaPhoneE164 = normalizePhoneE164;

const cleanObject = (obj) => {
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value === undefined || value === null || value === '') delete obj[key];
        if (Array.isArray(value) && value.filter(Boolean).length === 0) delete obj[key];
    }
    return obj;
};

const toUnixSeconds = (value) => {
    if (!value) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value > 100000000000 ? Math.floor(value / 1000) : Math.floor(value);
    }
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    return Number.isFinite(time) ? Math.floor(time / 1000) : null;
};

export const resolvePurchaseEventDate = (order = {}) => {
    const values = [order.confirmedAt, order.entryAt, order.draftCreatedAt, order.createdAt];
    for (const value of values) {
        const date = value instanceof Date ? value : new Date(value || 0);
        if (Number.isFinite(date.getTime()) && date.getTime() > 0) return date;
    }
    return null;
};

export const metaEventsReceived = (response = null) => (
    Number(response?.events_received ?? response?.data?.events_received ?? 0) || 0
);

export const metaResponseAccepted = (response = null) => metaEventsReceived(response) > 0;

const TRACKABLE_BROWSER_SERVER_EVENTS = new Set(['PageView', 'ViewContent', 'InitiateCheckout', 'Lead']);

const splitFullName = (fullName) => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: '', lastName: '' };
    return {
        firstName: parts[0],
        lastName: parts.length > 1 ? parts.slice(1).join(' ') : ''
    };
};

export const buildBrowserServerEventPayload = (event = {}, req = null, options = {}) => {
    const eventName = String(event.eventName || event.event_name || '').trim();
    if (!TRACKABLE_BROWSER_SERVER_EVENTS.has(eventName)) {
        return { ok: false, error: 'META unsupported event_name' };
    }

    const country = String(event.country || 'EC').trim().toUpperCase();
    const eventId = String(event.eventId || event.event_id || '').trim();
    if (!eventId) {
        return { ok: false, error: 'META event missing event_id' };
    }

    const eventTime = toUnixSeconds(event.eventTime || event.event_time) || Math.floor(Date.now() / 1000);
    const sourceUrl = String(event.eventSourceUrl || event.event_source_url || '').trim();
    const userAgent = String(
        event.clientUserAgent
        || event.client_user_agent
        || req?.get?.('user-agent')
        || ''
    ).trim();
    const ipAddress = String(
        event.clientIpAddress
        || event.client_ip_address
        || req?.ip
        || req?.headers?.['x-forwarded-for']?.split(',')?.[0]
        || req?.socket?.remoteAddress
        || ''
    ).trim();
    const externalId = String(event.externalId || event.external_id || '').trim();
    const { firstName, lastName } = splitFullName(event.name || event.full_name);
    const email = String(event.email || event.em || '').trim();
    const phone = normalizePhoneE164({ phone: event.phone || event.ph, country });
    const city = String(event.city || event.ct || '').trim();
    const state = String(event.province || event.state || event.st || '').trim();
    const zip = String(event.zip || event.postal_code || event.zp || '').trim();

    const userData = {
        client_ip_address: ipAddress || undefined,
        client_user_agent: userAgent || undefined,
        fbp: String(event.fbp || '').trim() || undefined,
        fbc: String(event.fbc || '').trim() || undefined,
        em: email ? [sha256hex(email)] : undefined,
        ph: phone ? [sha256hex(phone)] : undefined,
        fn: firstName ? [sha256hex(firstName)] : undefined,
        ln: lastName ? [sha256hex(lastName)] : undefined,
        ct: city ? [sha256hex(city)] : undefined,
        st: state ? [sha256hex(state)] : undefined,
        zp: zip ? [sha256hex(zip)] : undefined,
        external_id: externalId ? [sha256hex(externalId)] : undefined,
        country: country ? [sha256hex(country)] : undefined
    };
    cleanObject(userData);

    if (!Object.keys(userData).length) {
        return { ok: false, eventId, error: 'META event missing user_data' };
    }

    const value = Number(event.value || 0);
    const currency = String(event.currency || 'USD').trim() || 'USD';
    const customData = cleanObject({
        currency: Number.isFinite(value) && value > 0 ? currency : undefined,
        value: Number.isFinite(value) && value > 0 ? value : undefined,
        content_name: String(event.contentName || event.content_name || 'Vit Power Ecuador').trim(),
        content_ids: event.contentIds || event.content_ids || ['vit_power_ec'],
        content_type: String(event.contentType || event.content_type || 'product').trim()
    });

    const payload = {
        data: [
            cleanObject({
                event_name: eventName,
                event_time: eventTime,
                event_id: eventId,
                action_source: 'website',
                event_source_url: sourceUrl || undefined,
                user_data: userData,
                custom_data: Object.keys(customData).length ? customData : undefined
            })
        ]
    };

    const testEventCode = String(options.testEventCode || process.env.META_TEST_EVENT_CODE_EC || process.env.META_TEST_EVENT_CODE || '').trim();
    if (testEventCode) payload.test_event_code = testEventCode;

    return { ok: true, payload, eventId, eventName, eventTime };
};

export const sendBrowserServerEvent = async (event = {}, req = null, options = {}) => {
    const country = String(event.country || 'EC').trim().toUpperCase();
    const { pixelId, accessToken } = getConfigForCountry(country);
    if (!pixelId || !accessToken) {
        return { ok: false, error: 'META pixel config missing for country' };
    }

    const built = buildBrowserServerEventPayload(event, req, options);
    if (!built.ok) return built;

    const { payload, eventId, eventName, eventTime } = built;
    if (options.dryRun) {
        return { ok: true, dryRun: true, payload, eventId, eventName, eventTime };
    }

    try {
        const apiVersion = process.env.META_CAPI_API_VERSION || 'v20.0';
        const url = `https://graph.facebook.com/${apiVersion}/${pixelId}/events`;
        const response = await axios.post(url, payload, {
            params: { access_token: accessToken },
            timeout: 15000
        });

        return { ok: true, response: response.data, eventId, eventName, eventTime };
    } catch (e) {
        return {
            ok: false,
            eventId,
            eventName,
            error: 'META CAPI request failed',
            status: e?.response?.status,
            data: e?.response?.data
        };
    }
};

export const sendBrowserMetaEvent = sendBrowserServerEvent;

export const buildPurchaseEventPayloadForOrder = (order, options = {}) => {
    const country = order?.country;
    const eventId = order?.orderId || order?._id?.toString();
    if (!eventId) {
        return { ok: false, error: 'META Purchase missing event_id' };
    }

    const value = Number(order?.total || 0);
    if (!Number.isFinite(value) || value <= 0) {
        return { ok: false, eventId, error: 'META Purchase missing positive value' };
    }

    const eventDate = options.eventTime || resolvePurchaseEventDate(order);
    const eventTime = toUnixSeconds(eventDate) || Math.floor(Date.now() / 1000);
    const actionSource = options.actionSource || getActionSourceForOrder(order);
    const eventSourceUrl = actionSource === 'website' ? resolvePurchaseEventSourceUrl(order) : '';
    if (actionSource === 'website' && !eventSourceUrl) {
        return { ok: false, eventId, eventTime, error: 'META Purchase website missing valid event_source_url' };
    }
    const messagingChannel = actionSource === 'business_messaging' ? 'whatsapp' : undefined;
    const quantity = normalizeMetaPackageQuantity(order?.package?.quantity ?? order?.package?.id);
    if (!quantity) {
        return { ok: false, eventId, error: 'META Purchase missing valid quantity' };
    }
    const currency = order?.currency || 'USD';
    const productMetadata = String(country || '').toUpperCase() === 'EC'
        ? ecuadorProductMetadata(resolveEcuadorProductInfo(order))
        : {
            productKey: 'vit_power_ec',
            productName: 'Vit Power Ecuador',
            contentName: 'Vit Power Ecuador',
            contentIds: ['vit_power_ec']
        };
    const contentIds = Array.isArray(productMetadata.contentIds) && productMetadata.contentIds.length
        ? productMetadata.contentIds
        : [productMetadata.productKey || 'vit_power_ec'];

    const { firstName, lastName } = splitName(order?.customer?.name);
    const phoneE164 = normalizePhoneE164({ phone: order?.customer?.phone, country });
    const hasOriginalWebContext = Boolean(eventSourceUrl && String(order?.source || '').toLowerCase() === 'checkout');
    const clientIp = order?.tracking?.clientIpOriginal || (hasOriginalWebContext ? order?.tracking?.ip : '');
    const clientUserAgent = order?.tracking?.clientUserAgentOriginal || (hasOriginalWebContext ? order?.tracking?.userAgent : '');

    const userData = {
        em: order?.customer?.email ? [sha256hex(order.customer.email)] : undefined,
        fn: firstName ? [sha256hex(firstName)] : undefined,
        ln: lastName ? [sha256hex(lastName)] : undefined,
        ph: phoneE164 ? [sha256hex(phoneE164)] : undefined,
        ct: order?.customer?.city ? [sha256hex(order.customer.city)] : undefined,
        st: order?.customer?.province ? [sha256hex(order.customer.province)] : undefined,
        zp: order?.customer?.zip ? [sha256hex(order.customer.zip)] : undefined,
        country: country ? [sha256hex(country)] : undefined,
        client_ip_address: clientIp || undefined,
        client_user_agent: clientUserAgent || undefined,
        fbc: order?.tracking?.fbc || undefined,
        fbp: order?.tracking?.fbp || undefined,
        external_id: order?.tracking?.ext_id ? [sha256hex(order.tracking.ext_id)] : undefined
    };

    cleanObject(userData);

    if (!Object.keys(userData).length) {
        return { ok: false, eventId, error: 'META Purchase missing user_data' };
    }

    const payload = {
        data: [
            cleanObject({
                event_name: 'Purchase',
                event_time: eventTime,
                event_id: eventId,
                action_source: actionSource,
                messaging_channel: messagingChannel,
                event_source_url: eventSourceUrl || undefined,
                user_data: userData,
                custom_data: {
                    currency,
                    value,
                    order_id: order?.orderId,
                    content_name: productMetadata.contentName || productMetadata.productName || 'Vit Power Ecuador',
                    content_ids: contentIds,
                    contents: [
                        {
                            id: contentIds[0],
                            quantity,
                            item_price: Number((value / quantity).toFixed(2))
                        }
                    ],
                    content_type: 'product'
                }
            })
        ]
    };

    const testEventCode = String(options.testEventCode || process.env.META_TEST_EVENT_CODE_EC || process.env.META_TEST_EVENT_CODE || '').trim();
    if (testEventCode) payload.test_event_code = testEventCode;

    return { ok: true, payload, eventId, eventTime, actionSource, eventSourceUrl };
};

const PURCHASE_LOCK_TIMEOUT_MS = 2 * 60 * 1000;

const sameOrderId = (order = {}) => order?._id || order?.id || null;

const purchaseState = (order = {}) => order?.tracking || {};

export const claimMetaPurchaseForOrder = async (order, {
    OrderModel = Order,
    now = new Date(),
    lockTimeoutMs = PURCHASE_LOCK_TIMEOUT_MS,
    eventId = order?.orderId || order?._id?.toString?.(),
    eventTime = resolvePurchaseEventDate(order)
} = {}) => {
    const orderDbId = sameOrderId(order);
    if (!orderDbId) return { ok: false, error: 'META Purchase requires persisted order' };
    if (purchaseState(order).metaPurchaseSentAt) {
        return { ok: true, claimed: false, alreadySent: true, order };
    }

    const claimAt = new Date(now);
    const expiredAt = new Date(claimAt.getTime() - Math.max(1000, Number(lockTimeoutMs) || PURCHASE_LOCK_TIMEOUT_MS));
    const claimed = await OrderModel.findOneAndUpdate(
        {
            _id: orderDbId,
            $and: [
                {
                    $or: [
                        { 'tracking.metaPurchaseSentAt': { $exists: false } },
                        { 'tracking.metaPurchaseSentAt': null }
                    ]
                },
                {
                    $or: [
                        { 'tracking.metaPurchaseInFlightAt': { $exists: false } },
                        { 'tracking.metaPurchaseInFlightAt': null },
                        { 'tracking.metaPurchaseInFlightAt': { $lt: expiredAt } }
                    ]
                }
            ]
        },
        {
            $set: {
                'tracking.metaPurchaseEventId': String(eventId || ''),
                'tracking.metaPurchaseEventTime': eventTime ? new Date(eventTime) : claimAt,
                'tracking.metaPurchaseInFlightAt': claimAt,
                'tracking.metaPurchaseLastAttemptAt': claimAt,
                'tracking.metaPurchaseLastError': ''
            },
            $inc: { 'tracking.metaPurchaseAttempts': 1 }
        },
        { new: true }
    );
    if (claimed) return { ok: true, claimed: true, claimAt, order: claimed };

    const current = await OrderModel.findById(orderDbId);
    if (purchaseState(current).metaPurchaseSentAt) {
        return { ok: true, claimed: false, alreadySent: true, order: current };
    }
    return { ok: false, claimed: false, skipped: true, reason: 'purchase_send_in_progress', order: current || order };
};

const finalizeMetaPurchase = async ({
    OrderModel = Order,
    order,
    claimAt,
    eventId,
    eventTime,
    response = null,
    error = ''
}) => {
    const accepted = metaResponseAccepted(response);
    const set = {
        'tracking.metaPurchaseEventId': String(eventId || ''),
        'tracking.metaPurchaseEventTime': new Date(Number(eventTime) * 1000),
        'tracking.metaPurchaseResponse': response || { ok: false, error },
        'tracking.metaPurchaseLastError': accepted ? '' : String(error || 'META Purchase response not accepted').slice(0, 1000)
    };
    if (accepted) set['tracking.metaPurchaseSentAt'] = new Date();

    const finalized = await OrderModel.findOneAndUpdate(
        { _id: sameOrderId(order), 'tracking.metaPurchaseInFlightAt': claimAt },
        { $set: set, $unset: { 'tracking.metaPurchaseInFlightAt': 1 } },
        { new: true }
    );
    // Preserve the existing Order post-save synchronization with the operational panel.
    if (finalized && typeof finalized.save === 'function') await finalized.save();
    return finalized;
};

export const sendPurchaseEventForOrder = async (order, options = {}) => {
    if (purchaseState(order).metaPurchaseSentAt) {
        return {
            ok: true,
            skipped: true,
            alreadySent: true,
            reason: 'already_sent',
            eventId: purchaseState(order).metaPurchaseEventId || order?.orderId || '',
            eventTime: toUnixSeconds(purchaseState(order).metaPurchaseEventTime || resolvePurchaseEventDate(order)),
            response: purchaseState(order).metaPurchaseResponse || null,
            order
        };
    }
    const country = order?.country;
    const { pixelId, accessToken } = getConfigForCountry(country);
    if (!pixelId || !accessToken) {
        return { ok: false, error: 'META pixel config missing for country' };
    }

    const attribution = await enrichOrderWithMetaAttribution(order).catch((error) => ({
        ok: false,
        error: error.message || 'attribution_enrichment_failed'
    }));
    const built = buildPurchaseEventPayloadForOrder(order, options);
    if (!built.ok) return built;
    const { payload, eventId, eventTime } = built;

    if (options.dryRun) {
        return { ok: true, dryRun: true, payload, eventId, eventTime, attribution };
    }

    if (attribution?.enriched && typeof order?.save === 'function') await order.save();
    const claim = await claimMetaPurchaseForOrder(order, {
        OrderModel: options.OrderModel || Order,
        now: options.now || new Date(),
        lockTimeoutMs: options.lockTimeoutMs,
        eventId,
        eventTime: new Date(eventTime * 1000)
    });
    if (!claim.claimed) {
        if (claim.alreadySent) {
            return {
                ok: true,
                skipped: true,
                alreadySent: true,
                reason: 'already_sent',
                eventId: purchaseState(claim.order).metaPurchaseEventId || eventId,
                eventTime: toUnixSeconds(purchaseState(claim.order).metaPurchaseEventTime) || eventTime,
                response: purchaseState(claim.order).metaPurchaseResponse || null,
                order: claim.order,
                attribution
            };
        }
        return { ...claim, eventId, eventTime, attribution };
    }

    const claimedBuilt = buildPurchaseEventPayloadForOrder(claim.order, options);
    if (!claimedBuilt.ok) {
        const finalized = await finalizeMetaPurchase({
            OrderModel: options.OrderModel || Order,
            order: claim.order,
            claimAt: claim.claimAt,
            eventId,
            eventTime,
            error: claimedBuilt.error
        });
        return { ...claimedBuilt, order: finalized || claim.order, attribution };
    }

    try {
        const apiVersion = process.env.META_CAPI_API_VERSION || 'v20.0';
        const url = `https://graph.facebook.com/${apiVersion}/${pixelId}/events`;
        const response = await (options.httpClient || axios).post(url, claimedBuilt.payload, {
            params: { access_token: accessToken },
            timeout: 15000
        });
        const accepted = metaResponseAccepted(response.data);
        const finalized = await finalizeMetaPurchase({
            OrderModel: options.OrderModel || Order,
            order: claim.order,
            claimAt: claim.claimAt,
            eventId,
            eventTime,
            response: response.data,
            error: accepted ? '' : 'META Purchase response did not confirm events_received'
        });
        return {
            ok: accepted,
            response: response.data,
            eventId,
            eventTime,
            order: finalized || claim.order,
            error: accepted ? undefined : 'META Purchase response did not confirm events_received',
            attribution
        };
    } catch (e) {
        const status = e?.response?.status;
        const data = e?.response?.data;
        const failureResponse = {
            ok: false,
            status,
            data,
            error: 'META CAPI request failed'
        };
        const finalized = await finalizeMetaPurchase({
            OrderModel: options.OrderModel || Order,
            order: claim.order,
            claimAt: claim.claimAt,
            eventId,
            eventTime,
            response: failureResponse,
            error: failureResponse.error
        });
        return {
            ok: false,
            eventId,
            error: 'META CAPI request failed',
            status,
            data,
            order: finalized || claim.order,
            attribution
        };
    }
};
