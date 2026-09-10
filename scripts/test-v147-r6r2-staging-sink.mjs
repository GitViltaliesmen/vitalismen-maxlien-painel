import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import mongoose from 'mongoose';
assert.equal(process.env.V147_R4_TRANSPORT, 'SINK');
const directory = process.env.V147_R4_SINK_DIRECTORY;
assert.match(directory || '', /^\/var\/lib\/vitalismen-deploy\/v147-r4-sink-[a-z0-9-]+$/);
const root = fileURLToPath(new URL('..', import.meta.url));
assert.notEqual(fs.realpathSync(root), fs.realpathSync('/opt/vitalismen-automacao/current'));
const uri = process.env.V147_R4_SINK_MONGO_URI;
assert.match(new URL(uri).pathname, /^\/vitalismen_v147_r4_sink_[a-z0-9_]+$/);
for (const key of ['MONGODB_URI', 'MONGO_URI', 'MONGODB_URL']) assert.equal(process.env[key], uri);
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const { buildPostSaleTransactionalV105Overlay } = await import('../src/services/postSaleTransactionalControlPlaneV105Service.js');
process.env.META_PIXEL_ID_EC = '1468946114265008';
Object.assign(process.env, buildPostSaleTransactionalV105Overlay({ baseEnv: process.env }));
Object.assign(process.env, { POST_SALE_TRANSACTIONAL_AT_MOST_ONCE_V116_ENABLED: 'true',
    SHIPMENT_EC_PICKUP_AUDIO_APPROVED: 'true', SHIPMENT_AUDIO_DELAY_MIN_MS: '15', SHIPMENT_AUDIO_DELAY_MAX_MS: '15', ONLINE_ADMIN_PANEL_SYNC_ENABLED: 'false' });
const trace = path.join(directory, 'provider-trace.jsonl');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const transport = async (method, args) => {
    const providerMessageId = 'r6r2-sink-' + crypto.randomUUID();
    const row = { providerMessageId, at: new Date().toISOString(), method, phone: String(args[0]), media: method === 'sendAudio' ? path.basename(String(args[1])) : '', pid: process.pid };
    fs.appendFileSync(trace, JSON.stringify(row) + '\n', { mode: 0o600 });
    await delay(3);
    return { ok: true, provider: 'sink', providerMessageId, providerZaapId: providerMessageId, providerStatus: 'accepted' };
};
globalThis.__R4_SINK_SEND = transport;
globalThis.__R4_TRACK = async () => { throw new Error('R6 must not poll'); };
const { default: Shipment } = await import('../src/models/Shipment.js');
const { default: Message } = await import('../src/models/Message.js');
const { default: Order } = await import('../src/models/Order.js');
const { default: ContactState } = await import('../src/models/ContactState.js');
const { notifyDeliveredThankYou, notifyPickupBonus, notifyProductUsage, notifyReadyForPickup, notifyShipmentReminder } = await import('../src/services/shipmentMessageService.js');
const { sendCanonicalPanelPostSaleV147R6 } = await import('../src/services/postSaleManualPanelV147R6Service.js');
const { resolvePostSaleEventV147R6, reservePostSaleEventV147R6, LEGACY_PANEL_P6_TEXT_V147R6 } = await import('../src/services/postSaleUnifiedEventV147R6Service.js');
await mongoose.connect(uri, { autoIndex: true });
const calls = () => fs.existsSync(trace) ? fs.readFileSync(trace, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
const specs = {
    A07: ['READY_FOR_PICKUP', 'Chegou_01', async (s) => notifyReadyForPickup(s)],
    A10: ['PICKUP_REMINDER_DAY3', 'Chegou_02', async (s) => notifyShipmentReminder(s, 'day3')],
    A19: ['PICKUP_REMINDER_DAY5', 'Chegou_03', async (s) => notifyShipmentReminder(s, 'day5')],
    P5: ['DELIVERED_THANK_YOU', 'OBRIGADO_PAGOU', notifyDeliveredThankYou],
    P6: ['PICKUP_BONUS', '', notifyPickupBonus],
    P7: ['PRODUCT_USAGE', 'MODO_DE_USO_TEX_ULTRA', notifyProductUsage]
};
const auto = async (id, stage) => specs[stage][2](await Shipment.findById(id));
const manual = async (id, stage, sendFn = null) => {
    const shipment = await Shipment.findById(id).lean();
    const request = { phone: shipment.client.phone, sendMode: 'manual_panel', postSaleShipmentId: String(id),
        message: stage === 'P6' ? LEGACY_PANEL_P6_TEXT_V147R6 : '/media/templates/EC/' + specs[stage][1] + '.ogg', isMedia: stage !== 'P6' };
    return sendCanonicalPanelPostSaleV147R6({ request, operator: 'SINK_OPERATOR',
        sendFn: sendFn || (async () => transport(stage === 'P6' ? 'sendText' : 'sendAudio', [shipment.client.phone, request.message])),
        recordFn: async ({ result }) => Message.create({ _id: 'manual_' + result.providerMessageId,
            isFromMe: true, isBot: false, senderRole: 'human', peerPhone: shipment.client.phone,
            from: 'SINK', to: shipment.client.phone + '@c.us', body: request.isMedia ? '[Audio]' : request.message,
            type: request.isMedia ? 'audio' : 'chat', mediaUrl: request.isMedia ? request.message : '',
            providerMessageId: result.providerMessageId, ack: 2, deliveryStatus: 'delivered', timestamp: Math.floor(Date.now() / 1000) }) });
};
const childMode = process.argv.find((arg) => arg.startsWith('--worker='))?.split('=')[1];
if (childMode || process.argv.includes('--restart')) {
    const [stage, id] = process.argv.slice(-2);
    if (childMode) {
        fs.writeFileSync(path.join(directory, id + '-' + childMode + '.ready'), 'ready');
        const end = Date.now() + 30000;
        while (!fs.existsSync(path.join(directory, id + '-go')) && Date.now() < end) await delay(10);
        assert.ok(fs.existsSync(path.join(directory, id + '-go')));
        if (childMode === 'manual') await manual(id, stage); else await auto(id, stage);
    } else {
        const before = calls().length; await auto(id, stage); await manual(id, stage);
        assert.equal(calls().length, before);
    }
    await mongoose.disconnect(); process.exit(0);
}
assert.equal((await mongoose.connection.db.listCollections().toArray()).length, 0);
let index = 0;
const make = async (stage) => {
    const phone = '593999147' + String(++index).padStart(3, '0');
    const t0 = new Date(Date.now() - 121 * 3600000);
    const state = await ContactState.create({ chatId: phone + '@s.whatsapp.net', phoneDigits: phone, countryCode: 'EC', human: { mode: 'manual', pausedUntil: new Date('2036-01-01') } });
    const pickup = stage.startsWith('A');
    const automation = { lastReminderAt: t0, lastMessageAt: t0 };
    if (['A10', 'A19'].includes(stage)) Object.assign(automation, { readyForPickupNotifiedAt: t0,
        postSaleSafetyLedger: { READY_FOR_PICKUP: { state: 'SENT', acceptedAt: t0, providerMessageId: 'sink-seed-a07' } } });
    if (stage === 'A19') automation.reminderDay3At = t0;
    if (stage === 'P6' || stage === 'P7') automation.deliveredThankYouNotifiedAt = t0;
    if (stage === 'P7') automation.bonusNotifiedAt = t0;
    const shipment = await Shipment.create({ orderId: 'EC-SINK-R6R2-' + index, country: 'EC', client: { phone }, createdAt: new Date(t0.getTime() - 3600000),
        logistics: { status: pickup ? 'READY_FOR_PICKUP' : 'ENTREGADO', canonicalStatus: pickup ? 'READY_FOR_PICKUP' : 'DELIVERED', trackingNumber: '189147' + index,
            agencyPickup: true, pickupReadyVerified: pickup, pickupReadyVerifiedAt: t0, pickupReadyVerifiedSource: 'carrier_tracking', distributionCompany: 'SERVIENTREGA',
            canonicalEvidence: { source: 'carrier_tracking', provider: 'servientrega', rawStatus: pickup ? 'Disponible para retiro' : 'Entregado', observedAt: t0 } },
        raw: { customerId: String(state._id), manualDropiOrderId: '9147' + String(index).padStart(3, '0') }, automation });
    await Order.create({ orderId: shipment.orderId, country: 'EC', currency: 'USD', customer: { phone }, tracking: { productKey: 'tex_ultra_ec' } });
    return shipment;
};
const worker = (args) => {
    const p = spawn(process.execPath, ['--import', './tests/helpers/v147-r4-sink-register.mjs', '--import', './scripts/lib/ec-runtime-successor-v97-context.mjs', fileURLToPath(import.meta.url), ...args],
        { cwd: root, env: { ...process.env, NODE_OPTIONS: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; p.stdout.on('data', (chunk) => { log += chunk; }); p.stderr.on('data', (chunk) => { log += chunk; });
    return new Promise((resolve, reject) => { p.on('error', reject); p.on('exit', (code) => {
        fs.writeFileSync(path.join(directory, 'child-' + p.pid + '.log'), log, { mode: 0o600 });
        if (code !== 0) reject(new Error('SINK child failed ' + p.pid)); else resolve(code);
    }); });
};
const receipt = { transport: 'SINK', realMessagesSent: 0, cases: {} };
try {
    await Promise.all([Shipment.init(), Message.init(), Order.init(), ContactState.init()]);
    // A07 transport integration is pending the operator's text/PDF versus single-call clarification.
    for (const stage of ['A10', 'A19', 'P5', 'P6', 'P7']) {
        const cases = receipt.cases[stage] = {};
        for (const first of ['manual', 'auto']) {
            const s = await make(stage); const before = calls().length;
            if (first === 'manual') { assert.equal((await manual(s._id, stage)).sent, true); await auto(s._id, stage); }
            else { assert.equal(await auto(s._id, stage), true); assert.equal((await manual(s._id, stage)).alreadySatisfied, true); }
            assert.equal(calls().length - before, 1, stage + '_' + first);
            await worker(['--restart', stage, String(s._id)]); assert.equal(calls().length - before, 1);
            cases[first + '_first_and_restart'] = 'PASS';
        }
        const race = await make(stage); const beforeRace = calls().length;
        const children = [worker(['--worker=manual', stage, String(race._id)]), worker(['--worker=auto', stage, String(race._id)])];
        const readyBy = Date.now() + 30000;
        while ((!fs.existsSync(path.join(directory, race._id + '-manual.ready')) || !fs.existsSync(path.join(directory, race._id + '-auto.ready'))) && Date.now() < readyBy) await delay(20);
        assert.ok(fs.existsSync(path.join(directory, race._id + '-manual.ready')) && fs.existsSync(path.join(directory, race._id + '-auto.ready')));
        fs.writeFileSync(path.join(directory, race._id + '-go'), 'go'); await Promise.all(children);
        assert.equal(calls().length - beforeRace, 1, stage + '_race'); cases.raceProviderCalls = 1;
        if (!stage.startsWith('A')) continue;
        const historical = await make(stage);
        const sentAt = new Date(Date.now() - 60000);
        await Message.create({ _id: 'legacy-' + stage, isFromMe: true, isBot: false, senderRole: 'human', peerPhone: historical.client.phone,
            to: historical.client.phone + '@c.us', body: '[Audio]', mediaUrl: '/media/templates/EC/' + specs[stage][1] + '.ogg',
            providerMessageId: 'accepted-before-ledger-' + stage, ack: 2, createdAt: sentAt, timestamp: Math.floor(sentAt.getTime() / 1000) });
        let before = calls().length;
        await auto(historical._id, stage); await worker(['--restart', stage, String(historical._id)]);
        assert.equal(calls().length, before);
        const ledger = (await Shipment.findById(historical._id)).automation.postSaleSafetyLedger[specs[stage][0]];
        assert.equal(ledger.state, 'SATISFIED_BY_EXISTING_MANUAL_SEND'); assert.equal(new Date(ledger.acceptedAt).getTime(), sentAt.getTime());
        cases.preLedgerHistoryAndRestart = 'PASS';
        for (const source of ['manual', 'auto']) {
            const timeout = await make(stage); before = calls().length;
            if (source === 'manual') await assert.rejects(manual(timeout._id, stage, async () => { await transport('sendAudio', [timeout.client.phone, specs[stage][1]]); throw new Error('ambiguous timeout'); }));
            else {
                globalThis.__R4_SINK_SEND = async (...args) => { await transport(...args); throw new Error('ambiguous timeout'); };
                await assert.rejects(auto(timeout._id, stage)); globalThis.__R4_SINK_SEND = transport;
            }
            assert.equal(calls().length - before, 1); await worker(['--restart', stage, String(timeout._id)]);
            assert.equal(calls().length - before, 1); cases[source + '_timeout_no_blind_retry'] = 'PASS';
        }
        const intended = await make(stage); const event = await resolvePostSaleEventV147R6({ shipment: intended, stage: specs[stage][0] });
        assert.equal((await reservePostSaleEventV147R6({ shipment: intended, event, now: new Date(Date.now() - 86400000), lockMs: 1 })).decision, 'SHOULD_SEND');
        before = calls().length; await worker(['--restart', stage, String(intended._id)]); assert.equal(calls().length, before);
        cases.expiredIntendedNoRetry = 'PASS';
        // Change the stored carrier status immediately after the real atomic reservation.
        for (const source of ['manual', 'auto']) {
            const stale = await make(stage); const original = Shipment.findOneAndUpdate;
            Shipment.findOneAndUpdate = async function(query, update, options) {
                const result = await original.call(this, query, update, options);
                if (update?.$set?.['automation.postSaleSafetyLedger.' + specs[stage][0]]?.state === 'INTENDED') {
                    await Shipment.updateOne({ _id: stale._id }, { $set: { 'logistics.status': 'ENTREGADO', 'logistics.canonicalStatus': 'DELIVERED', 'outcomes.delivered': true } });
                }
                return result;
            };
            before = calls().length;
            try { if (source === 'manual') await manual(stale._id, stage); else await auto(stale._id, stage); }
            finally { Shipment.findOneAndUpdate = original; }
            assert.equal(calls().length, before);
            assert.equal((await Shipment.findById(stale._id)).automation.postSaleSafetyLedger[specs[stage][0]].resolution, 'CANCELLED_PICKUP_NO_LONGER_ELIGIBLE');
            cases[source + '_delivered_before_send'] = 'PASS';
        }
    }
    Object.assign(receipt, { status: 'PARTIAL_PASS_A07_PENDING_CLARIFICATION', duplicateMessages: 0, messages: calls() });
    fs.writeFileSync(path.join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
    console.log('V147_R6R2_INDEPENDENT_SINK=PASS');
} finally { await mongoose.disconnect(); }
