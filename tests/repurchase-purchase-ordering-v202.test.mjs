import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import { ensurePurchaseAfterHumanDropiSuccessV141 } from '../src/routes/shipments.js';

const route = fs.readFileSync(new URL('../src/routes/shipments.js', import.meta.url), 'utf8');
const stageStart = route.indexOf('const stageConfirmedAdminLeadOrder = async');
const stageEnd = route.indexOf('const appendAuditNote =', stageStart);
assert.ok(stageStart >= 0 && stageEnd > stageStart, 'stage-confirmed function not found');
const stageSource = route.slice(stageStart, stageEnd);

const stageFixture = ({ repurchase = true } = {}) => {
    const oldOrder = { orderId: 'EC-ADMIN-OLD-FIXTURE', status: 'delivered', total: 35.99 };
    const saved = [];
    const queue = [];
    let purchaseCalls = 0;
    class FixtureOrder {
        constructor({ orderId }) { this.orderId = orderId; this.tracking = {}; }
        async save() { saved.push(this); }
    }
    FixtureOrder.findOne = () => ({ sort: async () => null });
    const currentOrder = new FixtureOrder({ orderId: 'EC-ADMIN-CURRENT-FIXTURE' });
    currentOrder.status = 'draft';
    const context = {
        crypto: { randomBytes: () => Buffer.from('12345678', 'hex') },
        getAdminLeadSnapshot: () => ({ country: 'EC', status: repurchase ? 'recompra' : 'novo' }),
        findContactStateForAdminLead: async () => null,
        deliveredOrderForAdminLead: async () => repurchase ? { order: oldOrder, shipment: null } : { order: null, shipment: null },
        findCurrentOrderForAdminLead: async () => currentOrder,
        createOperationalOrderFromAdminLead: async () => currentOrder,
        stagedOrderDataFromAdminLead: () => ({
            customer: { phone: '+593999999999', name: 'Fixture QA' },
            delivery: { city: 'Quito', province: 'Pichincha' },
            customerDataResolution: {}, quantity: 2, total: 70,
            productInfo: { key: 'tex_ultra_ec', name: 'Tex Ultra' },
            tracking: { productKey: 'tex_ultra_ec' }, draft: {}
        }),
        activeRepurchaseStatuses: ['draft', 'pending', 'confirmed'],
        deliveredRepurchaseRegistrationDecision: () => ({
            allowed: true, reused: false, orderId: 'EC-RECOMPRA-NEW-FIXTURE',
            entryReason: 'repeat_purchase_after_delivered',
            previousOrderId: oldOrder.orderId, previousDeliveredAt: new Date('2026-09-01T00:00:00Z')
        }),
        Order: FixtureOrder,
        ecuadorPackageLabel: () => '2 frascos',
        appendAuditNote: (_old, note) => note,
        persistConfirmedOrderToOnlineAdminPanelV158: (order) => {
            queue.push(order.orderId);
            return { ok: true, persistenceVerified: true, visibleInConfirmedQuery: true };
        },
        ensurePurchaseForStagedOrder: async () => { purchaseCalls += 1; throw new Error('early_purchase'); },
        sendPurchaseEventForOrder: async () => { purchaseCalls += 1; throw new Error('early_purchase'); }
    };
    vm.runInNewContext(`${stageSource}\nglobalThis.fixtureStage = stageConfirmedAdminLeadOrder;`, context);
    return {
        oldOrder, saved, queue, currentOrder,
        stage: (options = {}) => context.fixtureStage({ leadId: 999991, req: { user: { email: 'qa@example.invalid' } }, ...options }),
        purchaseCalls: () => purchaseCalls
    };
};

const postDropiFixture = () => {
    const order = { orderId: 'EC-RECOMPRA-NEW-FIXTURE', tracking: {} };
    const shipment = { automation: { dropiSubmitAuthorizedAt: new Date('2026-09-24T00:00:00Z') } };
    let calls = 0;
    const args = {
        order, shipment, dropiResult: { ok: true, dropiOrderId: 'DROPI-FIXTURE' },
        freshDropiSubmission: true,
        purchaseSender: async () => {
            calls += 1;
            return { ok: true, eventId: order.orderId, response: { events_received: 1 } };
        },
        purchaseLock: () => {}, persistOrder: async () => {}
    };
    return { order, args, calls: () => calls };
};

test('1 recompra confirmada não chama Purchase', async () => {
    const fixture = stageFixture();
    const result = await fixture.stage();
    assert.equal(result.order.status, 'confirmed');
    assert.equal(result.purchase.reason, 'awaiting_dropi');
    assert.equal(fixture.purchaseCalls(), 0);
});

test('2 stage-confirmed não contém chamada antecipada e mantém resposta compatível', () => {
    assert.doesNotMatch(stageSource, /ensurePurchaseForStagedOrder\s*\(/);
    assert.match(route, /purchase: staged\.purchase \? \{[\s\S]*alreadySent:[\s\S]*eventId:[\s\S]*status:/);
});

test('3 entrada na fila Confirmados não chama Purchase', async () => {
    const fixture = stageFixture();
    const result = await fixture.stage();
    assert.deepEqual(fixture.queue, [result.order.orderId]);
    assert.equal(fixture.purchaseCalls(), 0);
});

test('4 Dropi novo autorizado e bem-sucedido avalia Purchase uma vez', async () => {
    const fixture = postDropiFixture();
    const result = await ensurePurchaseAfterHumanDropiSuccessV141(fixture.args);
    assert.equal(result.metaAccepted, true);
    assert.equal(fixture.calls(), 1);
});

test('5 falha Dropi não avalia Purchase', async () => {
    const fixture = postDropiFixture();
    const result = await ensurePurchaseAfterHumanDropiSuccessV141({ ...fixture.args, dropiResult: { ok: false } });
    assert.equal(result.reason, 'dropi_not_successful');
    assert.equal(fixture.calls(), 0);
});

test('6 sem autorização humana Dropi não avalia Purchase', async () => {
    const fixture = postDropiFixture();
    const result = await ensurePurchaseAfterHumanDropiSuccessV141({ ...fixture.args, shipment: { automation: {} } });
    assert.equal(result.reason, 'human_dropi_authorization_missing');
    assert.equal(fixture.calls(), 0);
});

test('7 repetição do pedido não duplica Purchase', async () => {
    const fixture = postDropiFixture();
    await ensurePurchaseAfterHumanDropiSuccessV141(fixture.args);
    const second = await ensurePurchaseAfterHumanDropiSuccessV141(fixture.args);
    assert.equal(second.alreadySent, true);
    assert.equal(fixture.calls(), 1);
});

test('8 event_id persiste como orderId estável', async () => {
    const fixture = postDropiFixture();
    const result = await ensurePurchaseAfterHumanDropiSuccessV141(fixture.args);
    assert.equal(result.eventId, fixture.order.orderId);
    assert.equal(fixture.order.tracking.metaPurchaseEventId, fixture.order.orderId);
    assert.match(fs.readFileSync(new URL('../src/services/metaConversionsService.js', import.meta.url), 'utf8'), /const eventId = order\?\.orderId \|\| order\?\._id\?\.toString\(\)/);
});

test('9 metaPurchaseSentAt continua bloqueando duplicidade', async () => {
    const fixture = postDropiFixture();
    await ensurePurchaseAfterHumanDropiSuccessV141(fixture.args);
    assert.ok(fixture.order.tracking.metaPurchaseSentAt instanceof Date);
    await ensurePurchaseAfterHumanDropiSuccessV141(fixture.args);
    assert.equal(fixture.calls(), 1);
});

test('10 pedido antigo entregue permanece intacto', async () => {
    const fixture = stageFixture();
    const before = { ...fixture.oldOrder };
    await fixture.stage();
    assert.deepEqual(fixture.oldOrder, before);
    assert.equal(fixture.saved.includes(fixture.oldOrder), false);
});

test('11 novo pedido de recompra é distinto do antigo', async () => {
    const fixture = stageFixture();
    const result = await fixture.stage();
    assert.notEqual(result.order.orderId, fixture.oldOrder.orderId);
    assert.equal(result.order.previousOrderId, fixture.oldOrder.orderId);
    assert.equal(result.order.package.quantity, 2);
    assert.equal(result.order.total, 70);
});

test('12 persistência V158 exige visibilidade na consulta Confirmados', async () => {
    const fixture = stageFixture();
    const result = await fixture.stage();
    assert.equal(result.confirmedPersistence.visibleInConfirmedQuery, true);
    assert.deepEqual(fixture.queue, [result.order.orderId]);
});

test('13 fluxo não-recompra permanece confirmado sem Purchase', async () => {
    const fixture = stageFixture({ repurchase: false });
    const result = await fixture.stage();
    assert.equal(result.repurchase, false);
    assert.equal(result.order.orderId, fixture.currentOrder.orderId);
    assert.equal(result.order.status, 'confirmed');
    assert.equal(fixture.purchaseCalls(), 0);
});
