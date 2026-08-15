import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildPurchaseEventPayloadForOrder,
    resolvePurchaseEventSourceUrl,
    sendPurchaseEventForOrder
} from '../src/services/metaConversionsService.js';
import {
    buildFbcFromFbclid,
    normalizeMetaTrackingInput
} from '../src/services/metaAttributionService.js';

const originalPixel = process.env.META_PIXEL_ID_EC;
const originalToken = process.env.META_ACCESS_TOKEN_EC;
process.env.META_PIXEL_ID_EC = 'pixel-test-ec';
process.env.META_ACCESS_TOKEN_EC = 'token-test-not-real';

test.after(() => {
    if (originalPixel === undefined) delete process.env.META_PIXEL_ID_EC;
    else process.env.META_PIXEL_ID_EC = originalPixel;
    if (originalToken === undefined) delete process.env.META_ACCESS_TOKEN_EC;
    else process.env.META_ACCESS_TOKEN_EC = originalToken;
});

const purchaseOrder = (overrides = {}) => ({
    _id: 'order-db-id-1',
    orderId: 'EC-PURCHASE-V2-1',
    country: 'EC',
    status: 'confirmed',
    confirmedAt: new Date('2026-08-14T16:05:48.013Z'),
    entryAt: new Date('2026-08-14T15:50:00.000Z'),
    total: 80.99,
    currency: 'USD',
    source: 'checkout',
    customer: {
        name: 'Cliente de Teste',
        phone: '+593999999999',
        email: 'CLIENTE@EXAMPLE.COM ',
        city: 'Quito',
        province: 'Pichincha',
        zip: '170101'
    },
    package: { id: 3, quantity: 3, label: 'Tex Ultra Ecuador 3 frascos' },
    tracking: {
        productKey: 'tex_ultra_ec',
        productName: 'Tex Ultra Ecuador',
        landingUrl: 'https://vilaliemen.shop/protocolo-g?utm_source=meta#video',
        sourceUrl: 'https://vilaliemen.shop/protocolo-g?utm_source=meta#video',
        originalReferrer: 'https://l.facebook.com/',
        clientIpOriginal: '203.0.113.50',
        clientUserAgentOriginal: 'Original customer browser',
        fbc: 'fb.1.1786720000000.real-click',
        fbp: 'fb.1.1786720000000.browser',
        ext_id: 'visitor-real',
        utm_campaign: 'campaign-123',
        utm_content: 'ad-456'
    },
    ...overrides
});

const setPath = (target, path, value) => {
    const keys = path.split('.');
    let cursor = target;
    for (const key of keys.slice(0, -1)) cursor = cursor[key] ||= {};
    cursor[keys.at(-1)] = value;
};

const unsetPath = (target, path) => {
    const keys = path.split('.');
    let cursor = target;
    for (const key of keys.slice(0, -1)) cursor = cursor?.[key];
    if (cursor) delete cursor[keys.at(-1)];
};

const fakeOrderModel = (initial) => {
    let stored = structuredClone(initial);
    const model = {
        async findOneAndUpdate(query, update) {
            if (update.$inc?.['tracking.metaPurchaseAttempts']) {
                if (stored.tracking?.metaPurchaseSentAt || stored.tracking?.metaPurchaseInFlightAt) return null;
            } else {
                const expected = new Date(query['tracking.metaPurchaseInFlightAt']).getTime();
                const actual = new Date(stored.tracking?.metaPurchaseInFlightAt || 0).getTime();
                if (expected !== actual) return null;
            }
            for (const [path, value] of Object.entries(update.$set || {})) setPath(stored, path, value);
            for (const [path, value] of Object.entries(update.$inc || {})) {
                const current = path.split('.').reduce((valueAtPath, key) => valueAtPath?.[key], stored) || 0;
                setPath(stored, path, current + value);
            }
            for (const path of Object.keys(update.$unset || {})) unsetPath(stored, path);
            return structuredClone(stored);
        },
        async findById() {
            return structuredClone(stored);
        },
        snapshot() {
            return structuredClone(stored);
        }
    };
    return model;
};

test('normaliza aliases de clique e preserva apenas IP/UA capturados do cliente', () => {
    const normalized = normalizeMetaTrackingInput({
        meta_fbclid: 'real-click',
        _fbc: 'fb.1.1786720000000.real-click',
        _fbp: 'fb.1.1786720000000.browser',
        landing_url: 'https://vilaliemen.shop/protocolo-g',
        original_referrer: 'https://l.facebook.com/',
        meta_campaign_id: 'campaign-123',
        meta_adset_id: 'adset-234',
        meta_ad_id: 'ad-456',
        client_ip_address: '198.51.100.200',
        client_user_agent: 'untrusted body UA'
    }, {
        captureOriginalClient: true,
        clientIp: '203.0.113.50',
        clientUserAgent: 'request customer UA'
    });

    assert.equal(normalized.fbclid, 'real-click');
    assert.equal(normalized.sourceUrl, 'https://vilaliemen.shop/protocolo-g');
    assert.equal(normalized.landingUrl, normalized.sourceUrl);
    assert.equal(normalized.metaCampaignId, 'campaign-123');
    assert.equal(normalized.metaAdsetId, 'adset-234');
    assert.equal(normalized.metaAdId, 'ad-456');
    assert.equal(normalized.clientIpOriginal, '203.0.113.50');
    assert.equal(normalized.clientUserAgentOriginal, 'request customer UA');
});

test('fbc derivado usa timestamp em milissegundos e nao inventa click id', () => {
    assert.equal(buildFbcFromFbclid('', new Date('2026-08-14T00:00:00Z')), '');
    const fbc = buildFbcFromFbclid('real-click', new Date('2026-08-14T00:00:00Z'));
    assert.match(fbc, /^fb\.1\.\d{13}\.real-click$/);
});

test('Purchase web usa origem real, horario confirmado e dados originais do cliente', () => {
    const built = buildPurchaseEventPayloadForOrder(purchaseOrder());
    assert.equal(built.ok, true);
    const event = built.payload.data[0];
    assert.equal(event.event_time, Math.floor(new Date('2026-08-14T16:05:48.013Z').getTime() / 1000));
    assert.equal(event.action_source, 'website');
    assert.equal(event.event_source_url, 'https://vilaliemen.shop/protocolo-g?utm_source=meta');
    assert.equal(event.user_data.client_ip_address, '203.0.113.50');
    assert.equal(event.user_data.client_user_agent, 'Original customer browser');
    assert.equal(event.user_data.fbc, 'fb.1.1786720000000.real-click');
    assert.equal(event.user_data.fbp, 'fb.1.1786720000000.browser');
    assert.equal(event.user_data.em[0].length, 64);
    assert.equal(event.user_data.zp[0].length, 64);
    assert.equal(event.custom_data.value, 80.99);
    assert.equal(event.custom_data.currency, 'USD');
});

test('Purchase manual sem prova web vira business_messaging e ignora IP/UA legado do admin', () => {
    const order = purchaseOrder({
        source: 'manual',
        tracking: {
            productKey: 'tex_ultra_ec',
            ip: '198.51.100.10',
            userAgent: 'Admin browser'
        }
    });
    const built = buildPurchaseEventPayloadForOrder(order);
    assert.equal(built.ok, true);
    const event = built.payload.data[0];
    assert.equal(event.action_source, 'business_messaging');
    assert.equal(event.messaging_channel, 'whatsapp');
    assert.equal('event_source_url' in event, false);
    assert.equal(event.user_data.client_ip_address, undefined);
    assert.equal(event.user_data.client_user_agent, undefined);
});

test('Purchase web sem URL real falha em vez de usar painel, localhost ou backend', () => {
    for (const sourceUrl of ['', 'http://localhost:3000/checkout', 'https://ec.maxlien.shop/api/orders']) {
        const order = purchaseOrder({
            tracking: {
                fbc: 'fb.1.1786720000000.real-click',
                fbp: 'fb.1.1786720000000.browser',
                sourceUrl,
                landingUrl: sourceUrl
            }
        });
        assert.equal(resolvePurchaseEventSourceUrl(order), '');
        const built = buildPurchaseEventPayloadForOrder(order);
        assert.equal(built.ok, false);
        assert.match(built.error, /event_source_url/);
    }
});

test('trava atomica permite uma chamada Graph e retries mantem o mesmo event_id', async () => {
    const order = purchaseOrder();
    const OrderModel = fakeOrderModel(order);
    let graphCalls = 0;
    const httpClient = {
        async post() {
            graphCalls += 1;
            await new Promise((resolve) => setTimeout(resolve, 20));
            return { data: { events_received: 1, fbtrace_id: 'trace-test' } };
        }
    };

    const results = await Promise.all(Array.from({ length: 6 }, () => (
        sendPurchaseEventForOrder(structuredClone(order), { OrderModel, httpClient })
    )));
    assert.equal(graphCalls, 1);
    assert.equal(results.filter((result) => result.ok && !result.alreadySent).length, 1);
    assert.equal(OrderModel.snapshot().tracking.metaPurchaseAttempts, 1);
    assert.equal(OrderModel.snapshot().tracking.metaPurchaseEventId, order.orderId);
    assert.ok(OrderModel.snapshot().tracking.metaPurchaseSentAt);

    const retry = await sendPurchaseEventForOrder(structuredClone(OrderModel.snapshot()), { OrderModel, httpClient });
    assert.equal(retry.ok, true);
    assert.equal(retry.alreadySent, true);
    assert.equal(retry.eventId, order.orderId);
    assert.equal(graphCalls, 1);
});

test('resposta sem events_received libera retry sem criar novo event_id', async () => {
    const order = purchaseOrder({ _id: 'order-db-id-2', orderId: 'EC-PURCHASE-V2-RETRY' });
    const OrderModel = fakeOrderModel(order);
    let graphCalls = 0;
    const httpClient = {
        async post() {
            graphCalls += 1;
            return { data: graphCalls === 1 ? { events_received: 0 } : { events_received: 1 } };
        }
    };

    const first = await sendPurchaseEventForOrder(structuredClone(order), { OrderModel, httpClient });
    assert.equal(first.ok, false);
    assert.equal(OrderModel.snapshot().tracking.metaPurchaseSentAt, undefined);
    assert.equal(OrderModel.snapshot().tracking.metaPurchaseInFlightAt, undefined);

    const second = await sendPurchaseEventForOrder(structuredClone(OrderModel.snapshot()), { OrderModel, httpClient });
    assert.equal(second.ok, true);
    assert.equal(graphCalls, 2);
    assert.equal(OrderModel.snapshot().tracking.metaPurchaseAttempts, 2);
    assert.equal(OrderModel.snapshot().tracking.metaPurchaseEventId, order.orderId);
});
