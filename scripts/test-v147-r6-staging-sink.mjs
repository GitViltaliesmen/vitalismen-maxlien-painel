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
    const providerMessageId = 'r6-sink-' + crypto.randomUUID();
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
const { notifyDeliveredThankYou, notifyPickupBonus, notifyProductUsage } = await import('../src/services/shipmentMessageService.js');
const { sendCanonicalPanelPostSaleV147R6 } = await import('../src/services/postSaleManualPanelV147R6Service.js');
const { reconcileDeliveredPostSaleSequenceV147R6, resolvePostSaleEventV147R6, reservePostSaleEventV147R6, LEGACY_PANEL_P6_TEXT_V147R6 } = await import('../src/services/postSaleUnifiedEventV147R6Service.js');
const { routeIncomingMessage } = await import('../src/services/agentRouter.js');
const { processShipmentStatusDispatch } = await import('../src/services/shipmentStatusDispatcherService.js');
await mongoose.connect(uri, { autoIndex: true });
const calls = () => fs.existsSync(trace) ? fs.readFileSync(trace, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
const auto = async (id, stage = '') => {
    for (const [key, fn] of [['P5', notifyDeliveredThankYou], ['P6', notifyPickupBonus], ['P7', notifyProductUsage]]) {
        if (!stage || stage === key) await fn(await Shipment.findById(id));
    }
};
const media = { P5: '/media/templates/EC/OBRIGADO_PAGOU.ogg', P7: '/media/templates/EC/MODO_DE_USO_TEX_ULTRA.ogg' };
const manual = async (id, stage, sendFn = null) => {
    const shipment = await Shipment.findById(id).lean();
    const request = { phone: shipment.client.phone, sendMode: 'manual_panel', postSaleShipmentId: String(id),
        message: media[stage] || LEGACY_PANEL_P6_TEXT_V147R6, isMedia: stage !== 'P6' };
    return sendCanonicalPanelPostSaleV147R6({ request, operator: 'SINK_OPERATOR',
        sendFn: sendFn || (async () => transport(stage === 'P6' ? 'sendText' : 'sendAudio', [shipment.client.phone, request.message])),
        recordFn: async ({ result }) => Message.create({ _id: 'manual_' + result.providerMessageId,
            isFromMe: true, isBot: false, senderRole: 'human', peerPhone: shipment.client.phone,
            from: 'SINK', to: shipment.client.phone + '@c.us', body: request.isMedia ? '[Audio]' : request.message,
            type: request.isMedia ? 'audio' : 'chat', mediaUrl: request.isMedia ? request.message : '',
            providerMessageId: result.providerMessageId, ack: 2, deliveryStatus: 'delivered', timestamp: Math.floor(Date.now() / 1000) }) });
};
const childMode = process.argv.find((arg) => arg.startsWith('--worker='))?.split('=')[1];
if (childMode) {
    const id = process.argv.at(-1);
    fs.writeFileSync(path.join(directory, childMode + '.ready'), 'ready');
    const end = Date.now() + 30000;
    while (!fs.existsSync(path.join(directory, 'race-go')) && Date.now() < end) await delay(10);
    assert.ok(fs.existsSync(path.join(directory, 'race-go')));
    if (childMode === 'manual') await manual(id, 'P5'); else await auto(id, 'P5');
    await mongoose.disconnect(); process.exit(0);
}
if (process.argv.includes('--restart')) {
    const before = calls().length;
    await auto(process.argv.at(-1));
    await manual(process.argv.at(-1), 'P5');
    assert.equal(calls().length, before);
    await mongoose.disconnect(); console.log('RESTART_IDEMPOTENCY=PASS'); process.exit(0);
}
assert.equal((await mongoose.connection.db.listCollections().toArray()).length, 0);
let index = 0;
const make = async (product = 'tex_ultra_ec', extra = {}) => {
    const phone = '593999146' + String(++index).padStart(3, '0');
    const state = await ContactState.create({ chatId: phone + '@s.whatsapp.net', phoneDigits: phone, countryCode: 'EC', human: { mode: 'manual', pausedUntil: new Date('2036-01-01') } });
    const shipment = await Shipment.create({ orderId: 'EC-SINK-R6-' + index, country: 'EC', client: { phone },
        logistics: { status: 'ENTREGADO', canonicalStatus: 'DELIVERED', trackingNumber: '189146' + index,
            distributionCompany: 'SERVIENTREGA', canonicalEvidence: { source: 'carrier_tracking', provider: 'servientrega', rawStatus: 'Entregado', observedAt: new Date(Date.now() - 60000) } },
        raw: { customerId: String(state._id), manualDropiOrderId: '9146' + String(index).padStart(3, '0') }, ...extra });
    if (product) await Order.create({ orderId: shipment.orderId, country: 'EC', currency: 'USD', customer: { phone }, tracking: { productKey: product } });
    return { shipment, state };
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
    for (const [name, first] of [['manual_first', 'manual'], ['v116_first', 'auto']]) {
        const { shipment } = await make(); const before = calls().length;
        if (first === 'manual') { assert.equal((await manual(shipment._id, 'P5')).sent, true); await auto(shipment._id, 'P5'); }
        else { await auto(shipment._id, 'P5'); assert.equal((await manual(shipment._id, 'P5')).alreadySatisfied, true); }
        assert.equal(calls().length - before, 1); receipt.cases[name] = 'PASS';
    }
    const { shipment: race } = await make(); const raceBefore = calls().length;
    const children = [worker(['--worker=manual', String(race._id)]), worker(['--worker=auto', String(race._id)])];
    const readyBy = Date.now() + 30000;
    while ((!fs.existsSync(path.join(directory, 'manual.ready')) || !fs.existsSync(path.join(directory, 'auto.ready'))) && Date.now() < readyBy) await delay(20);
    assert.ok(fs.existsSync(path.join(directory, 'manual.ready')) && fs.existsSync(path.join(directory, 'auto.ready')));
    fs.writeFileSync(path.join(directory, 'race-go'), 'go'); await Promise.all(children);
    assert.equal(calls().length - raceBefore, 1); receipt.cases.two_process_race_provider_calls = 1;
    const { shipment: allManual } = await make();
    for (const stage of ['P5', 'P6', 'P7']) assert.equal((await manual(allManual._id, stage)).sent, true);
    let before = calls().length; await auto(allManual._id); assert.equal(calls().length, before);
    await worker(['--restart', String(allManual._id)]); assert.equal(calls().length, before); receipt.cases.all_manual_and_restart = 'PASS';
    const { shipment: partial } = await make(); await manual(partial._id, 'P5'); before = calls().length;
    await auto(partial._id); assert.equal(calls().length - before, 2); receipt.cases.manual_p5_continues_p6_p7 = 'PASS';
    for (const stage of ['P6', 'P7']) {
        const { shipment } = await make(); await manual(shipment._id, stage); before = calls().length;
        await auto(shipment._id); assert.equal(calls().length - before, 2); receipt.cases['manual_' + stage + '_not_repeated'] = 'PASS';
    }
    const { shipment: ambiguous } = await make();
    await assert.rejects(manual(ambiguous._id, 'P5', async () => { await transport('sendAudio', [ambiguous.client.phone, media.P5]); throw new Error('provider timeout'); }));
    before = calls().length; await auto(ambiguous._id); await manual(ambiguous._id, 'P5');
    assert.equal(calls().length, before); receipt.cases.ambiguous_no_blind_retry = 'PASS';
    await worker(['--restart', String(ambiguous._id)]); assert.equal(calls().length, before);
    const { shipment: autoTimeout } = await make();
    globalThis.__R4_SINK_SEND = async (...args) => { await transport(...args); throw new Error('automatic provider timeout'); };
    await assert.rejects(auto(autoTimeout._id, 'P5'));
    globalThis.__R4_SINK_SEND = transport;
    before = calls().length; await worker(['--restart', String(autoTimeout._id)]); assert.equal(calls().length, before);
    receipt.cases.automatic_timeout_restart_no_retry = 'PASS';
    const { shipment: intended } = await make();
    const intendedEvent = await resolvePostSaleEventV147R6({ shipment: intended, stage: 'DELIVERED_THANK_YOU' });
    assert.equal((await reservePostSaleEventV147R6({ shipment: intended, event: intendedEvent,
        now: new Date(Date.now() - 86400000), lockMs: 1 })).decision, 'SHOULD_SEND');
    before = calls().length; await worker(['--restart', String(intended._id)]); assert.equal(calls().length, before);
    receipt.cases.expired_lock_intended_process_restart = 'PASS';
    const { shipment: unknown, state: held } = await make(''); before = calls().length;
    await auto(unknown._id); assert.equal(calls().length - before, 2);
    await routeIncomingMessage({ from: held.chatId, senderPn: held.phoneDigits, body: 'Quiero comprar otro frasco', id: 'r6-sink-commercial' });
    assert.equal(calls().length - before, 2); assert.equal((await ContactState.findById(held._id)).human.mode, 'manual'); receipt.cases.unknown_product_and_commercial_takeover = 'PASS';
    const fixturePath = process.env.V147_R6_FIXTURE;
    assert.ok(fixturePath?.startsWith('/var/lib/vitalismen-deploy/evidence/v147-r6-'));
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const originalMessages = JSON.stringify(fixture.messages); const fakePhone = '593999146999';
    const replacePhone = (value) => JSON.parse(JSON.stringify(value).replaceAll('593992418689', fakePhone));
    const replay = replacePhone(fixture.shipment); const order = replacePhone(fixture.order);
    await ContactState.create({ _id: fixture.state._id, chatId: fakePhone + '@s.whatsapp.net', phoneDigits: fakePhone, countryCode: 'EC', human: { mode: 'manual', pausedUntil: new Date('2036-01-01') } });
    await Shipment.create(replay); await Order.create(order);
    await Message.insertMany(replacePhone(fixture.messages));
    const messageSnapshot = JSON.stringify(await Message.find({ peerPhone: fakePhone }).sort({ _id: 1 }).lean());
    before = calls().length;
    const replayDispatch = await processShipmentStatusDispatch({ limit: 1, actions: ['delivered_bonus'], canonicalPollCompleted: true, activationWatermark: new Date().toISOString() });
    assert.ok(replayDispatch.results.some((row) => row.orderId === '6886247'), JSON.stringify(replayDispatch));
    await auto(replay._id);
    for (const stage of ['P5', 'P6', 'P7']) assert.equal((await manual(replay._id, stage)).alreadySatisfied, true);
    const final = await Shipment.findById(replay._id).lean();
    assert.ok(final.automation.deliveredThankYouNotifiedAt && final.automation.bonusNotifiedAt && final.automation.usageNotifiedAt);
    assert.equal(final.automation.postSaleSafetyLedger.DELIVERED_THANK_YOU.duplicateIncidentCount, 1);
    assert.equal(final.automation.postSaleSafetyLedger.PICKUP_BONUS.state, 'SATISFIED_BY_EXISTING_MANUAL_SEND');
    assert.ok(final.automation.postSaleSafetyLedger.PICKUP_BONUS.priorEntries.some((entry) => entry.state === 'FAILED_FINAL'));
    assert.equal(calls().length, before);
    assert.equal(JSON.stringify(await Message.find({ peerPhone: fakePhone }).sort({ _id: 1 }).lean()), messageSnapshot);
    assert.equal(JSON.stringify(fixture.messages), originalMessages);
    await worker(['--restart', String(replay._id)]); assert.equal(calls().length, before);
    receipt.cases.replay6886247 = { providerCalls: 0, P5: 'SATISFIED', P6: final.automation.postSaleSafetyLedger.PICKUP_BONUS.state, P7: 'SATISFIED', duplicateIncidentCount: 1, messagesPreserved: true, failedFinalPreservedInHistory: true };
    // Isolate the dispatcher continuation cases from earlier intentionally incomplete SINK fixtures.
    await Shipment.updateMany({}, { $set: { 'review.manualOnly': true } });
    globalThis.__R4_TRACK = async ({ trackingNumber }) => ({ ok: true, carrier: 'servientrega', trackingNumber,
        statusAtual: 'Entregado', canonicalStatus: 'DELIVERED', normalizedStatus: 'ENTREGADO' });
    for (const stage of ['P5', 'P6', 'P7']) {
        const { shipment } = await make('tex_ultra_ec', { automation: { dropiSubmitAuthorizedAt: new Date(), dropiSubmitAuthorizedBy: 'SINK_OPERATOR' } });
        await manual(shipment._id, stage); before = calls().length;
        const dispatched = await processShipmentStatusDispatch({ limit: 1, actions: ['delivered_bonus'], canonicalPollCompleted: true, activationWatermark: new Date().toISOString() });
        const sent = calls().slice(before).filter((row) => row.phone.startsWith(shipment.client.phone));
        assert.equal(sent.length, 2, JSON.stringify(dispatched));
        const stored = await Shipment.findById(shipment._id);
        assert.ok(stored.automation.deliveredThankYouNotifiedAt && stored.automation.bonusNotifiedAt && stored.automation.usageNotifiedAt);
        receipt.cases['official_dispatch_manual_' + stage + '_continues_remaining'] = 'PASS';
    }
    Object.assign(receipt, { status: 'PASS', manualV116RaceProviderCalls: 1, duplicateMessages: 0, noBlindRetry: 'PASS', restartIdempotency: 'PASS', messages: calls() });
    fs.writeFileSync(path.join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
    console.log('V147_R6_STAGING_SINK=PASS');
} finally { await mongoose.disconnect(); }
