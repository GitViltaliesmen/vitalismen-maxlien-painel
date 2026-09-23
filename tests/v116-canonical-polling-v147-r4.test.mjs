import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import Shipment from '../src/models/Shipment.js';
import Order from '../src/models/Order.js';
import { buildPostSaleTransactionalV105Overlay } from '../src/services/postSaleTransactionalControlPlaneV105Service.js';
import { canonicalLogisticsProjectionV147, legacyLogisticsStatusForV147 } from '../src/services/canonicalLogisticsStatusV147Service.js';
import { processCarrierStatusSweep, carrierStatusSweepQuery } from '../src/services/shipmentStatusDispatcherService.js';
import { decidePostSaleNotification } from '../src/services/postSaleNotificationDecisionService.js';

const require = createRequire(import.meta.url);
const siftModule = require('sift');
const sift = siftModule.default || siftModule;
const originalEnv = { ...process.env };
const originals = Object.fromEntries(['find', 'findById', 'findOneAndUpdate', 'updateOne'].map((key) => [key, Shipment[key]]));
const originalOrderFindOne = Order.findOne;
const watermark = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
const get = (value, key) => key.split('.').reduce((o, k) => o?.[k], value);
const set = (value, key, next) => {
    const keys = key.split('.');
    const leaf = keys.pop();
    const parent = keys.reduce((o, k) => (o[k] ??= {}), value);
    parent[leaf] = next;
};
let rows = [];
const query = (value) => ({ sort() { return this; }, limit(n) { value = value.slice(0, n); return this; },
    lean() { return Promise.resolve(value); }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const update = (row, op) => {
    for (const [key, value] of Object.entries(op.$set || {})) set(row, key, value);
    for (const [key, value] of Object.entries(op.$addToSet || {})) set(row, key, [...new Set([...(get(row, key) || []), ...(value.$each || [value])])]);
    for (const [key, value] of Object.entries(op.$push || {})) {
        const all = [...(get(row, key) || []), ...(value.$each || [value])];
        set(row, key, value.$slice ? all.slice(value.$slice) : all);
    }
    return { matchedCount: 1, modifiedCount: 1 };
};
const fixture = (id = 'r4') => ({
    _id: id, orderId: `EC-SINK-${id}`, country: 'EC', productName: 'Tex Ultra Ecuador',
    client: { phone: '593999000111', customerId: 'sink-customer' },
    logistics: { status: 'EN_RUTA', canonicalStatus: 'IN_TRANSIT', trackingNumber: `189000${id.replace(/\D/g, '') || '1474'}`, distributionCompany: 'SERVIENTREGA' },
    createdAt: new Date(), updatedAt: new Date(), raw: {}, outcomes: {}, review: {}, automation: {}, events: [],
    async save() { return this; }, toObject() { return this; }, markModified() {}
});
const carrier = (shipment, status = 'ENTERING_AGENCY') => {
    const projection = canonicalLogisticsProjectionV147({ providerCode: status });
    return { ok: true, carrier: 'servientrega', trackingNumber: shipment.logistics.trackingNumber,
        providerStatusCode: status, statusAtual: status, canonicalStatus: projection.canonicalStatus,
        normalizedStatus: legacyLogisticsStatusForV147(projection.canonicalStatus) };
};
const poll = (trackGuide, extra = {}) => processCarrierStatusSweep({ transactionalV116: true, activationWatermark: watermark, trackGuide, ...extra });
const noHistory = { find: () => query([]) };

test.beforeEach(() => {
    process.env.META_PIXEL_ID_EC = '1468946114265008';
    Object.assign(process.env, buildPostSaleTransactionalV105Overlay({ baseEnv: process.env }));
    process.env.POST_SALE_TRANSACTIONAL_AT_MOST_ONCE_V116_ENABLED = 'true';
    rows = [];
    Shipment.find = (filter) => query(rows.filter(sift(filter)));
    Shipment.findById = (id) => query(rows.find((row) => row._id === id) || null);
    Shipment.findOneAndUpdate = async (filter, op) => {
        const row = rows.find(sift(filter));
        if (!row) return null;
        update(row, op);
        return row;
    };
    Shipment.updateOne = async (filter, op) => {
        const row = rows.find(sift(filter));
        return row ? update(row, op) : { matchedCount: 0, modifiedCount: 0 };
    };
    Order.findOne = async () => null; // O teste unitário não acessa painel/Mongo/WhatsApp reais.
});
test.afterEach(() => {
    Object.assign(Shipment, originals);
    Order.findOne = originalOrderFindOne;
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
});

test('A/D: V116 invoca poll canônico due, persiste ENTERING_AGENCY e não libera retirada', async () => {
    const row = fixture(); rows.push(row); let calls = 0;
    const result = await poll(async () => { calls++; return carrier(row); });
    assert.equal(calls, 1); assert.equal(result.refreshed, 1);
    assert.equal(row.logistics.canonicalStatus, 'ENTERING_AGENCY');
    assert.equal(row.logistics.canPickup, false); assert.equal(row.logistics.reminderEligible, false);
    assert.ok(row.raw.carrierTracking.lastCheckedAt); assert.equal(row.automation.dispatchLockedUntil, null);
    for (const kind of ['ready_for_pickup', 'delivered_thank_you', 'pickup_bonus', 'product_usage']) {
        const decision = await decidePostSaleNotification({ shipment: row, kind, acquireLock: false, messageModel: noHistory });
        assert.notEqual(decision.decision, 'SHOULD_SEND');
    }
});

test('B/M: lastCheckedAt persistido mantém NOOP após reinício e preserva 60 minutos', async () => {
    const row = fixture(); rows.push(row); let calls = 0;
    await poll(async () => { calls++; return carrier(row); });
    // Um novo documento reproduz o carregamento persistido em outro processo.
    rows = [Object.assign(fixture(), JSON.parse(JSON.stringify(row)))];
    rows[0].raw.carrierTracking.lastCheckedAt = new Date(rows[0].raw.carrierTracking.lastCheckedAt);
    rows[0].createdAt = rows[0].updatedAt = new Date();
    const result = await poll(async () => { calls++; return carrier(row); });
    assert.equal(calls, 1); assert.equal(result.processed, 0); assert.equal(result.intervalMinutes, 60);
    rows[0].raw.carrierTracking.lastCheckedAt = new Date(Date.now() - 55 * 60000);
    assert.equal((await poll(async () => { calls++; return carrier(row); })).processed, 0);
    assert.equal(calls, 1);
});

test('C/N: dois workers concorrentes consultam o mesmo evento no máximo uma vez sob lock persistido', async () => {
    const row = fixture(); rows.push(row); let calls = 0;
    const provider = async () => { calls++; await new Promise((resolve) => setTimeout(resolve, 20)); return carrier(row); };
    const reports = await Promise.all([poll(provider), poll(provider)]);
    assert.equal(calls, 1); assert.equal(reports.reduce((n, r) => n + r.refreshed, 0), 1);
    assert.equal(row.automation.dispatchLockedUntil, null);
});

test('E/F: READY atual persiste elegibilidade e não cria mensagens no polling', async () => {
    const row = fixture(); rows.push(row);
    await poll(async () => carrier(row, 'READY_FOR_PICKUP'));
    assert.equal(row.logistics.canonicalStatus, 'READY_FOR_PICKUP');
    assert.equal(row.logistics.canPickup, true); assert.equal(row.logistics.pickupReadyVerifiedSource, 'carrier_tracking');
    assert.equal(row.automation.readyForPickupNotifiedAt, undefined);
    assert.equal(row.events.some((event) => /notified/.test(event.kind)), false);
    assert.equal((await poll(async () => { throw new Error('not due'); })).processed, 0);
});

test('I: DELIVERED forward observado cancela lembretes sem bloqueio histórico', async () => {
    const row = fixture(); rows.push(row);
    row.raw.carrierTracking = { lastCheckedAt: new Date(Date.now() - 61 * 60000), lastResult: carrier(row, 'IN_TRANSIT') };
    row.automation.notificationLocks = { PICKUP_REMINDER_DAY3: {}, PICKUP_REMINDER_DAY5: {} };
    await poll(async () => carrier(row, 'DELIVERED'));
    assert.equal(row.logistics.canonicalStatus, 'DELIVERED'); assert.equal(row.outcomes.delivered, true);
    assert.equal(row.automation.notificationLocks.PICKUP_REMINDER_DAY3, null);
    assert.equal(row.automation.notificationLocks.PICKUP_REMINDER_DAY5, null);
    assert.equal(row.review.suppressedNotificationKinds?.includes('delivered_thank_you') || false, false);
});

test('J: descoberta DELIVERED no primeiro scan persiste supressão P5/P6/P7 antes do lifecycle', async () => {
    const row = fixture(); rows.push(row);
    await poll(async () => carrier(row, 'DELIVERED'));
    assert.equal(row.logistics.canonicalStatus, 'DELIVERED');
    for (const kind of ['delivered_thank_you', 'pickup_bonus', 'product_usage']) {
        const decision = await decidePostSaleNotification({ shipment: row, kind, acquireLock: false, messageModel: noHistory });
        assert.equal(decision.decision, 'HISTORICAL_EVENT_SUPPRESSED');
    }
    assert.equal((await poll(async () => { throw new Error('terminal must not be queried'); })).processed, 0);
});

test('J: 123 DELIVERED históricos incompletos ficam fora da seleção', async () => {
    rows = Array.from({ length: 123 }, (_, i) => Object.assign(fixture(`${i}`), { logistics: { ...fixture(`${i}`).logistics, status: 'ENTREGADO', canonicalStatus: 'DELIVERED' } }));
    assert.equal((await poll(async () => { throw new Error('historical query'); })).processed, 0);
});

test('J: timestamp explícito posterior à ativação prova entrega forward no primeiro scan', async () => {
    const row = fixture(); rows.push(row);
    await poll(async () => ({ ...carrier(row, 'DELIVERED'), dataMovimento: new Date(Date.now() - 60000).toISOString() }));
    assert.equal(row.review.suppressedNotificationKinds?.includes('delivered_thank_you') || false, false);
});

test('K: RETURNED persiste sem P5/P6/P7 e sai da seleção ativa', async () => {
    const row = fixture(); rows.push(row);
    await poll(async () => carrier(row, 'RETURNED'));
    assert.equal(row.logistics.canonicalStatus, 'RETURNED'); assert.equal(row.outcomes.returned, true);
    assert.equal((await poll(async () => { throw new Error('terminal'); })).processed, 0);
});

for (const failure of ['timeout', 'HTTP', 'payload', 'unknown', 'wrong_guide']) {
    test(`L: ${failure} mantém último estado válido, registra tentativa e isola item`, async () => {
        const row = fixture('1'); const next = fixture('2'); rows.push(row, next);
        let calls = 0;
        const report = await poll(async () => {
            calls++;
            if (calls === 2) return carrier(next, 'READY_FOR_PICKUP');
            if (failure === 'timeout') throw new Error('provider timeout');
            if (failure === 'HTTP') return { ok: false, reason: 'http_503' };
            if (failure === 'payload') return null;
            if (failure === 'wrong_guide') return { ...carrier(row, 'DELIVERED'), trackingNumber: 'invalid' };
            return carrier(row, 'UNKNOWN');
        });
        assert.equal(report.failed, 1); assert.equal(report.refreshed, 1);
        assert.equal(row.logistics.canonicalStatus, 'IN_TRANSIT'); assert.equal(row.raw.carrierTracking.lastResult.ok, false);
        assert.equal(next.logistics.canonicalStatus, 'READY_FOR_PICKUP');
        assert.equal((await poll(async () => { throw new Error('cadence'); })).processed, 0);
    });
}

test('falha estrutural propaga FAIL e libera lock; watermark e force falham fechados', async () => {
    const row = fixture(); rows.push(row);
    await assert.rejects(poll(async () => carrier(row), { activationWatermark: null }), /watermark/);
    await assert.rejects(poll(async () => carrier(row), { force: true }), /contract/);
    const updateOne = Shipment.updateOne;
    Shipment.updateOne = async (filter, op) => {
        if (op.$set?.['raw.carrierTracking.lastCheckedAt']) throw new Error('database unavailable');
        return updateOne(filter, op);
    };
    await assert.rejects(poll(async () => carrier(row)), /database unavailable/);
    assert.equal(row.automation.dispatchLockedUntil, null);
});

test('falha de validação do documento isola item; próxima entrega usa última evidência válida', async () => {
    const bad = fixture('bad1'); const good = fixture('good2'); rows.push(bad, good);
    const updateOne = Shipment.updateOne;
    Shipment.updateOne = async (filter, op) => {
        if (filter._id === bad._id && op.$set?.['raw.carrierTracking.lastCheckedAt']) {
            const error = new Error('invalid shipment'); error.name = 'ValidationError'; throw error;
        }
        return updateOne(filter, op);
    };
    const report = await poll(async ({ trackingNumber }) => carrier(rows.find((r) => r.logistics.trackingNumber === trackingNumber), 'READY_FOR_PICKUP'));
    assert.equal(report.failed, 1); assert.equal(report.refreshed, 1);
    rows = [good];
    good.raw.carrierTracking = { lastCheckedAt: new Date(Date.now() - 61 * 60000), lastResult: { ok: false, reason: 'timeout' } };
    good.logistics.canonicalEvidence = { provider: 'servientrega', source: 'carrier_tracking', rawStatus: 'READY_FOR_PICKUP', observedAt: new Date(Date.now() - 62 * 60000) };
    await poll(async () => carrier(good, 'DELIVERED'));
    assert.equal(good.logistics.canonicalStatus, 'DELIVERED');
    assert.equal(good.review.suppressedNotificationKinds?.includes('delivered_thank_you') || false, false);
});

test('plan não consulta provider nem grava; batch chama poll antes do dispatcher existente', async () => {
    rows.push(fixture());
    const before = JSON.stringify(rows);
    const report = await poll(async () => { throw new Error('plan provider forbidden'); }, { dryRun: true });
    assert.equal(report.processed, 1); assert.equal(JSON.stringify(rows), before);
    const source = fs.readFileSync(new URL('../scripts/post-sale-transactional-batch-v116.mjs', import.meta.url), 'utf8');
    assert.ok(source.indexOf('await processCarrierStatusSweep(') < source.indexOf('await processShipmentStatusDispatch('));
    const wrapper = fs.readFileSync(new URL('../ops/post-sale-v116', import.meta.url), 'utf8');
    assert.match(wrapper, /flock -n 9/);
    assert.ok(wrapper.indexOf('flock -n 9') < wrapper.indexOf('post-sale-transactional-batch-v116.mjs run'));
    assert.equal(carrierStatusSweepQuery({ transactionalV116: true }).country, 'EC');
});
