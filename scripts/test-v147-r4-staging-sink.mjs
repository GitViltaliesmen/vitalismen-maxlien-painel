import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import mongoose from 'mongoose';

assert.equal(process.env.V147_R4_TRANSPORT, 'SINK');
const directory = process.env.V147_R4_SINK_DIRECTORY;
assert.match(directory || '', /^\/var\/lib\/vitalismen-deploy\/v147-r4-sink-[a-z0-9-]+$/);
const root = fileURLToPath(new URL('..', import.meta.url));
assert.notEqual(fs.realpathSync(root), fs.realpathSync('/opt/vitalismen-automacao/current'));
const mongoUri = process.env.V147_R4_SINK_MONGO_URI;
const database = new URL(mongoUri).pathname.slice(1);
assert.match(database, /^vitalismen_v147_r4_sink_[a-z0-9_]+$/);
for (const key of ['MONGODB_URI', 'MONGO_URI', 'MONGODB_URL']) process.env[key] = mongoUri;
const { buildPostSaleTransactionalV105Overlay } = await import('../src/services/postSaleTransactionalControlPlaneV105Service.js');
process.env.META_PIXEL_ID_EC = '1468946114265008';
Object.assign(process.env, buildPostSaleTransactionalV105Overlay({ baseEnv: process.env }));
Object.assign(process.env, {
    POST_SALE_TRANSACTIONAL_AT_MOST_ONCE_V116_ENABLED: 'true',
    SHIPMENT_EC_PICKUP_AUDIO_APPROVED: 'true',
    SHIPMENT_AUDIO_DELAY_MIN_MS: '1', SHIPMENT_AUDIO_DELAY_MAX_MS: '1',
    ONLINE_ADMIN_PANEL_SYNC_ENABLED: 'true'
});

const sink = [];
globalThis.__R4_SINK_SEND = async (method, args) => {
    const options = args.at(-1) || {};
    const acceptedAt = new Date();
    const providerMessageId = `r4-sink-${sink.length + 1}`;
    sink.push({ method, kind: options.kind || options.outboundContext || '', media: method === 'sendAudio' ? path.basename(String(args[1])) : '', acceptedAt, providerMessageId });
    return { ok: true, success: true, providerMessageId, providerZaapId: providerMessageId };
};
let providerStatus = 'ENTERING_AGENCY';
let providerCalls = 0;
const { canonicalLogisticsProjectionV147, legacyLogisticsStatusForV147 } = await import('../src/services/canonicalLogisticsStatusV147Service.js');
globalThis.__R4_TRACK = async ({ trackingNumber }) => {
    providerCalls++;
    const projection = canonicalLogisticsProjectionV147({ providerCode: providerStatus });
    return { ok: true, carrier: 'servientrega', trackingNumber, statusAtual: providerStatus,
        providerStatusCode: providerStatus, canonicalStatus: projection.canonicalStatus,
        normalizedStatus: legacyLogisticsStatusForV147(projection.canonicalStatus) };
};
const { default: Shipment } = await import('../src/models/Shipment.js');
const { default: Order } = await import('../src/models/Order.js');
const { default: ContactState } = await import('../src/models/ContactState.js');
const { default: OperationalSafetyState } = await import('../src/models/OperationalSafetyState.js');
const { restoreHistoricalExternalDroppiBinding } = await import('../src/services/droppiEcuadorImportService.js');
const { processCarrierStatusSweep } = await import('../src/services/shipmentStatusDispatcherService.js');
const { notifyReadyForPickup, notifyShipmentReminder } = await import('../src/services/shipmentMessageService.js');
const { reminderDueV147 } = await import('../src/services/canonicalLogisticsStatusV147Service.js');
await mongoose.connect(mongoUri, { autoIndex: true });
assert.equal((await mongoose.connection.db.listCollections().toArray()).length, 0, 'banco SINK deve ser novo');
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const python = spawnSync('python3', ['-', path.join(directory, 'leads_ec.sqlite3')], { encoding: 'utf8', input: `
import sqlite3,sys
c=sqlite3.connect(sys.argv[1])
c.executescript("CREATE TABLE leads(id INTEGER PRIMARY KEY, name TEXT, phone TEXT, phone_e164 TEXT, status TEXT, notes TEXT, product_qty INTEGER, product_value REAL, updated_at TEXT, event_id TEXT); CREATE TABLE lead_history(id INTEGER PRIMARY KEY, lead_id INTEGER, action TEXT, details TEXT, created_at TEXT); CREATE TABLE lead_status_history(id INTEGER PRIMARY KEY, lead_id INTEGER, old_status TEXT, new_status TEXT, created_at TEXT); INSERT INTO leads(id,name,phone,phone_e164,status,notes,event_id) VALUES(3484,'Cliente SINK','+593980548369','+593980548369','pedido_enviado','EC-ADMIN-3484','EC-ADMIN-3484');")
c.commit()
` });
assert.equal(python.status, 0, python.stderr);
const panel = () => {
    const result = spawnSync('python3', ['-', path.join(directory, 'leads_ec.sqlite3')], { encoding: 'utf8', input: "import sqlite3,sys,json\nc=sqlite3.connect(sys.argv[1]);print(json.dumps(c.execute('SELECT status FROM leads WHERE id=3484').fetchone()[0]))" });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
};

const activationWatermark = new Date(Date.now() - 3 * 3600000).toISOString();
const originalReadFileSync = fs.readFileSync;
fs.readFileSync = function (file, ...args) {
    const filename = file instanceof URL ? fileURLToPath(file) : String(file);
    if (filename === path.join(root, '.activation-complete.json')) return JSON.stringify({ activatedAt: activationWatermark });
    return originalReadFileSync.call(this, file, ...args);
};
let batchNumber = 0;
const batches = [];
const batch = async () => {
    const write = process.stdout.write;
    let output = '';
    process.stdout.write = function (text, ...args) { output += String(text); return write.call(this, text, ...args); };
    process.argv[2] = 'run';
    try { await import(`${pathToFileURL(path.join(root, 'scripts/post-sale-transactional-batch-v116.mjs')).href}?sink=${++batchNumber}`); }
    finally { process.stdout.write = write; }
    const start = output.lastIndexOf('\n{\n  "status":');
    const report = JSON.parse(output.slice(start >= 0 ? start + 1 : 0));
    assert.match(report.status, /^PASS_/);
    assert.equal(process.exitCode || 0, 0);
    batches.push(report);
    await mongoose.connect(mongoUri, { autoIndex: false });
    return report;
};
try {
    await OperationalSafetyState.create({ _id: 'post-sale-safety-v66', bridgeComplete: true, dataCompatibilityVersion: 66, minRuntimeVersion: 66, writerRuntimeVersion: 66 });
    const state = await ContactState.create({ _id: '6a9830afd2d008efa0c8f62e', chatId: '593980548369@s.whatsapp.net', countryCode: 'EC', phoneDigits: '593980548369', metadata: { customerDraft: { orderId: 'EC-ADMIN-3484', phone: '+593980548369', status: 'pedido_enviado' } } });
    await Order.create({ orderId: 'EC-ADMIN-3484', country: 'EC', currency: 'USD', status: 'shipped', customer: { name: 'Cliente SINK', phone: '+593980548369' }, package: { quantity: 3, label: 'Tex Ultra Ecuador' }, total: 80.99, dropiOrderId: '6924784', trackingNumber: '189629714', tracking: { productName: 'Tex Ultra Ecuador', productKey: 'tex_ultra_ec' } });
    const bind = () => restoreHistoricalExternalDroppiBinding({ row: { phone: '+593980548369', dropiOrderId: '6924784', trackingNumber: '189629714' }, state, lead: { id: 3484, phone: '+593980548369' }, carrier: { ok: true, trackingNumber: '189629714', normalizedStatus: 'EN_RUTA' }, dryRun: false });
    assert.equal((await bind()).restored, true);
    assert.equal((await bind()).alreadyBound, true);
    assert.equal(await Shipment.countDocuments({ orderId: 'EC-ADMIN-3484' }), 1);
    await Shipment.updateOne({ orderId: 'EC-ADMIN-3484' }, { $set: { 'logistics.agencyPickup': true } });
    const first = await batch();
    assert.equal(first.polling.refreshed, 1); assert.equal(first.sent, 0); assert.equal(sink.length, 0);
    const second = await batch();
    assert.equal(second.polling.processed, 0); assert.equal(providerCalls, 1);
    let shipment = await Shipment.findOne({ orderId: 'EC-ADMIN-3484' });
    assert.equal(shipment.logistics.canonicalStatus, 'ENTERING_AGENCY');

    providerStatus = 'READY_FOR_PICKUP';
    await Shipment.updateOne({ _id: shipment._id }, { $set: { 'raw.carrierTracking.lastCheckedAt': new Date(Date.now() - 61 * 60000) } });
    const ready = await batch();
    assert.equal(ready.polling.refreshed, 1);
    shipment = await Shipment.findById(shipment._id);
    assert.equal(shipment.logistics.canonicalStatus, 'READY_FOR_PICKUP');
    assert.equal(shipment.logistics.canPickup, true);
    assert.ok(shipment.automation.readyForPickupNotifiedAt);
    assert.equal(await notifyReadyForPickup(shipment), false);
    assert.equal(sink.filter((x) => x.media === 'Chegou_01.ogg').length, 1);
    assert.equal((await ContactState.findById(state._id)).metadata.logistics.canonicalStatus, 'READY_FOR_PICKUP');
    assert.equal((await Order.findOne({ orderId: shipment.orderId })).shippingCanonicalStatus, 'READY_FOR_PICKUP');
    const readyPanel = panel();

    // O relógio canônico e o dispatcher de lembretes existentes são exercitados sem alterar regras.
    const t0 = new Date(Date.now() - 121 * 3600000);
    await Shipment.updateOne({ _id: shipment._id }, { $set: { 'automation.readyForPickupNotifiedAt': t0, 'automation.lastReminderAt': t0, 'automation.lastMessageAt': t0 } });
    shipment = await Shipment.findById(shipment._id);
    assert.equal(reminderDueV147({ acceptedAt: t0, canonicalStatus: shipment.logistics.canonicalStatus, now: new Date() }).templateId, 'A10');
    assert.equal(await notifyShipmentReminder(shipment, 'day3'), true);
    shipment = await Shipment.findById(shipment._id);
    assert.equal(await notifyShipmentReminder(shipment, 'day3'), false);
    await Shipment.updateOne({ _id: shipment._id }, { $set: { 'automation.lastReminderAt': t0, 'automation.lastMessageAt': t0 } });
    shipment = await Shipment.findById(shipment._id);
    assert.equal(await notifyShipmentReminder(shipment, 'day5'), true);
    assert.equal(sink.filter((x) => x.media === 'Chegou_02.ogg').length, 1);
    assert.equal(sink.filter((x) => x.media === 'Chegou_03.ogg').length, 1);

    providerStatus = 'DELIVERED';
    await Shipment.updateOne({ _id: shipment._id }, { $set: { 'raw.carrierTracking.lastCheckedAt': new Date(Date.now() - 61 * 60000), 'automation.lastReminderAt': t0, 'automation.lastMessageAt': t0 } });
    const delivery = await batch();
    assert.equal(delivery.polling.refreshed, 1);
    shipment = await Shipment.findById(shipment._id);
    assert.equal(shipment.logistics.canonicalStatus, 'DELIVERED');
    assert.equal((await Order.findOne({ orderId: shipment.orderId })).status, 'delivered');
    assert.equal((await ContactState.findById(state._id)).metadata.customerDraft.status, 'entregue');
    assert.equal(panel(), 'entregue');
    assert.equal(shipment.automation.notificationLocks.PICKUP_REMINDER_DAY3, null);
    assert.equal(shipment.automation.notificationLocks.PICKUP_REMINDER_DAY5, null);
    const countBeforeRestart = sink.length;
    await batch();
    assert.equal(sink.length, countBeforeRestart);
    const p5 = sink.findIndex((x) => x.media === 'OBRIGADO_PAGOU.ogg');
    const p7 = sink.findIndex((x) => x.media === 'MODO_DE_USO_TEX_ULTRA.ogg');
    assert.ok(p5 >= 0 && p7 > p5);
    assert.ok(shipment.automation.bonusNotifiedAt);

    // Snapshot READY enfileirado; provider muda para DELIVERED antes do envio.
    await Shipment.updateOne({ _id: shipment._id }, { $set: {
        'logistics.status': 'READY_FOR_PICKUP', 'logistics.canonicalStatus': 'READY_FOR_PICKUP',
        'logistics.pickupReadyVerified': true, 'logistics.pickupReadyVerifiedSource': 'carrier_tracking',
        'logistics.canonicalEvidence': { provider: 'servientrega', source: 'carrier_tracking', rawStatus: 'READY_FOR_PICKUP', observedAt: new Date() },
        'automation.readyForPickupNotifiedAt': null, 'automation.sentMessageHashes': [],
        'automation.postSaleSafetyLedger': {}, 'automation.notificationLocks': {},
        'automation.deliveredThankYouNotifiedAt': null, 'automation.bonusNotifiedAt': null,
        'automation.usageNotifiedAt': null, 'automation.deliveredConfirmedAt': null,
        'automation.reminderDay3At': null, 'automation.reminderDay5At': null,
        'review.suppressedNotificationKinds': ['guide', 'in_transit', 'delivered_thank_you', 'pickup_bonus', 'product_usage'],
        events: [], notificationLedger: [],
        'outcomes.delivered': false, 'outcomes.pickedUp': false,
        'raw.carrierTracking.lastCheckedAt': new Date(),
        'raw.carrierTracking.lastResult': { ok: true, statusAtual: 'READY_FOR_PICKUP' }
    } });
    const beforeStale = sink.length;
    const stale = await batch();
    assert.equal(stale.polling.processed, 0);
    assert.equal(sink.length, beforeStale);
    assert.equal((await Shipment.findById(shipment._id)).logistics.canonicalStatus, 'DELIVERED');

    // Concorrência com lock Mongo real e histórico terminal fora da seleção.
    const concurrent = await Shipment.create({ orderId: 'EC-SINK-CONCURRENT', country: 'EC',
        client: { phone: '593999000111' }, logistics: { status: 'EN_RUTA', canonicalStatus: 'IN_TRANSIT', trackingNumber: '1890001474', distributionCompany: 'SERVIENTREGA' },
        review: { suppressedNotificationKinds: ['guide', 'in_transit'] } });
    providerStatus = 'ENTERING_AGENCY';
    const beforeConcurrent = providerCalls;
    const cycles = await Promise.all([1, 2].map(() => processCarrierStatusSweep({ transactionalV116: true, activationWatermark })));
    assert.equal(providerCalls - beforeConcurrent, 1);
    assert.equal(cycles.reduce((n, r) => n + r.refreshed, 0), 1);
    assert.equal((await Shipment.findById(concurrent._id)).automation.dispatchLockedUntil, null);
    await Shipment.insertMany(Array.from({ length: 123 }, (_, i) => ({ orderId: `EC-SINK-HIST-${i}`, country: 'EC',
        logistics: { status: 'ENTREGADO', canonicalStatus: 'DELIVERED', trackingNumber: `1890002${String(i).padStart(3, '0')}`, distributionCompany: 'SERVIENTREGA' } })));
    const historyPoll = await processCarrierStatusSweep({ transactionalV116: true, activationWatermark });
    assert.equal(historyPoll.processed, 0);
    assert.equal(sink.length, beforeStale);
    const receipt = { status: 'PASS', transport: 'SINK', realMessagesSent: 0, targetShipmentCount: 1, duplicateShipments: 0,
        providerCalls, batchCount: batches.length, pollPhase: 'PASS', dispatchPhase: 'PASS', exit: 0,
        panelStatusPropagation: 'PASS', readyPanel, deliveredPanel: panel(), historicalBackfillMessages: 0,
        duplicateMessages: 0, noSpamBurst: 'PASS', staleQueuedReady: 'PASS', concurrentProviderCalls: 1,
        historicalTerminalExcluded: 123, readyCanonicalStatus: 'READY_FOR_PICKUP', messages: sink, batches };
    fs.writeFileSync(path.join(directory, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    console.log('V147_R4_STAGING_SINK=PASS');
} finally {
    fs.readFileSync = originalReadFileSync;
    await mongoose.disconnect();
}
