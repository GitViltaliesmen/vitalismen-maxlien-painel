import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { assertEcDropiOrderReadyV138, ecDropiOrderReadinessV138, ecDropiCurrentDraftDeliveryV138, ecHumanDropiSubmitBlockV138, enrichEcDropiReadinessFlagsV138 } from '../src/services/ecDropiHumanAuthorizationV138Service.js';
import { ecBotCoreMutationRouteGuardV78, ecManualDropiHumanActionV138 } from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';
import { buildEcBotCoreV78OverlayEnvironment, EC_BOT_CORE_V78_DATASET_ID } from '../src/services/ecBotCoreOperationalV78Service.js';
import { enrichEcAdminDropiDraftFlagsV128 } from '../src/services/ecAdminDropiDraftBridgeV128Service.js';
import { submitDroppiEcuadorOrder } from '../src/services/droppiEcuadorBrowserService.js';
import * as products from '../src/services/ecuadorProductService.js';
import { ensurePurchaseAfterHumanDropiSuccessV141 } from '../src/routes/shipments.js';

const panel = fs.readFileSync('public/leads-window.html', 'utf8');
const routes = fs.readFileSync('src/routes/shipments.js', 'utf8');
const browser = fs.readFileSync('src/services/droppiEcuadorBrowserService.js', 'utf8');
const orderFixture = (productKey = 'tex_ultra_ec') => ({
    orderId: 'EC-ADMIN-90001', country: 'EC', status: 'confirmed',
    customer: { name: 'Cliente Prueba', phone: '593999999999', address: 'Calle Fixture 1', city: 'Quito', province: 'Pichincha' },
    delivery: { mode: 'home' }, customerDataResolution: { orderDataReady: true, blockedReasons: [] },
    package: { id: 1, quantity: 1 }, total: 35.99, tracking: { productKey }
});
const shipmentFixture = order => ({ _id: 'shipment-fixture', orderId: order.orderId,
    automation: { dropiSubmitAuthorizedAt: new Date(), dropiSubmitAuthorizedBy: 'fixture-operator' },
    review: {}, logistics: {}, raw: {}, events: [] });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const withHuman = async (orderId, action, callback, user = { _id: 'fixture-operator', role: 'admin', isActive: true }) => {
    const before = { ...process.env };
    Object.assign(process.env, buildEcBotCoreV78OverlayEnvironment({ baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID } }),
        { PANEL_AUTH_DISABLED: 'false', META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID });
    try {
        const req = { method: 'POST', originalUrl: '/api/shipments/droppi/ec/orders/' + orderId + '/' + action, user };
        const res = response();
        await ecBotCoreMutationRouteGuardV78(req, res, () => ecManualDropiHumanActionV138(req, res, () => callback(req, res)));
        return res;
    } finally {
        for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
        Object.assign(process.env, before);
    }
};

for (const productKey of ['tex_ultra_ec', 'nitrix_ec', 'vit_power_ec']) {
    test(productKey + ': A/B/F completo e confirmado sem operador faz zero chamadas e zero remessas', async () => {
        const order = orderFixture(productKey);
        assert.equal(ecDropiOrderReadinessV138(order).ready, true);
        for (const authorized of [false, true]) {
            const shipment = authorized ? shipmentFixture(order) : { automation: {} };
            // Uses the actual exported transport: absence of Mongo/provider mocks means any access would fail.
            const result = await submitDroppiEcuadorOrder({ order, shipment });
            assert.equal(result.reason, 'dropi_explicit_human_authorization_required');
            assert.equal(result.blocked, true);
            await Promise.resolve(); await new Promise(resolve => setImmediate(resolve));
            const afterBackground = await submitDroppiEcuadorOrder({ order, shipment });
            assert.equal(afterBackground.blocked, true);
        }
    });
}

test('autorizacao anterior, bot, scheduler e outro pedido nao substituem contexto humano atual', async () => {
    const order = orderFixture(), shipment = shipmentFixture(order);
    assert.equal(ecHumanDropiSubmitBlockV138({ order, shipment }).blocked, true);
    await withHuman(order.orderId, 'authorize-submit', () => assert.equal(ecHumanDropiSubmitBlockV138({ order, shipment }).blocked, true));
    await withHuman('EC-ADMIN-OTHER', 'submit', () => assert.equal(ecHumanDropiSubmitBlockV138({ order, shipment }).blocked, true));
    await withHuman(order.orderId, 'submit', () => {
        assert.equal(ecHumanDropiSubmitBlockV138({ order, shipment }), null);
        assert.equal(ecHumanDropiSubmitBlockV138({ order, shipment: { automation: {} } }).blocked, true);
    });
    for (const user of [null, { _id: 'local-no-password', role: 'admin' }, { _id: 'agent', role: 'agent' }]) {
        const result = await withHuman(order.orderId, 'submit', () => assert.fail('sem operador autenticado'), user);
        assert.equal(result.statusCode, 403);
    }
});

test('D: campos removidos depois de autorizar bloqueiam; zero nao usa package.id antigo', () => {
    for (const change of [
        o => { o.package.quantity = 0; }, o => { o.total = 0; }, o => { o.delivery.mode = ''; },
        o => { o.customer.address = ''; }, o => { o.customer.city = ''; }, o => { o.customer.province = ''; },
        o => { o.customer.phone = '5515998038637'; }, o => { o.customerDataResolution.orderDataReady = false; },
        o => { o.delivery = { mode: 'agency' }; }, o => { o.tracking = {}; }, o => { o.status = 'cancelled'; }
    ]) {
        const order = orderFixture(); change(order);
        assert.throws(() => assertEcDropiOrderReadyV138(order), error => error.status === 422 && error.code === 'dropi_order_not_ready');
    }
});

const humanTransportFixture = ({ changedAfterLock = false, missingAfterLock = false, databaseFailure = false } = {}) => {
    const order = orderFixture(), shipment = shipmentFixture(order), events = [], handlers = new Map();
    shipment.automation = {};
    shipment.save = async () => { events.push('authorization-persisted'); };
    const query = value => Object.assign(Promise.resolve(value), { lean: async () => value });
    const applySet = (target, values = {}) => {
        for (const [path, value] of Object.entries(values)) {
            const parts = path.split('.'); let node = target;
            for (const part of parts.slice(0, -1)) node = node[part] ||= {};
            node[parts.at(-1)] = value;
        }
    };
    const context = vm.createContext({
        console, ...products, process: { env: { DROPPI_EC_TEX_ULTRA_PRODUCT_ENABLED: 'true' } },
        ensurePurchaseAfterHumanDropiSuccessV141: options => ensurePurchaseAfterHumanDropiSuccessV141({
            ...options, purchaseSender: async () => ({ ok: true, eventId: 'fixture-purchase', response: { events_received: 1 } }),
            persistOrder: async () => {}, purchaseLock: () => {}
        }),
        ecDropiOrderReadinessV138, ecHumanDropiSubmitBlockV138, assertEcDropiOrderReadyV138,
        canaryV75BlockedResult: () => null,
        Message: { findOne: () => ({ sort: () => ({ lean: async () => null }) }) },
        dropiProductTargetForProduct: () => ({ name: 'Fixture', productUrl: 'fixture-only' }),
        dropiProductEnabled: () => true,
        Order: {
            findOne: () => {
                if (databaseFailure) return { lean: async () => { throw new Error('fixture database unavailable'); } };
                return query(missingAfterLock ? null : changedAfterLock ? { ...order, package: { id: 1, quantity: 0 } } : order);
            },
            updateOne: async (_filter, update) => { events.push('order:' + update.$set.status); applySet(order, update.$set); }
        },
        Shipment: {
            findOne: async () => shipment, findById: () => query(shipment),
            updateOne: async (_filter, update) => {
                if (update.$set?.['automation.submittedToDroppiAt']) events.push('provider-id-persisted');
                applySet(shipment, update.$set);
            }
        },
        lockShipmentForBrowserWorkEc: async () => true, releaseShipmentBrowserLockEc: async () => {},
        prepareDroppiEcuadorSubmission: async o => ({ payload: { productKey: o.tracking.productKey, phone: o.customer.phone } }),
        updateBrowserState: async () => {}, performLogin: async () => {}, persistStorageState: async () => {},
        withBrowserSession: async cb => cb({ context: {}, page: { waitForLoadState: async () => {} } }),
        discardPhoneAsTracking: value => value, tagDropiContactState: async args => {
            if (args.payload['metadata.customerDraft.status']) events.push('lead:' + args.payload['metadata.customerDraft.status']);
        },
        syncOrderToOnlineAdminPanel: () => ({ ok: true }),
        classifyDropiManualError: () => 'FIXTURE_DATABASE_UNAVAILABLE', sanitizeDropiBffStatusReason: () => '',
        describeDropiBffFailure: code => code, dropiErrorToken: code => code,
        ORDER_CREATION_WAIT_MS: 10000, DROPI_BFF_CREATE_ENDPOINT: 'fixture-only',
        createPageDiagnosticsCollector: () => () => [], createShippingQuoteCollector: () => () => ({}),
        buildEcuadorProductBffQuote: async () => { events.push('quote'); return { latestQuote: {}, chosenCarrier: 'SERVIENTREGA' }; },
        findExistingDropiOrderForManualSubmission: async () => { events.push('provider-lookup'); return null; },
        submitOrderViaDropiApi: async () => {
            events.push('POST'); assert.equal(order.status, 'confirmed');
            assert.equal(shipment.automation.submittedToDroppiAt, undefined);
            return { ok: true, status: 200, body: { isSuccess: true, objects: { id: 'fixture-created-id' } } };
        },
        waitForOrderCreationResult: async () => ({ ok: true }),
        findOrderViaOrdersApi: async () => ({ panelMatched: true }),
        router: { post(path, _auth, handler) { handlers.set(path.split('/').at(-1), handler); } }, adminOnly() {},
        findOrderForDropiRequest: async () => order, ensureShipmentForOrder: async () => shipment,
        looksLikeEcuadorOrder: () => true, hasValidEcuadorDropiCustomerName: () => true,
        getDropiDuplicateGuardForOrder: async () => ({ allowed: true }),
        isAuthorizedForDropiSubmit: value => Boolean(value.automation.dropiSubmitAuthorizedAt),
        activeDropiSubmitJobs: new Set(), dropiSubmitQueue: Promise.resolve(),
        markDropiSubmitQueued: async value => value, handleDropiSubmitResult: async ({ result }) => result,
        markManualSendRequired: () => assert.fail('unexpected manual fallback')
    });
    const safety = browser.slice(browser.indexOf('const cleanSubmitToken ='), browser.indexOf('export const submitDroppiEcuadorOrder'));
    const transport = browser.slice(browser.indexOf('export const submitDroppiEcuadorOrder'), browser.indexOf('export const prepareDroppiEcuadorOrderForManualSubmit')).replace('export const', 'const');
    const pipeline = browser.slice(browser.indexOf('const submitOrderInPanel ='), browser.indexOf('const findMatchingPanelText ='));
    const queue = routes.slice(routes.indexOf('const enqueueDropiSubmitJob ='), routes.indexOf('const getPendingDropiEcOrders ='));
    const authorize = routes.slice(routes.indexOf("router.post('/droppi/ec/orders/:orderId/authorize-submit'"), routes.indexOf("router.post('/droppi/ec/orders/:orderId/revoke-submit-authorization'"));
    const submit = routes.slice(routes.indexOf("router.post('/droppi/ec/orders/:orderId/submit'"), routes.indexOf("router.get('/droppi/ec/orders/:orderId/submit-status'"));
    vm.runInContext(safety + pipeline + transport
        + '\nconst alreadySubmittedResponse = (order, shipment) => alreadySubmittedDropiResult({order, shipment});\n'
        + queue + authorize + submit, context);
    return { order, shipment, events, async action(action) {
        return withHuman(order.orderId, action, async (req, res) => {
            req.params = { orderId: order.orderId }; req.body = {};
            await handlers.get(action)(req, res);
            await vm.runInContext('dropiSubmitQueue', context);
        });
    } };
};

test('C/E: autorizar, enviar pela fila real, confirmar ID e repetir produz um unico POST mock', async () => {
    const run = humanTransportFixture();
    assert.equal(ecDropiOrderReadinessV138(run.order).ready, true);
    const authorization = await run.action('authorize-submit');
    assert.equal(authorization.body.success, true);
    assert.deepEqual(run.events, ['authorization-persisted']);
    assert.ok(run.shipment.automation.dropiSubmitAuthorizedAt);
    const sent = await run.action('submit');
    assert.equal(sent.statusCode, 200);
    assert.deepEqual(run.events, ['authorization-persisted', 'quote', 'provider-lookup', 'POST',
        'provider-id-persisted', 'lead:pedido_enviado', 'order:processing']);
    assert.equal(run.order.dropiOrderId, 'fixture-created-id');
    const duplicate = await run.action('submit');
    assert.equal(duplicate.body.alreadySubmitted, true);
    assert.equal(run.events.filter(event => event === 'POST').length, 1);
});

test('D: releitura depois do lock impede envio com dados removidos, registro ausente ou erro de banco', async () => {
    for (const option of ['changedAfterLock', 'missingAfterLock', 'databaseFailure']) {
        const run = humanTransportFixture({ [option]: true });
        await run.action('authorize-submit');
        await run.action('submit');
        assert.equal(run.events.filter(event => event === 'POST').length, 0);
        assert.equal(run.order.status, 'confirmed');
        assert.equal(run.shipment.automation.submittedToDroppiAt, undefined);
    }
});
const submitHandler = sandbox => {
    let handler;
    const context = vm.createContext({ ...sandbox,
        ensurePurchaseAfterHumanDropiSuccessV141: options => ensurePurchaseAfterHumanDropiSuccessV141({
            ...options, purchaseSender: async () => assert.fail('historical fixture must not send Purchase'),
            persistOrder: async () => assert.fail('historical fixture must not write Order'), purchaseLock: () => assert.fail('historical fixture must not lock')
        }),
        router: { post(_path, _auth, callback) { handler = callback; } }, adminOnly() {} });
    vm.runInContext(routes.slice(routes.indexOf("router.post('/droppi/ec/orders/:orderId/submit'"),
        routes.indexOf("router.get('/droppi/ec/orders/:orderId/submit-status'")), context);
    return handler;
};

test('D/E: endpoint direto revalida antes de criar remessa/fila e repeticao nao chama transporte', async () => {
    for (const alreadySent of [false, true]) {
        const order = orderFixture(); order.package.quantity = 0;
        let shipmentCreates = 0, queued = 0;
        const handler = submitHandler({
            console: { error() {} }, findOrderForDropiRequest: async () => order,
            Shipment: { findOne: async () => null }, alreadySubmittedResponse: () => alreadySent ? { alreadySubmitted: true } : null,
            assertEcDropiOrderReadyV138, ensureShipmentForOrder: async () => { shipmentCreates++; return shipmentFixture(order); },
            looksLikeEcuadorOrder: () => true, hasValidEcuadorDropiCustomerName: () => true,
            getDropiDuplicateGuardForOrder: async () => ({ allowed: true }), isAuthorizedForDropiSubmit: () => true,
            enqueueDropiSubmitJob: async () => { queued++; return { ok: true }; }
        });
        const res = response(); await handler({ params: { orderId: order.orderId } }, res);
        assert.equal(res.statusCode, alreadySent ? 200 : 422);
        assert.equal(shipmentCreates, 0); assert.equal(queued, 0);
        if (alreadySent) assert.equal(res.body.alreadySubmitted, true);
    }
});

test('A/B: importador de confirmados nunca cria Shipment; espelho existente continua atualizavel', async () => {
    const source = fs.readFileSync('src/services/adminPanelImportService.js', 'utf8');
    const body = source.slice(source.indexOf('const ensureShipmentMirror ='), source.indexOf('export const importConfirmedAdminPanelOrders'));
    let creates = 0, saves = 0, existing = null;
    class Shipment { constructor() { creates++; } static async findOne() { return existing; } }
    const context = vm.createContext({ Shipment, isAgencyPickupAddress: () => false });
    vm.runInContext(body + '\nglobalThis.run = ensureShipmentMirror;', context);
    const order = orderFixture();
    await context.run({ orderData: order, lead: { id: 90001, status: 'confirmado' } });
    assert.equal(creates, 0); assert.equal(saves, 0);
    existing = { client: {}, logistics: { status: 'EN_RUTA' }, review: {}, automation: {}, events: [], async save() { saves++; } };
    await context.run({ orderData: order, lead: { id: 90001, status: 'confirmado' } });
    assert.equal(creates, 0); assert.equal(saves, 1); assert.equal(existing.logistics.status, 'EN_RUTA');
});

test('B/C: nenhum checkbox marcado desabilita e nao envia; somente selecao explicita envia', async () => {
    const lead = { id: '90001', orderId: 'EC-ADMIN-90001' };
    let sends = 0, confirmations = 0;
    const elements = new Map();
    const state = { selectedDropi: new Set(), leads: [lead], dropiBusy: new Set() };
    const context = vm.createContext({ state, hasAuthToken: () => true, leadSelectableForDropi: () => true,
        visibleLeads: () => [lead], leadOrderId: l => l.orderId, el: id => {
            if (!elements.has(id)) elements.set(id, {}); return elements.get(id);
        },
        window: { confirm: () => { confirmations++; return true; }, alert() {}, setTimeout: f => f() },
        sendLeadToDropiFromSelection: async () => { sends++; }, fetchLeads: async () => {}
    });
    const bar = panel.slice(panel.indexOf('const updateBulkDropiBar ='), panel.indexOf('const toggleVisibleDropiSelection ='));
    const send = panel.slice(panel.indexOf('const sendSelectedDropi ='), panel.indexOf('const setCountry =', panel.indexOf('const sendSelectedDropi =')));
    vm.runInContext(bar + send + '\nglobalThis.update=updateBulkDropiBar;globalThis.send=sendSelectedDropi;', context);
    context.update(); assert.equal(elements.get('bulkDropiSendBtn').disabled, true);
    await context.send(); assert.equal(sends, 0); assert.equal(confirmations, 0); assert.equal(state.selectedDropi.size, 0);
    state.selectedDropi.add('90001'); context.update();
    assert.equal(elements.get('bulkDropiSendBtn').disabled, false);
    await context.send(); assert.equal(sends, 1); assert.equal(confirmations, 1);
});

test('3501 em fixture: completar e salvar dados recalcula readiness sem envio nem alteracao de status', () => {
    const order = orderFixture();
    const lead = { id: 90001, country: 'EC', ...order.customer, status: 'confirmado', product_qty: 0, product_value: 0, notes: '' };
    const state = { phoneDigits: order.customer.phone, customerDataResolution: { orderDataReady: false }, metadata: {
        customerDraft: { ...order.customer, country: 'EC', status: 'confirmado', productKey: 'tex_ultra_ec', quantity: 0, total: 0, deliveryMode: '' }
    } };
    const project = () => {
        const rawFlags = { 90001: { status: 'confirmado', _draftBridgeLead: structuredClone(lead) } };
        return enrichEcDropiReadinessFlagsV138({ rawFlags, flags: enrichEcAdminDropiDraftFlagsV128(rawFlags, [state]), states: [state] })[90001];
    };
    assert.equal(project().dropiReadiness.ready, false);
    lead.product_qty = 1; lead.product_value = 35.99;
    Object.assign(state.metadata.customerDraft, { quantity: 1, total: 35.99, deliveryMode: 'home' });
    state.customerDataResolution.orderDataReady = true;
    const saved = JSON.parse(JSON.stringify(project()));
    assert.equal(saved.dropiReadiness.ready, true); assert.equal(saved.dropiReadiness.automaticallyAuthorized, false);
    assert.equal(lead.status, 'confirmado');
    assert.equal(saved._draftBridgeLead, undefined);
    const context = vm.createContext({ DROPI_READY_STATUSES: new Set(['confirmado']), statusValue: l => l.status,
        leadCountryCode: () => 'EC', isConfirmedBeforeJune2026: () => false, isRepurchaseLead: () => false, leadHasExplicitDropiSelection: () => true });
    vm.runInContext(panel.slice(panel.indexOf('const leadReadyForDropi ='), panel.indexOf('const leadSelectableForDropi')) + '\nglobalThis.ready=leadReadyForDropi;', context);
    const uiLead = { ...lead, quantity: lead.product_qty, value: lead.product_value, _ops: saved };
    assert.equal(Boolean(context.ready(uiLead)), true);
    state.metadata.customerDraft.deliveryMode = '';
    uiLead._ops = project(); assert.equal(Boolean(context.ready(uiLead)), false);
});

test('sync continua sem novo envio: parser de status e consulta do painel ficam preservados', () => {
    // Source hashes of the unchanged status readers in approved candidate 0efea9b.
    for (const [start, end, expected] of [
        ['export const syncActiveDroppiEcuadorOrdersFromPanel', 'const cleanSubmitToken', '01c2fba46127f3083b2120aa2cd76bc7ed027f9347816f8db6513ca2553fbd66'],
        ['export const syncDroppiEcuadorFromPanel', 'export const syncDroppiEcuadorInvoiceForShipment', '27873e9109594a00253ce8d8c03b5e5762bcb392ccb9e52c68e6572a090c22a3']
    ]) {
        const slice = source => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
        const body = slice(browser).replace(/\r\n/g, '\n');
        assert.ok(body.length > 2000);
        assert.equal(crypto.createHash('sha256').update(body).digest('hex'), expected);
    }
    const scheduler = fs.readFileSync('src/services/schedulerService.js', 'utf8');
    assert.doesNotMatch(scheduler, /submitDroppiEcuadorOrder|enqueueDropiSubmitJob/);
    assert.match(scheduler, /syncActiveDroppiEcuadorOrdersFromPanel/);
});
