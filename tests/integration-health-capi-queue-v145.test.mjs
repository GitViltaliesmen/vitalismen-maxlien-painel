import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { applyIntegrationHealthV145, buildIntegrationHealthV145, classifyCapiOrderV145,
    summarizeCapiQueueV145, V144_ACTIVATED_AT } from '../src/services/funnelIntegrationHealthV145Service.js';
import { buildFunnelOperationalMetricsV141 } from '../src/services/funnelOperationalMetricsV141Service.js';
import { resolveFunnelMetricsRange } from '../src/services/funnelMetricsService.js';
import { readIntegrationHealthV145, readZapiProviderHealthV145 } from '../src/services/funnelIntegrationHealthV145ReadService.js';

const now = new Date('2026-09-08T15:00:00Z');
const healthy = () => ({ available: true, checkedAt: now,
    zapi: { providerConnected: true, webhookHealthy: true, queueDepth: 0,
        lastSuccessAt: '2026-09-07T20:44:12Z', lastWebhookAt: '2026-09-07T20:44:12Z' },
    meta: { available: true, stale: false, lastSuccessAt: now }, capi: { activeQueue: 0 }, bot: {}, orders: {} });
const historicalOrder = () => ({ _id: 'fixture-history', orderId: 'EC-ADMIN-FIXTURE', country: 'EC',
    createdAt: '2026-09-07T16:18:59Z', confirmedAt: '2026-09-07T16:18:59Z',
    status: 'processing', dropiOrderId: 'fixture-dropi', tracking: {} });
const historicalShipment = () => ({ orderId: 'EC-ADMIN-FIXTURE',
    automation: { submittedToDroppiAt: '2026-09-07T17:59:49Z' } });

test('ZAPI_NO_EVENTS_TODAY_PROVIDER_OK and FILTER_CHANGE_DOES_NOT_CHANGE_PROVIDER_HEALTH', () => {
    const evidence = healthy();
    evidence.capi = summarizeCapiQueueV145({ orders: [historicalOrder()], shipments: [historicalShipment()] });
    const checks = [];
    for (const range of [{ days: 1 }, { days: 3 }, { days: 7 }, { fromDay: '2026-09-06', toDay: '2026-09-08' }]) {
        const window = resolveFunnelMetricsRange({ ...range, now });
        const operational = buildFunnelOperationalMetricsV141({ ...window, computedAt: now, orders: [historicalOrder()] });
        const result = applyIntegrationHealthV145(operational, evidence);
        assert.equal(result.health.zapi.status, 'OK');
        assert.equal(result.health.zapi.dataStatus, 'NO_DATA_IN_WINDOW');
        assert.equal(result.health.capi.status, 'OK');
        assert.equal(result.health.capi.queueDepth, 0);
        assert.equal(result.health.capi.historicalBlockedCount, 1);
        assert.equal(result.health.capi.items[0].retryable, false);
        checks.push(result.health.zapi.lastSuccessAt);
    }
    assert.ok(checks.every(value => value.getTime() === checks[0].getTime()));
});

test('ZAPI_PROVIDER_DOWN and failed webhook evidence stay visible', () => {
    const evidence = healthy();
    evidence.zapi.providerConnected = false;
    assert.equal(buildIntegrationHealthV145(evidence).zapi.status, 'FAILED');
    evidence.zapi.providerConnected = true;
    evidence.zapi.webhookHealthy = false;
    assert.equal(buildIntegrationHealthV145(evidence).zapi.status, 'DEGRADED');
});

test('ZAPI_QUEUE_ERROR and recent operational error degrade independently of window', () => {
    const evidence = healthy();
    evidence.zapi.queueDepth = 51;
    assert.equal(buildIntegrationHealthV145(evidence).zapi.status, 'DEGRADED');
    evidence.zapi.queueDepth = 0;
    evidence.zapi.recentOperationalError = true;
    evidence.zapi.lastError = 'ZAPI_TIMEOUT';
    assert.equal(buildIntegrationHealthV145(evidence).zapi.status, 'DEGRADED');
    evidence.zapi.recentOperationalError = false;
    assert.equal(buildIntegrationHealthV145(evidence).zapi.status, 'OK');
    assert.equal(buildIntegrationHealthV145(evidence).zapi.lastError, 'ZAPI_TIMEOUT');
});

test('CAPI_HISTORICAL_BLOCKED_ONLY and HISTORICAL_RECORD_PRESERVED', () => {
    const order = historicalOrder(), shipment = historicalShipment();
    const before = JSON.stringify({ order, shipment });
    const capi = summarizeCapiQueueV145({ orders: [order], shipments: [shipment] });
    assert.equal(capi.activeQueue, 0);
    assert.equal(capi.historicalBlockedCount, 1);
    assert.equal(capi.items[0].classification, 'HISTORICAL_NOT_RETROACTIVE');
    assert.equal(capi.items[0].retryable, false);
    assert.equal(capi.items[0].retryAuthorized, false);
    assert.equal(capi.items[0].eventId, null);
    assert.equal(buildIntegrationHealthV145({ ...healthy(), capi }).capi.status, 'OK');
    assert.equal(JSON.stringify({ order, shipment }), before);
});

test('CAPI_ACTIVE_RETRYABLE_QUEUE stays DEGRADED for a new post-V144 submission', () => {
    const shipment = historicalShipment();
    shipment.automation.submittedToDroppiAt = V144_ACTIVATED_AT;
    const capi = summarizeCapiQueueV145({ orders: [historicalOrder()], shipments: [shipment] });
    assert.equal(capi.activeQueue, 1);
    assert.equal(capi.activeRetryableQueue, 1);
    assert.equal(capi.historicalBlockedCount, 0);
    assert.equal(capi.items[0].classification, 'NEW_POST_V144_PENDING');
    assert.equal(capi.items[0].retryAuthorized, false);
    assert.equal(buildIntegrationHealthV145({ ...healthy(), capi }).capi.status, 'DEGRADED');
});

test('missing submission evidence never silently classifies an old order as historical', () => {
    const item = classifyCapiOrderV145(historicalOrder(), {});
    assert.equal(item.active, true);
    assert.equal(item.classification, 'OTHER');
    assert.equal(item.blockReason, 'DROPI_SUBMISSION_TIME_UNVERIFIED');
    const order = historicalOrder(); delete order.dropiOrderId;
    assert.equal(classifyCapiOrderV145(order).blockReason, 'AWAITING_HUMAN_DROPI_SUBMISSION');
});

test('new V78, payload, network and Meta acceptance failures retain distinct diagnostics', () => {
    const shipment = { ...historicalShipment(), automation: { submittedToDroppiAt: now } };
    for (const [error, classification] of [['v78_blocked', 'V78_BLOCK'], ['invalid_payload', 'INVALID_PAYLOAD'],
        ['network timeout', 'NETWORK_ERROR'], ['meta_purchase_not_accepted', 'META_NOT_ACCEPTED']]) {
        const order = historicalOrder(); order.tracking.metaPurchaseResponse = { error };
        const item = classifyCapiOrderV145(order, shipment);
        assert.equal(item.classification, classification);
        assert.equal(item.active, true);
        assert.equal(item.historical, false);
    }
});

test('the latest real Dropi submission wins over an older duplicate Shipment', () => {
    const capi = summarizeCapiQueueV145({ orders: [historicalOrder()], shipments: [
        historicalShipment(), { ...historicalShipment(), automation: { submittedToDroppiAt: now } }
    ] });
    assert.equal(capi.activeQueue, 1);
    assert.equal(capi.historicalBlockedCount, 0);
});

test('CAPI_SENT <= CAPI_ELIGIBLE, META_ACCEPTED <= CAPI_SENT, META_ATTRIBUTED <= META_ACCEPTED', () => {
    const window = resolveFunnelMetricsRange({ days: 3, now });
    const operational = buildFunnelOperationalMetricsV141({ ...window, computedAt: now });
    for (const totals of [{ purchaseEligible: 0, purchaseSent: 1 }, { purchaseSent: 0, metaAccepted: 1 },
        { metaAccepted: 0, metaAttributed: 1 }]) {
        const result = applyIntegrationHealthV145({ ...operational, totals: { ...operational.totals, ...totals } }, healthy());
        assert.equal(result.integrity.status, 'FAIL');
        assert.equal(result.health.metrics.status, 'FAILED');
    }
});

test('provider probe uses GET only, validates official callbacks and redacts sensitive configuration', async () => {
    const requests = [];
    const result = await readZapiProviderHealthV145({
        configReader: () => ({ enabled: true, baseUrl: 'https://api.z-api.io', instanceId: 'fixture-id', instanceToken: 'fixture-token', clientToken: 'fixture-client' }),
        statusReader: async () => ({ connected: true }),
        fetchImpl: async (url, options) => { requests.push({ url, options }); return new Response(JSON.stringify({
            token: 'fixture-secret', receivedCallbackUrl: 'https://ec.maxlien.shop/api/zapi/webhook',
            deliveryCallbackUrl: 'https://ec.maxlien.shop/api/zapi/webhook'
        })); }
    });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].options.method, 'GET');
    assert.match(requests[0].url, /\/me$/);
    assert.deepEqual(result, { providerConnected: true, webhookConfigured: true, lastError: null });
    assert.doesNotMatch(JSON.stringify(result), /fixture-secret|fixture-token|fixture-client/);
});

test('operational loader reads global evidence without selected-window bounds or writes', async () => {
    const queries = [];
    const resultQuery = (query, result) => { queries.push(query); return { sort() { return this; }, select() { return this; }, lean: async () => result }; };
    const OrderModel = { find: query => resultQuery(query, query['tracking.metaPurchaseSentAt'] === null ? [historicalOrder()] : []),
        findOne: query => resultQuery(query, { createdAt: now }) };
    const ShipmentModel = { find: query => resultQuery(query, [historicalShipment()]), findOne() {} };
    const MessageModel = { findOne: query => resultQuery(query, query.isFromMe === false ? { createdAt: now } : null) };
    const result = await readIntegrationHealthV145({ OrderModel, ShipmentModel, MessageModel, now,
        providerReader: async () => ({ providerConnected: true, webhookConfigured: true }),
        queueReader: () => 0, metaReader: () => ({ available: true, stale: false }) });
    assert.equal(result.available, true);
    assert.equal(result.zapi.webhookHealthy, true);
    assert.equal(result.capi.activeQueue, 0);
    assert.equal(result.capi.historicalBlockedCount, 1);
    assert.doesNotMatch(JSON.stringify(queries), /\$gte|\$lt|selectedWindow/);
});

test('NO_REAL_CAPI_SEND: V145 read layer has no sender, database writes or side-effect imports', () => {
    for (const file of ['funnelIntegrationHealthV145Service.js', 'funnelIntegrationHealthV145ReadService.js']) {
        const source = fs.readFileSync(new URL(`../src/services/${file}`, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /sendPurchase|sendZapi|\.save\(|updateOne\(|updateMany\(|deleteOne\(|insertOne\(/);
        assert.doesNotMatch(source, /from ['"].*(?:metaConversions|routes\/shipments|scheduler)/);
    }
});

test('frontend displays global health, window emptiness, real queue, historical count and errors separately', () => {
    const source = fs.readFileSync(new URL('../public/funnel-metrics.html', import.meta.url), 'utf8');
    assert.match(source, /Sem eventos no período/);
    assert.match(source, /Último sucesso:/);
    assert.match(source, /Histórico bloqueado:/);
    assert.match(source, /Último erro:/);
    assert.doesNotMatch(source, /`Até \$\{formatDate\(value.dataThrough\)\}/);
});

test('official V97 preload registers V145-R2 before frozen V143 and V144 CLI guards execute', () => {
    const preload = new URL('../scripts/lib/ec-runtime-successor-v97-context.mjs', import.meta.url).href;
    for (const guard of ['guard-v141-v142-convergence-v143.mjs', 'guard-meta-purchase-after-manual-dropi-v144.mjs']) {
        const result = spawnSync(process.execPath, [`--import=${preload}`, `scripts/${guard}`], {
            env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8', timeout: 30000
        });
        assert.equal(result.status, 0, `${guard}: ${result.stderr}`);
        assert.match(result.stdout, /=PASS/);
    }
});

test('official V97 preload exposes the authenticated V145-R2 context', () => {
    const preload = new URL('../scripts/lib/ec-runtime-successor-v97-context.mjs', import.meta.url).href;
    const probe = "const c=globalThis.__VITALISMEN_V145_R2_CONTEXT;if(!c?.loaded||c.freezeId!=='EC_INTEGRATION_HEALTH_CAPI_QUEUE_V145_R2_20260908'||c.overrides.length!==6)process.exit(2);console.log('V145_CONTEXT_LOADED=YES');console.log('V145_OVERRIDES_REGISTERED=YES')";
    const result = spawnSync(process.execPath, [`--import=${preload}`, '-e', probe], {
        env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8', timeout: 30000
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /V145_CONTEXT_LOADED=YES/);
    assert.match(result.stdout, /V145_OVERRIDES_REGISTERED=YES/);
});

test('V138 suite passes under the exact official V97 preload', () => {
    const preload = new URL('../scripts/lib/ec-runtime-successor-v97-context.mjs', import.meta.url).href;
    const childEnv = { ...process.env, NODE_OPTIONS: '' };
    delete childEnv.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [`--import=${preload}`, '--test', 'tests/ec-dropi-human-authorization-v138.test.mjs'], {
        env: childEnv, encoding: 'utf8', timeout: 60000
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /# pass /);
    assert.match(result.stdout, /# fail 0/);
});
