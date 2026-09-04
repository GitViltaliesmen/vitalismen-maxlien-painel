import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { ecManualDropiReleaseV119RouteDecision, ecManualDropiReleaseV129RouteDecision, ecManualDropiReleaseV119MongoAllowed, ecManualDropiReleaseV119ExternalEffectAllowed } from '../src/services/ecManualDropiReleaseV119Service.js';
import { ecBotCoreMutationRouteGuardV78, currentEcBotCoreRuntimeContextV78 } from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';
import { buildEcBotCoreV78OverlayEnvironment, EC_BOT_CORE_V78_DATASET_ID } from '../src/services/ecBotCoreOperationalV78Service.js';
import * as products from '../src/services/ecuadorProductService.js';

const env = { VITALISMEN_EC_BOT_CORE_OPERATIONAL: 'true', PANEL_AUTH_DISABLED: 'false' };
const path = '/api/shipments/droppi/ec/admin-leads/10/configure-order';
const panel = fs.readFileSync('public/leads-window.html', 'utf8');
const routes = fs.readFileSync('src/routes/shipments.js', 'utf8');
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('configure-order atravessa o guard real; contexto nao permite efeito Dropi/Meta/WhatsApp', async () => {
    const before = { ...process.env };
    Object.assign(process.env, buildEcBotCoreV78OverlayEnvironment({ baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID } }), { ...env, META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID });
    try {
        let reached = false;
        await ecBotCoreMutationRouteGuardV78({ method: 'POST', originalUrl: path }, response(), () => {
            reached = true;
            const context = currentEcBotCoreRuntimeContextV78();
            assert.equal(context.manualDropiOperation, 'configure-order');
            assert.equal(ecManualDropiReleaseV119MongoAllowed({ method: 'POST', path, collection: 'orders', context, env }), true);
            for (const effect of ['dropi', 'meta', 'whatsapp']) assert.equal(ecManualDropiReleaseV119ExternalEffectAllowed({ effect, context, env }), false);
        });
        assert.equal(reached, true);
        assert.equal(ecManualDropiReleaseV119RouteDecision({ method: 'POST', path, env }).allowed, false);
        assert.equal(ecManualDropiReleaseV129RouteDecision({ method: 'POST', path, env }).allowed, true);
        for (const invalid of [path + '/submit', path.replace('/10/', '/bad/'), '/api/shipments/droppi/ec/dispatch/run']) {
            assert.equal(ecManualDropiReleaseV129RouteDecision({ method: 'POST', path: invalid, env }).allowed, false);
        }
        assert.equal(ecManualDropiReleaseV119RouteDecision({ method: 'DELETE', path, env }).allowed, false);
        assert.equal(ecManualDropiReleaseV119RouteDecision({ method: 'POST', path, env: { ...env, PANEL_AUTH_DISABLED: 'true' } }).allowed, false);
    } finally {
        for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
        Object.assign(process.env, before);
    }
});

for (const productKey of ['tex_ultra_ec', 'nitrix_ec', 'vit_power_ec']) {
    test(`${productKey}: handler existente salva escolha, refresh preserva e segundo save reutiliza pedido`, async () => {
        let handler;
        const store = new Map();
        const lead = { id: 10, phone: '593999999999', name: 'Fixture EC', status: 'confirmado', city: 'Quito', province: 'Pichincha', address: 'Destino de fixture', notes: '', product_qty: 1, product_value: 35.99 };
        const marker = ({ product, offer }) => `[DROPI_PRODUCT] key=${product.key}; name=${product.name}; priceCatalog=${offer.priceCatalog}; quantity=${offer.quantity}; total=${offer.total.toFixed(2)}`;
        class Order {
            constructor(data) { Object.assign(this, data); }
            static async findOne({ orderId }) { return store.get(orderId) || null; }
            async save() { store.set(this.orderId, this); }
        }
        const context = vm.createContext({
            ...products, console, Date, Order, adminOnly: () => {},
            router: { post(_path, _auth, callback) { handler = callback; } },
            getAdminLeadSnapshot: () => ({ ...lead }),
            Shipment: { findOne: async () => null },
            alreadySubmittedResponse: () => null,
            dropiProductSelectionMarker: marker,
            replaceDropiProductSelectionMarker: (_notes, value) => value,
            updateOnlineAdminLeadProductSelection: (offer) => {
                lead.notes = marker({ product: products.getEcuadorProductInfoByKey(offer.productKey), offer });
                lead.product_qty = offer.quantity; lead.product_value = offer.total;
                return { ok: true, notes: lead.notes };
            },
            createOperationalOrderFromAdminLead: async (orderId, snapshot) => new Order({ orderId, status: 'confirmed', customer: { phone: snapshot.phone }, tracking: { vslProductKey: 'tex_ultra_ec' }, notes: snapshot.notes }),
            dropiProductEnabled: () => true,
            buildDroppiEcuadorOrderPayload: ({ order }) => ({ productKey: order.tracking.productKey })
        });
        const start = routes.indexOf("router.post('/droppi/ec/admin-leads/:leadId/configure-order'");
        const end = routes.indexOf("router.post('/droppi/ec/orders/:orderId/submit'", start);
        vm.runInContext(routes.slice(start, end), context);
        for (let i = 0; i < 2; i++) {
            const res = response();
            await handler({ params: { leadId: '10' }, body: { productKey, priceCatalog: 'promotional', quantity: 1 }, user: { name: 'Fixture operator' } }, res);
            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.authorizationRequired, true);
            const reloaded = JSON.parse(JSON.stringify(store.get(res.body.orderId)));
            assert.equal(reloaded.tracking.productKey, productKey);
            assert.equal(reloaded.tracking.vslProductKey, 'tex_ultra_ec');
            assert.equal(reloaded.total, 35.99);
            assert.match(lead.notes, new RegExp(`key=${productKey};`));
            assert.equal(store.size, 1);
        }
    });
}

test('clique Salvar produto executa somente configure-order e refresh, sem authorize-submit/submit', async () => {
    const start = panel.indexOf("modal.addEventListener('click', async (event) => {");
    const end = panel.indexOf('document.body.appendChild(modal);', start);
    let listener;
    const calls = [];
    const lead = { id: 10, notes: '' };
    const save = { disabled: false };
    const context = vm.createContext({
        modal: { addEventListener(_type, callback) { listener = callback; } },
        closeDropiProductModal: () => {}, selection: { productKey: 'nitrix_ec', priceCatalog: 'normal', quantity: 3 },
        api: async (url) => { calls.push(url); return { orderId: 'EC-ADMIN-10', dropiEnabled: true, offer: { productKey: 'nitrix_ec', productName: 'Nitrix', priceCatalog: 'normal', quantity: 3, total: 95.99 } }; },
        adminLeadId: 10, id: '10', lead, leadOrderId: () => 'EC-ADMIN-10',
        state: { dropiMessages: new Map() }, render: () => {}, fetchLeads: async () => calls.push('refresh'),
        submitLeadToDropi: () => assert.fail('Salvar nao pode enviar nem autorizar'), encodeURIComponent
    });
    vm.runInContext(panel.slice(start, end), context);
    await listener({ target: { closest(selector) { return selector === '[data-dropi-product-save]' ? save : null; } } });
    assert.deepEqual(calls, ['/api/shipments/droppi/ec/admin-leads/10/configure-order', 'refresh']);
    assert.equal(lead._ops.productSelection.productKey, 'nitrix_ec');
});

test('elegibilidade visual exige produto explicito e independe do vinculo Meta', () => {
    const start = panel.indexOf('const leadReadyForDropi = (lead) => {');
    const end = panel.indexOf('const leadSelectableForDropi', start);
    const context = vm.createContext({ DROPI_READY_STATUSES: new Set(['confirmado']), statusValue: x => x.status, leadCountryCode: () => 'EC', isConfirmedBeforeJune2026: () => false, isRepurchaseLead: () => false, leadHasExplicitDropiSelection: x => Boolean(x.productKey) });
    vm.runInContext(panel.slice(start, end) + '\nglobalThis.ready = leadReadyForDropi;', context);
    const lead = { status: 'confirmado', name: 'Fixture EC', phone: '593999999999', address: 'Destino', city: 'Quito', province: 'Pichincha', quantity: 1, value: 35.99 };
    assert.equal(Boolean(context.ready(lead)), false);
    for (const productKey of ['tex_ultra_ec', 'nitrix_ec', 'vit_power_ec']) assert.equal(Boolean(context.ready({ ...lead, productKey })), true);
});
