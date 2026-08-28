import axios from 'axios';
import crypto from 'crypto';
import { enrichOrderWithMetaAttribution } from './metaAttributionService.js';
import { ecuadorProductMetadata, resolveEcuadorProductInfo } from './ecuadorProductService.js';
import {
    isEcuadorTexUltraProtocoloG,
    META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
    PROTOCOLO_G_EVENT_SOURCE_URL
} from './metaProtocoloGAttributionService.js';
import {
    META_DESTINATION_ROUTES,
    publicMetaDestinationDescriptor,
    resolveMetaDestination,
    resolveMetaDestinationProfile
} from './metaDestinationRegistryService.js';

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

const getConfigForCountry = (country, env = process.env) => {
    if (country === 'EC') {
        return resolveMetaDestination({
            route: META_DESTINATION_ROUTES.EC_DEFAULT,
            env,
            legacyConfig: {
                pixelId: env.META_PIXEL_ID_EC,
                browserPixelId: env.META_PIXEL_ID_EC,
                accessToken: env.META_ACCESS_TOKEN_EC,
                tokenSource: 'env:META_ACCESS_TOKEN_EC'
            }
        });
    }
    return { pixelId: null, accessToken: null, route: 'unsupported_country' };
};

export const getMetaConfigForOrder = (order = {}, env = process.env) => {
    if (isEcuadorTexUltraProtocoloG(order)) {
        const configuredDatasetId = String(env.META_PIXEL_ID_EC_TEX_ULTRA_PROTOCOLO_G || '').trim();
        if (configuredDatasetId && configuredDatasetId !== META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID) {
            return {
                pixelId: null,
                accessToken: null,
                route: 'ec_tex_ultra_protocolo_g_invalid_dataset_config'
            };
        }
        return resolveMetaDestination({
            route: META_DESTINATION_ROUTES.EC_TEX_ULTRA_PROTOCOLO_G,
            env,
            legacyConfig: {
                pixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
                browserPixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
                accessToken: env.META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G || env.META_ACCESS_TOKEN_EC,
                tokenSource: env.META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G
                    ? 'env:META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G'
                    : 'env:META_ACCESS_TOKEN_EC'
            }
        });
    }
    return getConfigForCountry(String(order?.country || '').trim().toUpperCase(), env);
};

export const getMetaDatasetIdForOrder = (order = {}, env = process.env) => (
    getMetaConfigForOrder(order, env).pixelId || ''
);

const getActionSourceForOrder = (order) => (
    (order?.tracking?.sourceUrl || order?.tracking?.fbc || order?.tracking?.fbp || order?.tracking?.fbclid)
        ? 'website'
        : (order?.source === 'whatsapp' ? 'business_messaging' : 'website')
);

const VALID_META_PACKAGE_QUANTITIES = new Set([1, 2, 3, 6]);

const normalizeMetaPackageQuantity = (value) => {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return VALID_META_PACKAGE_QUANTITIES.has(parsed) ? parsed : 0;
};

export const getMetaConfigForCountry = getConfigForCountry;

const legacyMetaConfigForRoute = (route, env) => {
    if (route === META_DESTINATION_ROUTES.EC_TEX_ULTRA_PROTOCOLO_G) {
        return {
            pixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
            browserPixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
            accessToken: env.META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G || env.META_ACCESS_TOKEN_EC,
            tokenSource: env.META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G
                ? 'env:META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G'
                : 'env:META_ACCESS_TOKEN_EC'
        };
    }
    return {
        pixelId: env.META_PIXEL_ID_EC,
        browserPixelId: env.META_PIXEL_ID_EC,
        accessToken: env.META_ACCESS_TOKEN_EC,
        tokenSource: 'env:META_ACCESS_TOKEN_EC'
    };
};

const META_DESTINATION_BINDING_VERSION = 1;
const META_DESTINATION_BINDING_TTL_MS = 6 * 60 * 60 * 1000;
const bindingPayload = ({ route, profile, datasetId, expiresAt }) => [
    META_DESTINATION_BINDING_VERSION,
    String(route || ''),
    String(profile || ''),
    String(datasetId || ''),
    String(expiresAt || '')
].join('|');
const bindingSignature = (payload, accessToken) => crypto
    .createHmac('sha256', crypto.createHash('sha256').update(`meta-destination-v73:${accessToken}`).digest())
    .update(payload)
    .digest('base64url');

const activeDestinationForRoute = (route, env) => {
    if (route === META_DESTINATION_ROUTES.EC_TEX_ULTRA_PROTOCOLO_G) {
        return resolveMetaDestination({
            route,
            env,
            legacyConfig: legacyMetaConfigForRoute(route, env)
        });
    }
    return getConfigForCountry('EC', env);
};

export const getPublicMetaDestinationForRoute = (route, env = process.env, { now = Date.now() } = {}) => {
    const destination = activeDestinationForRoute(route, env);
    const descriptor = publicMetaDestinationDescriptor(destination);
    if (!descriptor.available) return descriptor;
    const expiresAt = new Date(Number(now) + META_DESTINATION_BINDING_TTL_MS).toISOString();
    const payload = bindingPayload({
        route: descriptor.route,
        profile: descriptor.profile,
        datasetId: descriptor.datasetId,
        expiresAt
    });
    return Object.freeze({
        ...descriptor,
        bindingVersion: META_DESTINATION_BINDING_VERSION,
        bindingExpiresAt: expiresAt,
        binding: bindingSignature(payload, destination.accessToken)
    });
};

const blockedBindingConfig = (route, errorCode = 'META_DESTINATION_BINDING_INVALID') => ({
    pixelId: null,
    accessToken: null,
    route: `${route}_binding_blocked`,
    errorCode
});

const configForBrowserEvent = ({ route, event, req, env, now = Date.now() }) => {
    const rawBinding = event?.meta_destination || event?.metaDestination || req?.body?.meta_destination || req?.body?.metaDestination;
    if (rawBinding === undefined || rawBinding === null) {
        return activeDestinationForRoute(route, env);
    }
    if (typeof rawBinding !== 'object' || Array.isArray(rawBinding)) return blockedBindingConfig(route);
    const profile = String(rawBinding.profile || '').trim();
    const datasetId = String(rawBinding.datasetId || '').trim();
    const requestedRoute = String(rawBinding.route || '').trim();
    const expiresAt = String(rawBinding.bindingExpiresAt || '').trim();
    const signature = String(rawBinding.binding || '').trim();
    const expiresAtMs = Date.parse(expiresAt);
    if (
        Number(rawBinding.bindingVersion) !== META_DESTINATION_BINDING_VERSION
        || requestedRoute !== route
        || !profile
        || !/^\d{8,25}$/.test(datasetId)
        || !Number.isFinite(expiresAtMs)
        || expiresAtMs <= Number(now)
        || !/^[A-Za-z0-9_-]{40,64}$/.test(signature)
    ) return blockedBindingConfig(route);

    const destination = resolveMetaDestinationProfile({
        route,
        profile,
        env,
        legacyConfig: legacyMetaConfigForRoute(route, env)
    });
    if (!destination.pixelId || !destination.accessToken || destination.pixelId !== datasetId) {
        return blockedBindingConfig(route, destination.errorCode || 'META_DESTINATION_BINDING_PROFILE_INVALID');
    }
    const expected = bindingSignature(bindingPayload({ route, profile, datasetId, expiresAt }), destination.accessToken);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
        return blockedBindingConfig(route);
    }
    return destination;
};

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

    const protocoloGEvent = isEcuadorTexUltraProtocoloG(event);
    const implicitTestEventCode = process.env.META_TEST_EVENT_CODE_EC || process.env.META_TEST_EVENT_CODE || '';
    const testEventCode = protocoloGEvent
        ? ''
        : String(options.testEventCode || implicitTestEventCode).trim();
    if (testEventCode) payload.test_event_code = testEventCode;

    return { ok: true, payload, eventId, eventName, eventTime };
};

export const sendBrowserServerEvent = async (event = {}, req = null, options = {}) => {
    const country = String(event.country || 'EC').trim().toUpperCase();
    const env = options.env || process.env;
    const expectedRoute = isEcuadorTexUltraProtocoloG(event)
        ? META_DESTINATION_ROUTES.EC_TEX_ULTRA_PROTOCOLO_G
        : (country === 'EC' ? META_DESTINATION_ROUTES.EC_DEFAULT : 'unsupported_country');
    const { pixelId, accessToken, route } = expectedRoute === 'unsupported_country'
        ? getConfigForCountry(country, env)
        : configForBrowserEvent({ route: expectedRoute, event, req, env, now: options.now });
    if (!pixelId || !accessToken) {
        return { ok: false, error: 'META pixel config missing for country' };
    }

    const built = buildBrowserServerEventPayload(event, req, options);
    if (!built.ok) return built;

    const { payload, eventId, eventName, eventTime } = built;
    if (options.dryRun) {
        return { ok: true, dryRun: true, payload, eventId, eventName, eventTime, datasetId: pixelId, datasetRoute: route };
    }

    try {
        const apiVersion = process.env.META_CAPI_API_VERSION || 'v20.0';
        const url = `https://graph.facebook.com/${apiVersion}/${pixelId}/events`;
        const response = await axios.post(url, payload, {
            params: { access_token: accessToken },
            timeout: 15000
        });

        return { ok: true, response: response.data, eventId, eventName, eventTime, datasetId: pixelId, datasetRoute: route };
    } catch (e) {
        return {
            ok: false,
            eventId,
            eventName,
            datasetId: pixelId,
            datasetRoute: route,
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

    const eventTime = toUnixSeconds(options.eventTime) || Math.floor(Date.now() / 1000);
    const actionSource = options.actionSource || getActionSourceForOrder(order);
    const messagingChannel = actionSource === 'business_messaging' ? 'whatsapp' : undefined;
    const quantity = normalizeMetaPackageQuantity(order?.package?.quantity ?? order?.package?.id);
    if (!quantity) {
        return { ok: false, eventId, error: 'META Purchase missing valid quantity' };
    }
    const currency = order?.currency || 'USD';
    const isEcuador = String(country || '').toUpperCase() === 'EC';
    const productMetadata = isEcuador
        ? ecuadorProductMetadata(resolveEcuadorProductInfo(order))
        : {
            productKey: 'vit_power_ec',
            productName: 'Vit Power Ecuador',
            contentName: 'Vit Power Ecuador',
            contentIds: ['vit_power_ec']
        };
    if (isEcuador && !productMetadata.productKey) {
        return { ok: false, eventId, error: 'META Purchase missing explicit EC product' };
    }
    const contentIds = Array.isArray(productMetadata.contentIds) && productMetadata.contentIds.length
        ? productMetadata.contentIds
        : [productMetadata.productKey || 'vit_power_ec'];

    const { firstName, lastName } = splitName(order?.customer?.name);
    const phoneE164 = normalizePhoneE164({ phone: order?.customer?.phone, country });

    const protocoloGOrder = isEcuadorTexUltraProtocoloG(order);
    const clientContextSource = String(order?.tracking?.clientContextSource || '').trim();
    const trustedProtocoloGUserAgent = clientContextSource === 'vilaliemen_protocolo_g_server_bridge';
    const trustedProtocoloGClientIp = clientContextSource === 'client_browser_direct';
    const userData = {
        fn: firstName ? [sha256hex(firstName)] : undefined,
        ln: lastName ? [sha256hex(lastName)] : undefined,
        ph: phoneE164 ? [sha256hex(phoneE164)] : undefined,
        ct: order?.customer?.city ? [sha256hex(order.customer.city)] : undefined,
        st: order?.customer?.province ? [sha256hex(order.customer.province)] : undefined,
        country: country ? [sha256hex(country)] : undefined,
        client_ip_address: protocoloGOrder
            ? (trustedProtocoloGClientIp ? order?.tracking?.ip || undefined : undefined)
            : order?.tracking?.ip || undefined,
        client_user_agent: protocoloGOrder
            ? (trustedProtocoloGUserAgent || trustedProtocoloGClientIp ? order?.tracking?.userAgent || undefined : undefined)
            : order?.tracking?.userAgent || undefined,
        fbc: order?.tracking?.fbc || undefined,
        fbp: order?.tracking?.fbp || undefined,
        external_id: (order?.tracking?.external_id || order?.tracking?.ext_id)
            ? [sha256hex(order.tracking.external_id || order.tracking.ext_id)]
            : undefined
    };

    cleanObject(userData);

    if (!Object.keys(userData).length) {
        return { ok: false, eventId, error: 'META Purchase missing user_data' };
    }

    const payload = {
        data: [
            {
                event_name: 'Purchase',
                event_time: eventTime,
                event_id: eventId,
                action_source: actionSource,
                messaging_channel: messagingChannel,
                event_source_url: actionSource === 'website'
                    ? (protocoloGOrder ? PROTOCOLO_G_EVENT_SOURCE_URL : order?.tracking?.sourceUrl || undefined)
                    : undefined,
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
            }
        ]
    };

    const implicitTestEventCode = process.env.META_TEST_EVENT_CODE_EC || process.env.META_TEST_EVENT_CODE || '';
    const testEventCode = protocoloGOrder
        ? ''
        : String(options.testEventCode || implicitTestEventCode).trim();
    if (testEventCode) payload.test_event_code = testEventCode;

    return { ok: true, payload, eventId, eventTime };
};

export const sendPurchaseEventForOrder = async (order, options = {}) => {
    const attributionEnricher = options.attributionEnricher || enrichOrderWithMetaAttribution;
    const attribution = await attributionEnricher(order, options.attributionOptions || {}).catch((error) => ({
        ok: false,
        error: error.message || 'attribution_enrichment_failed'
    }));
    const { pixelId, accessToken, route } = getMetaConfigForOrder(order, options.env || process.env);
    order.tracking = order.tracking || {};
    if (pixelId) order.tracking.metaPurchaseDatasetId = pixelId;
    if (route) order.tracking.metaPurchaseDatasetRoute = route;
    if (!pixelId || !accessToken) {
        return {
            ok: false,
            error: 'META pixel config missing for country',
            attribution,
            datasetId: pixelId || '',
            datasetRoute: route
        };
    }
    const built = buildPurchaseEventPayloadForOrder(order, options);
    if (!built.ok) return built;
    const { payload, eventId, eventTime } = built;

    if (options.dryRun) {
        return {
            ok: true,
            dryRun: true,
            payload,
            eventId,
            eventTime,
            attribution,
            datasetId: pixelId,
            datasetRoute: route
        };
    }

    try {
        const apiVersion = process.env.META_CAPI_API_VERSION || 'v20.0';
        const url = `https://graph.facebook.com/${apiVersion}/${pixelId}/events`;
        const response = await axios.post(url, payload, {
            params: { access_token: accessToken },
            timeout: 15000
        });

        return {
            ok: true,
            response: response.data,
            eventId,
            eventTime,
            attribution,
            datasetId: pixelId,
            datasetRoute: route
        };
    } catch (e) {
        const status = e?.response?.status;
        const data = e?.response?.data;
        return {
            ok: false,
            eventId,
            datasetId: pixelId,
            datasetRoute: route,
            error: 'META CAPI request failed',
            status,
            data
        };
    }
};
