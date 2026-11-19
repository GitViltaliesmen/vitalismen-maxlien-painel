import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareConfirmedDropiDispatchV252, confirmedOrderProblemsV252,
    automaticDropiMongoAllowedV252, automaticDropiExternalAllowedV252, automaticDropiOrderAllowedV252,
    runAutomaticDropiV252, processConfirmedDropiDispatchV252 } from '../src/services/confirmedDropiDispatchV252Service.js';

let active = true;
const cutoff = '2026-11-19T14:00:00.000Z', now = new Date('2026-11-19T14:01:00.000Z');
Object.defineProperty(globalThis, '__VITALISMEN_EC_CONFIRMED_DROPI_V252', { value: Object.freeze({
    kind: 'EC_CONFIRMED_DROPI_V252', isCurrent: () => active, activatedAt: () => cutoff
}) });
const order = () => ({ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', country: 'EC', orderId: 'EC-UNIT-V252', status: 'confirmed',
    customer: { name: 'Cliente Prueba', phone: '593990000001', address: 'Calle de prueba 123', city: 'Quito', province: 'Pichincha' },
    delivery: { mode: 'home' }, package: { id: 3, quantity: 3 }, total: 95.99,
    tracking: { productKey: 'vit_power_ec' }, customerDataResolution: { orderDataReady: true, blockedReasons: [] }
});
const queued = () => { const value = order(); prepareConfirmedDropiDispatchV252(value, { transition: true, now }); return value; };

test('confirmation creates one persisted job without changing the order identity', () => {
    const value = queued();
    assert.equal(value.orderId, 'EC-UNIT-V252'); assert.equal(value.dropiDispatchV252.status, 'pending');
    assert.equal(prepareConfirmedDropiDispatchV252(value, { transition: true, now }), false);
    assert.equal(prepareConfirmedDropiDispatchV252(order(), { transition: false, now }), false);
});
for (const [name, mutate] of [
    ['Brazil QA', value => value.customer.phone = '5515998038637'],
    ['quantity zero', value => value.package.quantity = 0],
    ['missing delivery', value => value.delivery.mode = ''],
    ['unverified agency', value => value.delivery = { mode: 'agency', agencyName: 'Agencia' }],
    ['unofficial price', value => value.total = 1],
    ['unverified customer', value => value.customerDataResolution.orderDataReady = false],
    ['missing surname', value => value.customer.name = 'Cliente']
]) test('rejects incomplete confirmation: ' + name, () => {
    const value = order(); mutate(value); assert.ok(confirmedOrderProblemsV252(value).length);
    assert.throws(() => prepareConfirmedDropiDispatchV252(value, { transition: true, now }), /confirmed_order_incomplete/);
    assert.equal(value.dropiDispatchV252, undefined);
});
test('does not replay confirmations or previously shipped purchases', () => {
    const value = order(); value.dropiOrderId = '1234567';
    assert.equal(prepareConfirmedDropiDispatchV252(value, { transition: true, now }), false);
    assert.equal(prepareConfirmedDropiDispatchV252(order(), { transition: true, now: new Date('2026-11-19T13:59:59Z') }), false);
});
test('authority denies other customers, collections and every non-Dropi effect', async () => {
    const value = queued(), token = 'unit-claim';
    await runAutomaticDropiV252({ order: value, token }, async () => {
        assert.equal(automaticDropiExternalAllowedV252('dropi'), true);
        for (const effect of ['meta', 'zapi_outbound_reply', 'elevenlabs', 'openai']) assert.equal(automaticDropiExternalAllowedV252(effect), false);
        assert.equal(automaticDropiMongoAllowedV252('orders', 'updateOne', [{ orderId: value.orderId }, { $set: { status: 'processing' } }]), true);
        assert.equal(automaticDropiMongoAllowedV252('orders', 'findOneAndUpdate', [{ _id: value._id }, { $set: { 'dropiDispatchV252.status': 'claimed', updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: false }]), true);
        assert.equal(automaticDropiMongoAllowedV252('orders', 'findOneAndUpdate', [{ _id: value._id }, { $set: { 'dropiDispatchV252.status': 'claimed' }, $setOnInsert: { 'customer.phone': '593990000002' } }]), false);
        assert.equal(automaticDropiMongoAllowedV252('orders', 'updateOne', [{ orderId: value.orderId }, { $set: { status: 'processing' } }, { upsert: true }]), false);
        assert.equal(automaticDropiMongoAllowedV252('shipments', 'updateOne', [{ orderId: value.orderId }, { $set: { 'client.phone': '593990000002' } }]), false);
        assert.equal(automaticDropiMongoAllowedV252('orders', 'updateOne', [{ orderId: 'EC-OTHER' }, { $set: { status: 'processing' } }]), false);
        assert.equal(automaticDropiMongoAllowedV252('orders', 'updateOne', [{ orderId: value.orderId }, { $set: { 'customer.phone': '593990000002' } }]), false);
        for (const collection of ['users', 'messages', 'orders']) assert.equal(automaticDropiMongoAllowedV252(collection, 'deleteMany', [{}]), false);
        assert.equal(automaticDropiMongoAllowedV252('shipments', 'insertOne', [{ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', orderId: 'EC-OTHER', country: 'EC', client: { phone: value.customer.phone } }]), false);
    });
    assert.equal(automaticDropiExternalAllowedV252('dropi'), false);
});
test('system authority stays separate from human authentication and matches the persisted lease', async () => {
    const value = queued(), token = 'unit-claim';
    await runAutomaticDropiV252({ order: value, token }, async () => {
        const shipment = { orderId: value.orderId, client: { phone: value.customer.phone } };
        assert.equal(automaticDropiOrderAllowedV252(value, shipment), false);
        value.dropiDispatchV252.status = 'claimed'; value.dropiDispatchV252.leaseToken = token;
        assert.equal(automaticDropiOrderAllowedV252(value, shipment), true);
        assert.equal(automaticDropiOrderAllowedV252({ ...value, orderId: 'EC-OLD' }, shipment), false);
        value.dropiDispatchV252.leaseToken = 'another'; assert.equal(automaticDropiOrderAllowedV252(value, shipment), false);
    });
});

const fixture = () => {
    let value = queued(), writes = 0;
    const matches = query => value && (!query.status || value.status === query.status)
        && (!query['dropiDispatchV252.status'] || value.dropiDispatchV252.status === query['dropiDispatchV252.status'])
        && (query['dropiDispatchV252.attempts'] === undefined || value.dropiDispatchV252.attempts === query['dropiDispatchV252.attempts']);
    const apply = update => { writes++; for (const [key, entry] of Object.entries(update.$set)) {
        if (key.startsWith('dropiDispatchV252.')) value.dropiDispatchV252[key.split('.')[1]] = entry;
        else value[key] = entry;
    } };
    const model = { findOne: query => ({ sort: () => ({ lean: async () => matches(query) ? structuredClone(value) : null }) }),
        findOneAndUpdate: async (query, update) => { if (!matches(query)) return null; apply(update); return value; },
        updateOne: async (query, update) => { assert.equal(query['dropiDispatchV252.leaseToken'], value.dropiDispatchV252.leaseToken); apply(update); return { modifiedCount: 1 }; } };
    return { model, value: () => value, writes: () => writes };
};
for (const [name, outcome] of [['success', { ok: true }], ['uncertain', null], ['provider failure', { ok: false, reason: 'timeout_after_create' }]]) {
    test('at most one dispatch after ' + name, async () => {
        const state = fixture(); let sent = 0;
        const adapters = { orderModel: state.model, shipmentModel: { findOne: () => ({ lean: async () => null }) },
            readiness: () => ({ ready: true }), history: async () => {}, dispatch: async () => { sent++; return outcome; }, now };
        await Promise.all([processConfirmedDropiDispatchV252(adapters), processConfirmedDropiDispatchV252(adapters)]);
        await processConfirmedDropiDispatchV252(adapters);
        assert.equal(sent, 1); assert.equal(state.value().dropiDispatchV252.attempts, 1);
        assert.equal(state.value().dropiDispatchV252.status, name === 'success' ? 'submitted' : 'review');
    });
}
test('revocation prevents queue and provider work', async () => {
    active = false;
    try {
        assert.equal(prepareConfirmedDropiDispatchV252(order(), { transition: true, now }), false);
        assert.equal(automaticDropiExternalAllowedV252('dropi'), false);
        assert.equal((await processConfirmedDropiDispatchV252({})).reason, 'automatic_dropi_inactive');
    } finally { active = true; }
});
