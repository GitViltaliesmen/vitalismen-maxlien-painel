import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    buildV193WatchdogCandidate,
    claimV193FirstEntryMarker,
    resolveV193OriginalIdentity,
    runV193FirstResponseRecovery
} from '../src/services/vslFirstResponseWatchdogV193Service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const firstAt = new Date('2026-09-19T12:00:00.000Z');
const entryBody = 'Hola, acabo de ver el video. Nombre completo: Fixture. Teléfono: 0999999999';

const clone = (value) => structuredClone(value);
const getPath = (object, dotted) => dotted.split('.').reduce((value, key) => value?.[key], object);
const setPath = (object, dotted, value) => {
    const keys = dotted.split('.');
    let cursor = object;
    for (const key of keys.slice(0, -1)) cursor = cursor[key] ??= {};
    cursor[keys.at(-1)] = value;
};
const matchesCondition = (actual, expected) => {
    if (!expected || typeof expected !== 'object' || expected instanceof Date || Array.isArray(expected)) {
        return String(actual ?? '') === String(expected ?? '');
    }
    if ('$exists' in expected && (actual !== undefined) !== expected.$exists) return false;
    if ('$lt' in expected && !(Number(actual) < Number(expected.$lt))) return false;
    if ('$lte' in expected && !(new Date(actual).getTime() <= new Date(expected.$lte).getTime())) return false;
    if ('$ne' in expected && String(actual ?? '') === String(expected.$ne ?? '')) return false;
    if ('$nin' in expected && expected.$nin.includes(actual)) return false;
    return true;
};
const matches = (doc, filter) => Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((nested) => matches(doc, nested));
    if (key === '$and') return expected.every((nested) => matches(doc, nested));
    return matchesCondition(getPath(doc, key), expected);
});
const applyUpdate = (doc, update) => {
    for (const [key, value] of Object.entries(update.$set || {})) setPath(doc, key, value);
    for (const [key, value] of Object.entries(update.$inc || {})) {
        setPath(doc, key, Number(getPath(doc, key) || 0) + Number(value));
    }
};

class MemoryContactStateModel {
    constructor(doc) {
        this.doc = clone(doc);
    }

    findById(id) {
        return { lean: async () => String(this.doc?._id) === String(id) ? clone(this.doc) : null };
    }

    findOneAndUpdate(filter, update) {
        const selected = this.doc && matches(this.doc, filter);
        if (selected) applyUpdate(this.doc, update);
        return { lean: async () => selected ? clone(this.doc) : null };
    }

    async updateOne(filter, update) {
        if (!this.doc || !matches(this.doc, filter)) return { matchedCount: 0, modifiedCount: 0 };
        applyUpdate(this.doc, update);
        return { matchedCount: 1, modifiedCount: 1 };
    }
}

const baseCandidate = (overrides = {}) => buildV193WatchdogCandidate({
    newMessage: true,
    vslRoutingAllowed: true,
    publicVslLeadEntry: true,
    refreshedVslAttribution: true,
    vslProductKey: 'tex_ultra_ec',
    type: 'chat',
    body: entryBody,
    providerMessageId: 'provider-first-1',
    providerZaapId: 'zaap-first-1',
    messageId: 'persisted-first-1',
    ...overrides
});

const stateFixture = (overrides = {}) => ({
    _id: 'state-1',
    chatId: '593000000001@c.us',
    phoneDigits: '593000000001',
    human: { mode: 'auto' },
    conversationBucket: { value: 'attendance' },
    metadata: {
        vslFirstEntryMessageId: 'provider-first-1',
        vslFirstEntryProviderMessageId: 'provider-first-1',
        vslFirstEntryPersistedMessageId: 'persisted-first-1',
        vslFirstEntryAt: firstAt,
        vslFirstResponseWatchdogKey: 'zapi:provider-first-1',
        vslFirstResponseWatchdogStatus: 'armed',
        vslFirstResponseWatchdogAttemptCount: 0
    },
    ...overrides
});

const recoveryResult = (overrides = {}) => ({
    eligibleForFirstResponseWatchdog: true,
    contactStateId: 'state-1',
    vslFirstEntryMessageId: 'provider-first-1',
    vslFirstEntryAt: firstAt.toISOString(),
    vslFirstResponseWatchdogKey: 'zapi:provider-first-1',
    messageId: 'persisted-first-1',
    chatId: '593000000001@c.us',
    phone: '593000000001',
    body: entryBody,
    ...overrides
});

test('1. primeira entrada VSL nova é candidata e cria marcador persistente', async () => {
    const candidate = baseCandidate();
    assert.equal(candidate.eligible, true);
    const model = new MemoryContactStateModel({
        _id: 'state-1', human: { mode: 'auto' }, conversationBucket: { value: 'attendance' }, metadata: {}
    });
    const claim = await claimV193FirstEntryMarker({
        contactStateId: 'state-1', candidate, providerMessageId: 'provider-first-1',
        providerZaapId: 'zaap-first-1', persistedMessageId: 'persisted-first-1', inboundAt: firstAt,
        contactStateModel: model
    });
    assert.equal(claim.claimed, true);
    assert.equal(model.doc.metadata.vslFirstEntryMessageId, 'provider-first-1');
    assert.equal(model.doc.metadata.vslFirstResponseWatchdogAttemptCount, 0);
});

test('2. segunda mensagem textual com contexto apenas persistido não é elegível', () => {
    assert.equal(baseCandidate({ refreshedVslAttribution: false, body: 'Mi nombre es Fixture' }).eligible, false);
});

test('3. áudio posterior não é elegível', () => {
    assert.equal(baseCandidate({ refreshedVslAttribution: false, type: 'audio', body: '[audio]' }).eligible, false);
});

test('4. imagem posterior não é elegível', () => {
    assert.equal(baseCandidate({ refreshedVslAttribution: false, type: 'image', body: '[image]' }).eligible, false);
});

test('5. webhook duplicado não cria segundo marcador/watchdog', async () => {
    const model = new MemoryContactStateModel({ _id: 'state-1', metadata: {} });
    const first = baseCandidate();
    const firstClaim = await claimV193FirstEntryMarker({
        contactStateId: 'state-1', candidate: first, persistedMessageId: 'persisted-first-1', contactStateModel: model
    });
    const duplicate = baseCandidate({ newMessage: false });
    const duplicateClaim = await claimV193FirstEntryMarker({
        contactStateId: 'state-1', candidate: duplicate, persistedMessageId: 'persisted-first-1', contactStateModel: model
    });
    assert.equal(firstClaim.claimed, true);
    assert.equal(duplicateClaim.claimed, false);
    assert.equal(model.doc.metadata.vslFirstEntryMessageId, 'provider-first-1');
});

test('6. outbound anterior ao timer marca answered e executa zero recovery', async () => {
    const model = new MemoryContactStateModel(stateFixture());
    let routed = 0;
    const outcome = await runV193FirstResponseRecovery({
        result: recoveryResult(), contactStateModel: model,
        hasOutbound: async () => true, routeMessage: async () => { routed += 1; }
    });
    assert.equal(outcome.status, 'answered');
    assert.equal(routed, 0);
    assert.equal(model.doc.metadata.vslFirstResponseWatchdogReason, 'outbound_found');
});

test('7. outbound real prevalece sobre metadata antiga failed', async () => {
    const state = stateFixture();
    state.metadata.vslFirstResponseWatchdogStatus = 'failed';
    const model = new MemoryContactStateModel(state);
    let routed = 0;
    await runV193FirstResponseRecovery({
        result: recoveryResult(), contactStateModel: model,
        hasOutbound: async () => true, routeMessage: async () => { routed += 1; }
    });
    assert.equal(routed, 0);
    assert.equal(model.doc.metadata.vslFirstResponseWatchdogStatus, 'answered');
});

for (const [number, label, state] of [
    [8, 'human.mode=manual', stateFixture({ human: { mode: 'manual' } })],
    [9, 'bucket=orders', stateFixture({ conversationBucket: { value: 'orders' } })],
    [10, 'bucket=review', stateFixture({ conversationBucket: { value: 'review' } })],
    [11, 'bucket=engagement', stateFixture({ conversationBucket: { value: 'engagement' } })]
]) {
    test(`${number}. ${label} bloqueia recovery`, async () => {
        const model = new MemoryContactStateModel(state);
        let routed = 0;
        const outcome = await runV193FirstResponseRecovery({
            result: recoveryResult(), contactStateModel: model,
            hasOutbound: async () => false, routeMessage: async () => { routed += 1; }
        });
        assert.equal(outcome.recoveryExecuted, false);
        assert.equal(routed, 0);
    });
}

test('12. dois workers concorrentes obtêm somente um lock e um recovery', async () => {
    const model = new MemoryContactStateModel(stateFixture());
    let routed = 0;
    const run = () => runV193FirstResponseRecovery({
        result: recoveryResult(), contactStateModel: model,
        hasOutbound: async () => false,
        routeMessage: async () => { routed += 1; }
    });
    const outcomes = await Promise.all([run(), run()]);
    assert.equal(routed, 1);
    assert.equal(outcomes.filter((item) => item.recoveryExecuted).length, 1);
});

test('13. mesma watchdogKey mantém attemptCount máximo 1', async () => {
    const model = new MemoryContactStateModel(stateFixture());
    let routed = 0;
    const config = {
        result: recoveryResult(), contactStateModel: model,
        hasOutbound: async () => false, routeMessage: async () => { routed += 1; }
    };
    await runV193FirstResponseRecovery(config);
    await runV193FirstResponseRecovery(config);
    assert.equal(model.doc.metadata.vslFirstResponseWatchdogAttemptCount, 1);
    assert.equal(routed, 1);
});

test('14. outbound surgindo no limite é detectado na segunda consulta sem envio', async () => {
    const model = new MemoryContactStateModel(stateFixture());
    let probes = 0;
    let routed = 0;
    const outcome = await runV193FirstResponseRecovery({
        result: recoveryResult(), contactStateModel: model,
        hasOutbound: async () => (++probes >= 2),
        routeMessage: async () => { routed += 1; }
    });
    assert.equal(outcome.reason, 'outbound_found');
    assert.equal(probes, 2);
    assert.equal(routed, 0);
});

test('15. follow-up VSL com produto herdado não vira primeira entrada', () => {
    const followUp = baseCandidate({
        refreshedVslAttribution: false,
        body: 'Gracias, ¿cómo debo usar el producto?'
    });
    assert.equal(followUp.eligible, false);
    assert.equal(followUp.reason, 'persisted_context_without_fresh_attribution');
});

test('16. V193 preserva o parent e reconhece somente o funil aprovado na V198', () => {
    const parent = '818db6cf281ee22d3ab4efc04f76cc7cf7898ae1';
    const v198 = globalThis.__VITALISMEN_V198_TEX_ULTRA_FIRST_REPLY_DEDUPE_CONTEXT;
    assert.equal(v198?.loaded, true);
    assert.equal(v198?.freezeId, 'TEX_ULTRA_FIRST_REPLY_SOURCE_DEDUPE_V198_20260923');
    for (const file of [
        'src/services/vslProductAssignmentService.js',
        'src/services/texUltraFunnelService.js',
        'src/services/agentRouter.js',
        'src/services/conversationEngine.js'
    ]) {
        const actual = fs.readFileSync(path.join(root, file));
        if (file === 'src/services/texUltraFunnelService.js') {
            assert.equal(
                crypto.createHash('sha256').update(actual).digest('hex'),
                v198.protectedFiles[file],
                `${file} deve corresponder exatamente ao freeze V198`
            );
        } else {
            const baseline = execFileSync('git', ['show', `${parent}:${file}`], { cwd: root });
            assert.deepEqual(actual, baseline, file);
        }
    }
});

test('17. fixture Kleber: primeira entrada elegível; texto e áudio seguintes não', () => {
    const kleberFirst = baseCandidate({ providerMessageId: 'kleber-first-1564' });
    const kleberText = baseCandidate({
        providerMessageId: 'kleber-followup-text-1564', refreshedVslAttribution: false, body: 'Kleber'
    });
    const kleberAudio = baseCandidate({
        providerMessageId: 'kleber-followup-audio-1564', refreshedVslAttribution: false, type: 'audio', body: '[audio]'
    });
    assert.equal(kleberFirst.eligible, true);
    assert.equal(kleberText.eligible, false);
    assert.equal(kleberAudio.eligible, false);
});

test('18. QA autorizado não gera watchdog ou efeito comercial extra', () => {
    const qa = baseCandidate({ authorizedTestRecipient: true });
    assert.equal(qa.eligible, false);
    assert.equal(qa.reason, 'authorized_qa_excluded');
});

test('identidade preserva preferência providerMessageId > providerZaapId > messageId persistido', () => {
    assert.equal(resolveV193OriginalIdentity({ providerMessageId: 'p', providerZaapId: 'z', messageId: 'm' }), 'p');
    assert.equal(resolveV193OriginalIdentity({ providerZaapId: 'z', messageId: 'm' }), 'z');
    assert.equal(resolveV193OriginalIdentity({ messageId: 'm' }), 'm');
});

test('marcador anterior divergente nunca é sobrescrito', async () => {
    const model = new MemoryContactStateModel(stateFixture());
    const claim = await claimV193FirstEntryMarker({
        contactStateId: 'state-1', candidate: baseCandidate({ providerMessageId: 'new-provider' }),
        persistedMessageId: 'new-persisted', contactStateModel: model
    });
    assert.equal(claim.claimed, false);
    assert.equal(model.doc.metadata.vslFirstEntryMessageId, 'provider-first-1');
});
