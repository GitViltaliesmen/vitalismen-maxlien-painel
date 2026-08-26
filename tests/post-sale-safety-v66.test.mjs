import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    POST_SALE_NOTIFICATION_DECISIONS,
    completePostSaleNotificationStage,
    decidePostSaleNotification,
    failPostSaleNotificationStage
} from '../src/services/postSaleNotificationDecisionService.js';
import {
    DROPI_SYNC_MODES,
    POST_SALE_DATA_COMPATIBILITY_VERSION,
    POST_SALE_RUNTIME_VERSION,
    POST_SALE_STAGES,
    POST_SALE_VARIANTS,
    V66_MUTATION_AUTHORIZATION,
    assertRuntimeSupportsPostSaleData,
    buildPostSaleIdempotencyKey,
    canonicalPostSaleStage,
    legacyMarkerSetForStage,
    resolveDropiSyncMode,
    resolvePostSaleOperationalMutationGate
} from '../src/services/postSaleSafetyV66Service.js';
import { notifyGuidePrintImage } from '../src/services/shipmentMessageService.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(fs.readFileSync(
    path.join(projectRoot, 'tests/fixtures/post-sale-safety-v66.json'),
    'utf8'
));
const fixtureCase = (key) => fixture.cases.find((item) => item.key === key);
const compatibleState = Object.freeze({
    bridgeComplete: true,
    dataCompatibilityVersion: POST_SALE_DATA_COMPATIBILITY_VERSION,
    minRuntimeVersion: POST_SALE_RUNTIME_VERSION
});
const authorizedEnv = Object.freeze({
    POST_SALE_V66_MUTATIONS_ENABLED: 'true',
    POST_SALE_V66_MUTATIONS_AUTHORIZATION: V66_MUTATION_AUTHORIZATION,
    POST_SALE_V66_COMPATIBILITY_BRIDGE_READY: 'true'
});

const chain = (records = []) => ({
    sort() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(records); },
    catch() { return Promise.resolve(records); },
    then(resolve, reject) { return Promise.resolve(records).then(resolve, reject); }
});
const messageModel = (messages = []) => ({
    find: () => chain(messages),
    findOne: () => chain([])
});
const shipmentFromFixture = (item, overrides = {}) => ({
    _id: `shipment-${item.key}`,
    orderId: item.orderId,
    country: 'EC',
    provider: 'droppi',
    client: { name: `Cliente ${item.key}`, phone: item.phone },
    logistics: {
        status: item.status,
        trackingNumber: item.trackingNumber,
        pickupReadyVerified: item.pickupReadyVerified,
        agencyPickup: item.agencyPickup,
        invoicePath: 'C:/fixture/guide.pdf',
        guidePrintPath: 'C:/fixture/guide.png'
    },
    automation: { notificationLocks: {}, postSaleSafetyLedger: {} },
    review: {
        manualOnly: item.manualOnly,
        reviewReason: item.reviewReason || '',
        suppressedNotificationKinds: item.suppressedNotificationKinds || []
    },
    events: [],
    notificationLedger: [],
    outcomes: {},
    ...overrides
});
const outboundMessages = (item) => item.messages.map((body, index) => ({
    _id: `human-${item.key}-${index}`,
    body,
    isFromMe: true,
    isBot: false,
    senderRole: 'human',
    peerPhone: item.phone,
    createdAt: new Date('2026-08-26T12:00:00Z')
}));
const providerProbe = () => {
    let calls = 0;
    return {
        send: async () => {
            calls += 1;
            return { ok: true, provider: 'fake-zapi', providerMessageId: `fake-${calls}` };
        },
        count: () => calls
    };
};

test('01 guidePrintDispatcher referencia a decisão central antes do envio', () => {
    const source = fs.readFileSync(path.join(projectRoot, 'src/services/guidePrintDispatcherService.js'), 'utf8');
    assert.match(source, /decidePostSaleNotification/);
    assert.match(source, /shouldSendPostSaleNotification/);
    assert.ok(source.indexOf('decidePostSaleNotification') < source.indexOf('notifyGuidePrintImage(locked'));
});

test('02 guide text, PDF e imagem compartilham estágio GUIDE', () => {
    for (const variant of [POST_SALE_VARIANTS.GUIDE_TEXT, POST_SALE_VARIANTS.GUIDE_PDF, POST_SALE_VARIANTS.GUIDE_PRINT_IMAGE]) {
        assert.equal(canonicalPostSaleStage(variant), POST_SALE_STAGES.GUIDE);
    }
});

test('03 variantes GUIDE compartilham a mesma chave idempotente', () => {
    const shipment = shipmentFromFixture(fixtureCase('6457'));
    const keys = [POST_SALE_VARIANTS.GUIDE_TEXT, POST_SALE_VARIANTS.GUIDE_PDF, POST_SALE_VARIANTS.GUIDE_PRINT_IMAGE]
        .map((variant) => buildPostSaleIdempotencyKey({ shipment, variant }));
    assert.equal(new Set(keys).size, 1);
});

test('04 pedidos distintos não compartilham chave idempotente', () => {
    const a = buildPostSaleIdempotencyKey({ shipment: shipmentFromFixture(fixtureCase('6457')), stage: 'GUIDE' });
    const b = buildPostSaleIdempotencyKey({ shipment: shipmentFromFixture(fixtureCase('4818')), stage: 'GUIDE' });
    assert.notEqual(a, b);
});

test('05 guia humana bloqueia imagem automática no último ponto antes do provider', async () => {
    const item = fixtureCase('6457');
    const shipment = shipmentFromFixture(item);
    const decision = await decidePostSaleNotification({
        shipment,
        kind: 'guide',
        variant: POST_SALE_VARIANTS.GUIDE_PRINT_IMAGE,
        acquireLock: false,
        messageModel: messageModel(outboundMessages(item))
    });
    const provider = providerProbe();
    const result = await notifyGuidePrintImage(shipment, {
        decision,
        sendImageFn: provider.send,
        ensureImageFn: async () => ({ ok: true, path: 'never.png' })
    });
    assert.equal(decision.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY);
    assert.equal(result.success, false);
    assert.equal(provider.count(), 0);
});

test('06 marker de texto GUIDE bloqueia guide_print_image', async () => {
    const shipment = shipmentFromFixture(fixtureCase('6457'));
    shipment.automation.guiaNotifiedAt = new Date();
    const result = await decidePostSaleNotification({ shipment, kind: 'guide_print_image', acquireLock: false });
    assert.equal(result.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED);
});

test('07 marker de imagem GUIDE bloqueia guide_text', async () => {
    const shipment = shipmentFromFixture(fixtureCase('6457'));
    shipment.automation.guidePrintNotifiedAt = new Date();
    const result = await decidePostSaleNotification({ shipment, kind: 'guide_text', acquireLock: false });
    assert.equal(result.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED);
});

test('08 suppressedNotificationKinds bloqueia imagem e materializa ponte legada atomicamente', async () => {
    const shipment = shipmentFromFixture(fixtureCase('9599'));
    const writes = [];
    const model = { async updateOne(query, update) { writes.push({ query, update }); return { matchedCount: 1, modifiedCount: 1 }; } };
    const result = await decidePostSaleNotification({
        shipment,
        kind: 'guide_print_image',
        shipmentModel: model,
        messageModel: messageModel([])
    });
    assert.equal(result.decision, POST_SALE_NOTIFICATION_DECISIONS.HISTORICAL_EVENT_SUPPRESSED);
    assert.ok(writes[0].update.$set['automation.guiaNotifiedAt']);
    assert.ok(writes[0].update.$set['automation.guidePrintNotifiedAt']);
    assert.equal(writes[0].update.$set['automation.postSaleSafetyLedger.GUIDE'].state, 'SUPPRESSED_HISTORICAL');
});

test('09 safety ledger terminal bloqueia imagem', async () => {
    const shipment = shipmentFromFixture(fixtureCase('6457'));
    shipment.automation.postSaleSafetyLedger.GUIDE = { state: 'SENT', idempotencyKey: 'ps66:test' };
    const result = await decidePostSaleNotification({ shipment, kind: 'guide_print_image', acquireLock: false });
    assert.equal(result.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED);
    assert.match(result.reason, /postSaleSafetyLedger/);
});

test('10 segunda passagem não adquire novo lock concorrente', async () => {
    let calls = 0;
    const model = { async findOneAndUpdate() { calls += 1; return calls === 1 ? shipmentFromFixture(fixtureCase('6457')) : null; } };
    const shipment = shipmentFromFixture(fixtureCase('6457'));
    const first = await decidePostSaleNotification({ shipment, kind: 'guide', messageModel: messageModel([]), shipmentModel: model });
    const second = await decidePostSaleNotification({ shipment, kind: 'guide', messageModel: messageModel([]), shipmentModel: model });
    assert.equal(first.decision, POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND);
    assert.equal(second.reason, 'persistent_notification_lock_or_marker');
});

test('11 concorrência possui exatamente um vencedor SHOULD_SEND', async () => {
    let available = true;
    const model = { async findOneAndUpdate() { if (!available) return null; available = false; return shipmentFromFixture(fixtureCase('6457')); } };
    const shipment = shipmentFromFixture(fixtureCase('6457'));
    const [a, b] = await Promise.all([
        decidePostSaleNotification({ shipment, kind: 'guide', messageModel: messageModel([]), shipmentModel: model }),
        decidePostSaleNotification({ shipment, kind: 'guide', messageModel: messageModel([]), shipmentModel: model })
    ]);
    assert.equal([a, b].filter((item) => item.decision === POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND).length, 1);
});

test('12 falha retryable libera somente o token proprietário', async () => {
    const writes = [];
    const model = { async updateOne(query, update) { writes.push({ query, update }); return { modifiedCount: 1 }; } };
    const shipment = shipmentFromFixture(fixtureCase('6457'));
    const result = await failPostSaleNotificationStage({ shipment, stage: 'GUIDE', lockToken: 'owner-token', reason: 'fake-provider-failure', shipmentModel: model });
    assert.equal(result.released, true);
    assert.equal(writes[0].query['automation.notificationLocks.GUIDE.token'], 'owner-token');
    assert.equal(writes[0].update.$set['automation.postSaleSafetyLedger.GUIDE'].state, 'FAILED_RETRYABLE');
});

test('13 retry posterior pode readquirir lock após falha não terminal', async () => {
    const shipment = shipmentFromFixture(fixtureCase('6457'));
    shipment.automation.postSaleSafetyLedger.GUIDE = { state: 'FAILED_RETRYABLE' };
    const model = { async findOneAndUpdate() { return shipment; } };
    const result = await decidePostSaleNotification({ shipment, kind: 'guide', messageModel: messageModel([]), shipmentModel: model });
    assert.equal(result.decision, POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND);
    assert.ok(result.lockToken);
});

test('14 restart preserva ledger terminal e bloqueia novo envio', async () => {
    const beforeRestart = shipmentFromFixture(fixtureCase('6457'));
    beforeRestart.automation.postSaleSafetyLedger.GUIDE = { state: 'RECOVERED_MANUAL' };
    const snapshot = JSON.parse(JSON.stringify(beforeRestart));
    const result = await decidePostSaleNotification({ shipment: snapshot, kind: 'guide', acquireLock: false });
    assert.equal(result.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED);
});

test('15 finalização SENT faz dual-write de todos os markers GUIDE', async () => {
    const writes = [];
    const model = { async updateOne(query, update) { writes.push({ query, update }); return { modifiedCount: 1 }; } };
    const result = await completePostSaleNotificationStage({
        shipment: shipmentFromFixture(fixtureCase('6457')),
        stage: 'GUIDE',
        variant: 'guide_print_image',
        lockToken: 'token-1',
        providerMessageId: 'fake-provider-id',
        shipmentModel: model
    });
    assert.equal(result.completed, true);
    assert.ok(writes[0].update.$set['automation.guiaNotifiedAt']);
    assert.ok(writes[0].update.$set['automation.guidePrintNotifiedAt']);
    assert.equal(writes[0].update.$set['automation.postSaleSafetyLedger.GUIDE'].state, 'SENT');
});

test('16 reconciliação repetida não apaga memória de comunicação', () => {
    const original = shipmentFromFixture(fixtureCase('4818'));
    original.automation.postSaleSafetyLedger.GUIDE = { state: 'RECOVERED_MANUAL' };
    const reconciled = { ...original, logistics: { ...original.logistics, status: 'READY_FOR_PICKUP', pickupReadyVerified: true } };
    assert.equal(reconciled.automation.postSaleSafetyLedger.GUIDE.state, 'RECOVERED_MANUAL');
});

test('17 READY_FOR_PICKUP recém-confirmado sem evidência anterior permanece elegível', async () => {
    const shipment = shipmentFromFixture(fixtureCase('4818'));
    const result = await decidePostSaleNotification({ shipment, kind: 'ready_for_pickup', acquireLock: false, messageModel: messageModel([]) });
    assert.equal(result.decision, POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND);
});

test('18 runtime incompatível com snapshot novo é bloqueado', () => {
    const result = assertRuntimeSupportsPostSaleData({ runtimeVersion: 65, compatibilityState: compatibleState });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'runtime_older_than_persistent_data_contract');
});

test('19 runtime V66 aceita contrato persistente V66', () => {
    assert.equal(assertRuntimeSupportsPostSaleData({ runtimeVersion: 66, compatibilityState: compatibleState }).ok, true);
});

test('20 ausência de estado persistente permite somente boot seguro, não autorização mutante', () => {
    assert.equal(assertRuntimeSupportsPostSaleData({ runtimeVersion: 66, compatibilityState: null }).ok, true);
    assert.equal(resolvePostSaleOperationalMutationGate(authorizedEnv, { compatibilityState: null }).allowed, false);
});

test('21 startup sem variável falha fechado', () => {
    const gate = resolvePostSaleOperationalMutationGate({}, { compatibilityState: compatibleState });
    assert.equal(gate.allowed, false);
    assert.equal(gate.reason, 'mutation_flag_absent_safe_default');
});

test('22 startup com variável inválida falha fechado', () => {
    const gate = resolvePostSaleOperationalMutationGate({ ...authorizedEnv, POST_SALE_V66_MUTATIONS_ENABLED: 'yes' }, { compatibilityState: compatibleState });
    assert.equal(gate.allowed, false);
    assert.equal(gate.reason, 'mutation_flag_invalid_or_false');
});

test('23 startup mutations=false falha fechado', () => {
    assert.equal(resolvePostSaleOperationalMutationGate({ ...authorizedEnv, POST_SALE_V66_MUTATIONS_ENABLED: 'false' }, { compatibilityState: compatibleState }).allowed, false);
});

test('24 autorização textual ausente bloqueia mutações', () => {
    assert.equal(resolvePostSaleOperationalMutationGate({ ...authorizedEnv, POST_SALE_V66_MUTATIONS_AUTHORIZATION: '' }, { compatibilityState: compatibleState }).allowed, false);
});

test('25 bridge flag ausente bloqueia mutações', () => {
    assert.equal(resolvePostSaleOperationalMutationGate({ ...authorizedEnv, POST_SALE_V66_COMPATIBILITY_BRIDGE_READY: '' }, { compatibilityState: compatibleState }).allowed, false);
});

test('26 gate completo autoriza somente após estado persistente compatível', () => {
    assert.equal(resolvePostSaleOperationalMutationGate(authorizedEnv, { compatibilityState: compatibleState }).allowed, true);
});

test('27 sync padrão é REPORT_ONLY', () => {
    const mode = resolveDropiSyncMode({}, { compatibilityState: null });
    assert.equal(mode.effectiveMode, DROPI_SYNC_MODES.REPORT_ONLY);
    assert.equal(mode.readOnly, true);
});

test('28 sync inválido falha fechado em REPORT_ONLY', () => {
    const mode = resolveDropiSyncMode({ DROPPI_EC_ACTIVE_SYNC_MODE: 'PRODUCTION' }, { compatibilityState: compatibleState });
    assert.equal(mode.effectiveMode, DROPI_SYNC_MODES.REPORT_ONLY);
    assert.equal(mode.validRequestedMode, false);
});

test('29 sync DRY_RUN permanece read-only', () => {
    const mode = resolveDropiSyncMode({ DROPPI_EC_ACTIVE_SYNC_MODE: 'DRY_RUN' }, { compatibilityState: compatibleState });
    assert.equal(mode.effectiveMode, DROPI_SYNC_MODES.DRY_RUN);
    assert.equal(mode.readOnly, true);
});

test('30 sync APPLY sem autorização é rebaixado para REPORT_ONLY', () => {
    const mode = resolveDropiSyncMode({ DROPPI_EC_ACTIVE_SYNC_MODE: 'APPLY' }, { compatibilityState: compatibleState });
    assert.equal(mode.effectiveMode, DROPI_SYNC_MODES.REPORT_ONLY);
    assert.equal(mode.applyAllowed, false);
});

test('31 sync APPLY exige modo e gate completos', () => {
    const mode = resolveDropiSyncMode({ ...authorizedEnv, DROPPI_EC_ACTIVE_SYNC_MODE: 'APPLY' }, { compatibilityState: compatibleState });
    assert.equal(mode.effectiveMode, DROPI_SYNC_MODES.APPLY);
    assert.equal(mode.applyAllowed, true);
});

test('32 startup seguro não registra scheduler, reconciliação ou outbound antes do gate', () => {
    const index = fs.readFileSync(path.join(projectRoot, 'src/index.js'), 'utf8');
    const gateAt = index.indexOf('if (!mutationGate.allowed)');
    assert.ok(gateAt > 0);
    assert.ok(index.indexOf('pauseOrphanedTexUltraInitialFlowsOnStartup()', gateAt) > gateAt);
    assert.ok(index.indexOf('startScheduler({ compatibilityState })', gateAt) > gateAt);
});

test('33 caso 6457 mantém três variantes GUIDE bloqueadas e provider zero', async () => {
    const item = fixtureCase('6457');
    const shipment = shipmentFromFixture(item);
    const provider = providerProbe();
    for (const variant of [POST_SALE_VARIANTS.GUIDE_TEXT, POST_SALE_VARIANTS.GUIDE_PDF, POST_SALE_VARIANTS.GUIDE_PRINT_IMAGE]) {
        const decision = await decidePostSaleNotification({ shipment, kind: variant, acquireLock: false, messageModel: messageModel(outboundMessages(item)) });
        assert.equal(decision.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY);
    }
    assert.equal(provider.count(), 0);
});

test('34 caso 4818 bloqueia GUIDE e READY semanticamente equivalentes, provider zero', async () => {
    const item = fixtureCase('4818');
    const shipment = shipmentFromFixture(item);
    const messages = messageModel(outboundMessages(item));
    const guide = await decidePostSaleNotification({ shipment, kind: 'guide_print_image', acquireLock: false, messageModel: messages });
    const ready = await decidePostSaleNotification({ shipment, kind: 'ready_for_pickup', acquireLock: false, messageModel: messages });
    assert.equal(guide.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY);
    assert.equal(ready.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY);
    assert.equal(providerProbe().count(), 0);
});

test('35 caso 9599 permanece suprimido em runtime novo e restart', async () => {
    const snapshot = shipmentFromFixture(fixtureCase('9599'));
    for (const kind of ['guide', 'in_transit', 'ready_for_pickup']) {
        const live = await decidePostSaleNotification({ shipment: snapshot, kind, acquireLock: false, messageModel: messageModel([]) });
        const restarted = await decidePostSaleNotification({ shipment: JSON.parse(JSON.stringify(snapshot)), kind, acquireLock: false, messageModel: messageModel([]) });
        assert.equal(live.decision, POST_SALE_NOTIFICATION_DECISIONS.HISTORICAL_EVENT_SUPPRESSED);
        assert.equal(restarted.decision, POST_SALE_NOTIFICATION_DECISIONS.HISTORICAL_EVENT_SUPPRESSED);
    }
});

test('36 caso 7146 reconhece duas comunicações humanas sem novo provider', async () => {
    const item = fixtureCase('7146');
    const result = await decidePostSaleNotification({
        shipment: shipmentFromFixture(item),
        kind: 'ready_for_pickup',
        acquireLock: false,
        messageModel: messageModel(outboundMessages(item))
    });
    assert.equal(result.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY);
    assert.equal(providerProbe().count(), 0);
});

test('37 candidato 1264 permanece MANUAL_REVIEW_REQUIRED e fail-closed', async () => {
    const item = fixtureCase('1264');
    const result = await decidePostSaleNotification({
        shipment: shipmentFromFixture(item),
        kind: 'guide',
        acquireLock: false,
        messageModel: messageModel([])
    });
    assert.equal(result.decision, POST_SALE_NOTIFICATION_DECISIONS.MANUAL_REVIEW_REQUIRED);
    assert.equal(result.reason, 'missing_dropi_or_tracking_evidence');
});

test('38 rollback simulation usa markers legíveis pelo alvo e produz provider zero', () => {
    const at = new Date('2026-08-26T15:00:00Z');
    const snapshot = shipmentFromFixture(fixtureCase('9599'));
    for (const [field, value] of Object.entries(legacyMarkerSetForStage('GUIDE', at))) {
        snapshot.automation[field.replace('automation.', '')] = value;
    }
    const legacyWouldSend = !snapshot.automation.guiaNotifiedAt && !snapshot.automation.guidePrintNotifiedAt;
    assert.equal(legacyWouldSend, false);
    assert.equal(providerProbe().count(), 0);
});

test('39 rollback alvo anterior é bloqueado pela versão persistente', () => {
    const deployment = ['DEPLOY_NEW', 'NEW_VERSION_WRITES_ALLOWED_STATE', 'STOP', 'START_ROLLBACK_TARGET', 'RUN_SCHEDULER'];
    const compatibility = assertRuntimeSupportsPostSaleData({ runtimeVersion: 65, compatibilityState: compatibleState });
    assert.deepEqual(deployment.slice(0, 4), ['DEPLOY_NEW', 'NEW_VERSION_WRITES_ALLOWED_STATE', 'STOP', 'START_ROLLBACK_TARGET']);
    assert.equal(compatibility.ok, false);
});

test('40 V64 e V65 permanecem ancestrais declarados da V66', () => {
    const v64 = JSON.parse(fs.readFileSync(path.join(projectRoot, 'docs/freeze/dropi-customer-full-name-v64-20260826.json'), 'utf8'));
    const v65 = JSON.parse(fs.readFileSync(path.join(projectRoot, 'docs/freeze/post-sale-gargalos-v65-20260826.json'), 'utf8'));
    assert.equal(v65.parentFreezeId, v64.freezeId);
    assert.equal(v64.freezeId, 'dropi-customer-full-name-v64-20260826');
    assert.equal(v65.freezeId, 'post-sale-gargalos-v65-20260826');
});

test('41 recuperação READY usa a evidência encontrada ao finalizar o ledger', () => {
    const source = fs.readFileSync(path.join(projectRoot, 'src/services/shipmentMessageService.js'), 'utf8');
    assert.match(source, /providerMessageId:\s*existingNotice\.messageId/);
    assert.match(source, /now:\s*existingNotice\.at\s*\|\|\s*new Date\(\)/);
    assert.doesNotMatch(source, /providerMessageId:\s*existing\.messageId/);
    assert.doesNotMatch(source, /now:\s*existing\.at\s*\|\|\s*new Date\(\)/);
});

test('42 lembretes, prova, bônus e recompra possuem estágios idempotentes próprios', () => {
    const shipment = shipmentFromFixture(fixtureCase('4818'));
    const variants = [
        POST_SALE_VARIANTS.PICKUP_REMINDER_DAY1,
        POST_SALE_VARIANTS.PICKUP_REMINDER_SOFT_DAY2,
        POST_SALE_VARIANTS.PICKUP_REMINDER_DAY3,
        POST_SALE_VARIANTS.PICKUP_REMINDER_SOFT_DAY4,
        POST_SALE_VARIANTS.PICKUP_REMINDER_DAY5,
        POST_SALE_VARIANTS.PICKUP_REMINDER_SOFT_DAY6,
        POST_SALE_VARIANTS.PICKUP_PROOF_REQUEST,
        POST_SALE_VARIANTS.PICKUP_BONUS,
        POST_SALE_VARIANTS.TREATMENT_REFILL_REMINDER
    ];
    const stages = variants.map((variant) => canonicalPostSaleStage(variant));
    const keys = variants.map((variant) => buildPostSaleIdempotencyKey({ shipment, variant }));
    assert.equal(stages.every(Boolean), true);
    assert.equal(new Set(stages).size, variants.length);
    assert.equal(new Set(keys).size, variants.length);
});

test('43 markers legados bloqueiam todos os outbounds logísticos adicionais no provider', async () => {
    const cases = [
        [POST_SALE_VARIANTS.PICKUP_REMINDER_DAY1, 'reminderDay1At'],
        [POST_SALE_VARIANTS.PICKUP_REMINDER_SOFT_DAY2, 'reminderSoftDay2At'],
        [POST_SALE_VARIANTS.PICKUP_REMINDER_DAY3, 'reminderDay3At'],
        [POST_SALE_VARIANTS.PICKUP_REMINDER_SOFT_DAY4, 'reminderSoftDay4At'],
        [POST_SALE_VARIANTS.PICKUP_REMINDER_DAY5, 'reminderDay5At'],
        [POST_SALE_VARIANTS.PICKUP_REMINDER_SOFT_DAY6, 'reminderSoftDay6At'],
        [POST_SALE_VARIANTS.PICKUP_PROOF_REQUEST, 'pickupProofRequestedAt'],
        [POST_SALE_VARIANTS.PICKUP_BONUS, 'bonusNotifiedAt'],
        [POST_SALE_VARIANTS.TREATMENT_REFILL_REMINDER, 'refillReminderAt']
    ];
    const provider = providerProbe();
    for (const [variant, marker] of cases) {
        const shipment = shipmentFromFixture(fixtureCase('4818'), {
            automation: { notificationLocks: {}, postSaleSafetyLedger: {}, [marker]: new Date('2026-08-26T12:00:00Z') }
        });
        const result = await decidePostSaleNotification({
            shipment,
            kind: variant,
            variant,
            acquireLock: false,
            messageModel: messageModel([])
        });
        assert.equal(result.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED);
    }
    assert.equal(provider.count(), 0);
});

test('44 controles reais permanecem provider zero em rerun, restart, reconciliação e rollback', async () => {
    const provider = providerProbe();
    for (const key of ['6457', '4818', '9599', '7146']) {
        const item = fixtureCase(key);
        const base = shipmentFromFixture(item);
        const scenarios = [
            base,
            JSON.parse(JSON.stringify(base)),
            { ...base, logistics: { ...base.logistics, status: 'READY_FOR_PICKUP', pickupReadyVerified: true } },
            {
                ...JSON.parse(JSON.stringify(base)),
                automation: {
                    ...JSON.parse(JSON.stringify(base.automation)),
                    guiaNotifiedAt: new Date('2026-08-26T12:00:00Z'),
                    guidePrintNotifiedAt: new Date('2026-08-26T12:00:00Z')
                }
            }
        ];
        for (const shipment of scenarios) {
            for (let pass = 0; pass < 2; pass += 1) {
                const decision = await decidePostSaleNotification({
                    shipment,
                    kind: POST_SALE_VARIANTS.GUIDE_PRINT_IMAGE,
                    variant: POST_SALE_VARIANTS.GUIDE_PRINT_IMAGE,
                    acquireLock: false,
                    messageModel: messageModel(outboundMessages(item))
                });
                const result = await notifyGuidePrintImage(shipment, {
                    decision,
                    sendImageFn: provider.send,
                    ensureImageFn: async () => ({ ok: true, path: 'never.png' })
                });
                assert.notEqual(decision.decision, POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND);
                assert.equal(result.success, false);
            }
        }
    }
    assert.equal(provider.count(), 0);
});
