import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import mongoose from 'mongoose';

// Reutiliza somente as fronteiras SINK da R4. Mongo, decisões e ledger são reais.
assert.equal(process.env.V147_R4_TRANSPORT, 'SINK');
const directory = process.env.V147_R4_SINK_DIRECTORY;
assert.match(directory || '', /^\/var\/lib\/vitalismen-deploy\/v147-r4-sink-[a-z0-9-]+$/);
const root = fileURLToPath(new URL('..', import.meta.url));
assert.notEqual(fs.realpathSync(root), fs.realpathSync('/opt/vitalismen-automacao/current'));
const mongoUri = process.env.V147_R4_SINK_MONGO_URI;
assert.match(new URL(mongoUri).pathname, /^\/vitalismen_v147_r4_sink_[a-z0-9_]+$/);
for (const key of ['MONGODB_URI', 'MONGO_URI', 'MONGODB_URL']) assert.equal(process.env[key], mongoUri);
const { buildPostSaleTransactionalV105Overlay } = await import('../src/services/postSaleTransactionalControlPlaneV105Service.js');
process.env.META_PIXEL_ID_EC = '1468946114265008';
Object.assign(process.env, buildPostSaleTransactionalV105Overlay({ baseEnv: process.env }));
Object.assign(process.env, { POST_SALE_TRANSACTIONAL_AT_MOST_ONCE_V116_ENABLED: 'true',
    SHIPMENT_EC_PICKUP_AUDIO_APPROVED: 'true', SHIPMENT_AUDIO_DELAY_MIN_MS: '15', SHIPMENT_AUDIO_DELAY_MAX_MS: '15',
    ONLINE_ADMIN_PANEL_SYNC_ENABLED: 'true' });
const sink = [];
let activeSends = 0, maximumSends = 0;
globalThis.__R4_SINK_SEND = async (method, args) => {
    activeSends++; maximumSends = Math.max(maximumSends, activeSends);
    await new Promise((resolve) => setTimeout(resolve, 2));
    const providerMessageId = `r5-sink-${sink.length + 1}`;
    sink.push({ method, chatId: args[0], media: method === 'sendAudio' ? path.basename(String(args[1])) : '',
        kind: args.at(-1)?.kind || '', acceptedAt: new Date(), providerMessageId });
    activeSends--;
    return { ok: true, success: true, providerMessageId, providerZaapId: providerMessageId };
};
globalThis.__R4_TRACK = async ({ trackingNumber }) => ({ ok: true, carrier: 'servientrega', trackingNumber,
    statusAtual: 'Entregado', canonicalStatus: 'DELIVERED', normalizedStatus: 'ENTREGADO' });
const { default: Shipment } = await import('../src/models/Shipment.js');
const { default: ContactState } = await import('../src/models/ContactState.js');
const { default: Order } = await import('../src/models/Order.js');
const { default: OperationalSafetyState } = await import('../src/models/OperationalSafetyState.js');
const { notifyDeliveredThankYou, notifyPickupBonus, notifyProductUsage, notifyReadyForPickup, notifyShipmentReminder } = await import('../src/services/shipmentMessageService.js');
const { reminderDueV147 } = await import('../src/services/canonicalLogisticsStatusV147Service.js');
const { processShipmentStatusDispatch } = await import('../src/services/shipmentStatusDispatcherService.js');
const { routeIncomingMessage } = await import('../src/services/agentRouter.js');
await mongoose.connect(mongoUri, { autoIndex: true });
const sequence = async (id) => {
    await notifyDeliveredThankYou(await Shipment.findById(id));
    await notifyPickupBonus(await Shipment.findById(id));
    await notifyProductUsage(await Shipment.findById(id));
};
if (process.argv.includes('--restart')) {
    await sequence(process.argv.at(-1));
    assert.equal(sink.length, 0);
    await mongoose.disconnect();
    console.log('RESTART_IDEMPOTENCY=PASS');
    process.exit(0);
}
assert.equal((await mongoose.connection.db.listCollections().toArray()).length, 0);
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const sqlite = spawnSync('python3', ['-', path.join(directory, 'leads_ec.sqlite3')], { encoding: 'utf8', input:
    "import sqlite3,sys\nc=sqlite3.connect(sys.argv[1]);c.executescript('CREATE TABLE leads(id INTEGER PRIMARY KEY, name TEXT, phone TEXT, phone_e164 TEXT, country TEXT, status TEXT, notes TEXT, product_qty INTEGER, product_value REAL, updated_at TEXT, event_id TEXT); CREATE TABLE lead_history(id INTEGER PRIMARY KEY, lead_id INTEGER, action TEXT, details TEXT, created_at TEXT); CREATE TABLE lead_status_history(id INTEGER PRIMARY KEY, lead_id INTEGER, old_status TEXT, new_status TEXT, created_at TEXT);');c.commit()" });
assert.equal(sqlite.status, 0);
let index = 0;
const create = async ({ product = '', status = 'DELIVERED', orderId = '', customerId = '', shipmentId = '', dropiId = '', canonicalOrderId = '' } = {}) => {
    const phone = `593999147${String(++index).padStart(3, '0')}`;
    const state = await ContactState.create({ ...(customerId ? { _id: customerId } : {}), chatId: `${phone}@s.whatsapp.net`, phoneDigits: phone, countryCode: 'EC',
        human: { mode: 'manual', lastManualBy: 'SINK_OPERATOR', pausedUntil: new Date('2036-09-10'), note: 'SINK manual takeover' } });
    const shipment = await Shipment.create({ ...(shipmentId ? { _id: shipmentId } : {}), orderId: orderId || `EC-SINK-R5-${index}`, country: 'EC', productName: '',
        client: { phone, name: 'Cliente SINK' },
        logistics: { status: status === 'DELIVERED' ? 'ENTREGADO' : status, canonicalStatus: status, trackingNumber: dropiId ? '189613439' : `189147${index}00`,
            distributionCompany: 'SERVIENTREGA', agencyPickup: true, pickupReadyVerified: status === 'READY_FOR_PICKUP', pickupReadyVerifiedSource: 'carrier_tracking',
            canonicalEvidence: { provider: 'servientrega', source: 'carrier_tracking', rawStatus: status, observedAt: new Date('2026-09-10T18:14:22.562Z') } },
        raw: { customerId: String(state._id), ...(dropiId ? {
            manualDropiOrderId: dropiId,
            latestDroppiPayload: { orderId, dropiOrderId: dropiId },
            historicalExternalReconciliation: { source: 'HISTORICAL_EXTERNAL_RECONCILIATION', customerId: String(state._id), phone,
                sourceDropi: true, sourceServientrega: true,
                dropiOrderId: dropiId, trackingNumber: '189613439', leadId: '3496' }
        } : {}) },
        review: { suppressedNotificationKinds: ['guide'] }
    });
    if (product) await Order.create({ country: 'EC', currency: 'USD', orderId: canonicalOrderId || shipment.orderId,
        ...(dropiId ? { dropiOrderId: dropiId } : {}), customer: { phone, name: 'Cliente SINK' }, tracking: { productKey: product } });
    return { state, shipment };
};
const receipt = { transport: 'SINK', realMessagesSent: 0, cases: [] };
try {
    await OperationalSafetyState.create({ _id: 'post-sale-safety-v66', bridgeComplete: true, dataCompatibilityVersion: 66, minRuntimeVersion: 66, writerRuntimeVersion: 66 });
    await Promise.all([Shipment.init(), ContactState.init(), Order.init()]);
    for (const [product, expected] of [['', ''], ['tex_ultra_ec', 'MODO_DE_USO_TEX_ULTRA.ogg'],
        ['vit_power_ec', 'COMO_SE_TOMA_VIT_POWER.ogg'], ['nitrix_ec', 'NITRIX_USO_OXIDE_EC.ogg'], ['CONFLICT', '']]) {
        const { shipment } = await create({ product: product === 'CONFLICT' ? 'tex_ultra_ec' : product });
        if (product === 'CONFLICT') await Shipment.updateOne({ _id: shipment._id }, { $set: { productName: 'Vit Power' } });
        const before = sink.length;
        await sequence(shipment._id);
        const sent = sink.slice(before);
        assert.equal(sent.length, expected ? 3 : 2, product || 'UNKNOWN');
        assert.equal(sent[0].media, 'OBRIGADO_PAGOU.ogg'); assert.equal(sent[1].method, 'sendText');
        assert.ok(new Date(sent[1].acceptedAt) - new Date(sent[0].acceptedAt) >= 15);
        if (expected) { assert.equal(sent[2].media, expected); assert.ok(new Date(sent[2].acceptedAt) - new Date(sent[1].acceptedAt) >= 15); }
        const stored = await Shipment.findById(shipment._id);
        assert.equal(stored.automation.postSaleSafetyLedger.DELIVERED_THANK_YOU.state, 'SENT');
        assert.equal(stored.automation.postSaleSafetyLedger.PICKUP_BONUS.state, 'SENT');
        if (!expected) assert.equal(stored.review.reviewStatus, 'product_usage_review_required');
        await sequence(shipment._id); assert.equal(sink.length, before + sent.length);
        receipt.cases.push({ product: product || 'UNKNOWN', p5: 1, p6: 1, p7: expected || 0, reviewRequired: !expected });
    }
    const { shipment: ready, state: manual } = await create({ status: 'READY_FOR_PICKUP' });
    const beforeReady = sink.length;
    assert.equal(await notifyReadyForPickup(ready), true);
    assert.equal(sink.slice(beforeReady).filter((entry) => entry.media === 'Chegou_01.ogg').length, 1);
    const t0 = new Date(Date.now() - 121 * 3600000);
    await Shipment.updateOne({ _id: ready._id }, { $set: { 'automation.readyForPickupNotifiedAt': t0, 'automation.postSaleSafetyLedger.READY_FOR_PICKUP.acceptedAt': t0, 'automation.lastReminderAt': t0, 'automation.lastMessageAt': t0 } });
    assert.equal(reminderDueV147({ acceptedAt: t0, canonicalStatus: 'READY_FOR_PICKUP', now: new Date() }).templateId, 'A10');
    assert.equal(await notifyShipmentReminder(await Shipment.findById(ready._id), 'day3'), true);
    await Shipment.updateOne({ _id: ready._id }, { $set: { 'automation.lastReminderAt': t0, 'automation.lastMessageAt': t0 } });
    assert.equal(await notifyShipmentReminder(await Shipment.findById(ready._id), 'day5'), true);
    const beforeCommercial = sink.length;
    await routeIncomingMessage({ from: manual.chatId, senderPn: manual.phoneDigits, body: 'Quiero comprar otro frasco, cuanto cuesta?', id: 'r5-commercial-manual-sink' });
    assert.equal(sink.length, beforeCommercial);
    const held = await ContactState.findById(manual._id);
    assert.equal(held.human.mode, 'manual'); assert.equal(held.metadata.lastHumanHoldReason, 'manual_attendance_active');
    const { shipment: blocked, state: optOut } = await create();
    await ContactState.updateOne({ _id: optOut._id }, { $set: { 'engagementAutomation.blockedReason': 'opt_out', 'engagementAutomation.blockedAt': new Date() } });
    await sequence(blocked._id); assert.equal(sink.length, beforeCommercial);
    await Shipment.updateOne({ _id: blocked._id }, { $set: { 'review.manualOnly': true } });
    const { shipment: replay } = await create({ product: 'tex_ultra_ec', orderId: '6886247', canonicalOrderId: 'EC-ADMIN-3496', dropiId: '6886247',
        customerId: '6a9c0694f512f72e9aa802b2', shipmentId: '6a9f430434784e5138be3399' });
    const replayBefore = sink.length;
    // A ativação sucessora é posterior ao evento. O dispatcher R4 deve preservar a elegibilidade já persistida.
    const replayDispatch = await processShipmentStatusDispatch({ limit: 1, actions: ['delivered_bonus'], canonicalPollCompleted: true, activationWatermark: new Date().toISOString() });
    assert.ok(sink.slice(replayBefore).some((entry) => String(entry.chatId).startsWith(`${replay.client.phone}@`)), JSON.stringify(replayDispatch));
    let replayStored = await Shipment.findById(replay._id);
    assert.equal(replayStored.review.suppressedNotificationKinds.includes('delivered_thank_you'), false);
    assert.ok(replayStored.automation.usageNotifiedAt);
    const replaySent = sink.filter((entry) => String(entry.chatId).startsWith(`${replay.client.phone}@`));
    assert.equal(replaySent.length, 3);
    const restarted = spawnSync(process.execPath, ['--import', './tests/helpers/v147-r4-sink-register.mjs',
        '--import', './scripts/lib/ec-runtime-successor-v97-context.mjs', fileURLToPath(import.meta.url), '--restart', String(replay._id)],
        { cwd: root, env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8', timeout: 120000 });
    fs.writeFileSync(path.join(directory, 'restart.log'), restarted.stdout + restarted.stderr, { mode: 0o600 });
    assert.equal(restarted.status, 0); assert.match(restarted.stdout, /RESTART_IDEMPOTENCY=PASS/);
    const { shipment: concurrent } = await create({ product: 'tex_ultra_ec' });
    const concurrencyBefore = sink.length;
    await Promise.all([1, 2, 3].map(() => notifyDeliveredThankYou(concurrent)));
    assert.equal(sink.length - concurrencyBefore, 1);
    assert.equal(maximumSends, 1);
    Object.assign(receipt, { status: 'PASS', manualA07A10A19: 'PASS', commercialInboundManualBlocked: 'PASS', explicitOptOut: 'PASS',
        replay6886247: 'PASS', restartIdempotency: 'PASS', concurrency: 'PASS', dedupe: 'PASS', noSpamBurst: 'PASS', messages: sink });
    fs.writeFileSync(path.join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
    console.log('V147_R5_STAGING_SINK=PASS');
} finally { await mongoose.disconnect(); }
