import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { claimEcQaInboundContextV78 } from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';
import {
    applyEcQaTestResetToStateV78,
    createEcQaTestPermitV78,
    EC_QA_TEST_PHONE_V78
} from '../src/services/ecQaTestResetV78Service.js';
import { EC_OFFICIAL_VSL_V78_MESSAGE } from '../src/services/ecOfficialVslEntryV78Service.js';
import { fingerprintOutbound } from '../src/services/outboundDedupeService.js';
import {
    QA_CANARY_GREETING_STEP_V168A_R2,
    resolveQaCanaryDedupeGenerationV168AR2
} from '../src/services/qaCanaryDedupeV168AR2Service.js';
import {
    canonicalWatchdogProviderMessageIdV168AR2,
    scheduleZapiFirstResponseWatchdogV168AR2,
    watchdogProviderMessageAlreadyProcessedV168AR2,
    zapiFirstResponseWatchdogEnabledV168AR2
} from '../src/services/zapiFirstResponseWatchdogV168AR2Service.js';

const NOW = new Date('2026-09-16T15:00:00.000Z');
const PERMIT_A = 'ecqa-v78-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const PERMIT_B = 'ecqa-v78-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const INBOUND_A = '3EB08DFB57C6561551CDD2';
const INBOUND_B = '3EB0FRESHV168AR2C1';

const qaState = ({
    status = 'routing',
    permitId = PERMIT_A,
    routingMessageId = INBOUND_A,
    consumedMessageId = '',
    priorProcessedMessageIds = [],
    metadataPatch = {},
    contextPatch = {}
} = {}) => ({
    _id: '68ab8e9429ec2b89fb1754b8',
    chatId: `${EC_QA_TEST_PHONE_V78}@c.us`,
    phoneDigits: EC_QA_TEST_PHONE_V78,
    human: { mode: 'auto', pausedUntil: null },
    tags: ['TESTE_8637_PRIORIDADE', 'TESTE_FIXO_NAO_MEXER', 'BOT_TESTE_LIBERADO'],
    metadata: {
        testOnly: true,
        botTestEnabled: true,
        fullFunnelTestEnabled: true,
        ...metadataPatch,
        qaTestContextV78: {
            version: 78,
            context: 'EC_V78_OFFICIAL_VSL_QA',
            phone: EC_QA_TEST_PHONE_V78,
            permitId,
            status,
            routingMessageId,
            consumedMessageId,
            expiresAt: '2026-09-16T15:10:00.000Z',
            priorProcessedMessageIds,
            processedMessageIds: consumedMessageId ? [consumedMessageId] : [],
            ...contextPatch
        }
    }
});

const generation = (state, overrides = {}) => resolveQaCanaryDedupeGenerationV168AR2({
    state,
    phone: EC_QA_TEST_PHONE_V78,
    inboundMessageId: INBOUND_A,
    stepKey: QA_CANARY_GREETING_STEP_V168A_R2,
    now: NOW,
    ...overrides
});

const watchdogResult = () => ({
    publicVslLeadEntry: true,
    routeToBot: true,
    messageId: INBOUND_A,
    providerMessageId: INBOUND_A,
    chatId: `${EC_QA_TEST_PHONE_V78}@c.us`,
    phone: EC_QA_TEST_PHONE_V78,
    body: EC_OFFICIAL_VSL_V78_MESSAGE
});

test('QA 1: telefone exato, permit novo reivindicado e inbound autorizado geram identidade determinística', () => {
    const first = generation(qaState());
    const repeated = generation(qaState());
    assert.equal(first.allowed, true);
    assert.equal(first.applicable, true);
    assert.equal(first.identity, repeated.identity);
    assert.match(first.identity, /^v168a_r2_qa:[a-f0-9]{64}$/);
});

test('QA 2 e 13: mesma autorização reserva uma saudação; contexto diferente bloqueia', () => {
    const seen = new Set();
    const reserve = (identity) => seen.has(identity) ? false : (seen.add(identity), true);
    const allowed = generation(qaState());
    assert.equal(reserve(allowed.identity), true);
    assert.equal(reserve(allowed.identity), false);
    assert.equal(generation(qaState({ contextPatch: { context: 'OTHER_CONTEXT' } })).reason, 'qa_permit_context_mismatch');
});

test('QA 3, 7, 8 e 9: permit consumido só reconhece continuação idempotente da mesma mensagem', () => {
    const consumed = qaState({ status: 'consumed', consumedMessageId: INBOUND_A });
    assert.equal(generation(consumed).allowed, true);
    assert.equal(generation(consumed, { inboundMessageId: INBOUND_B }).allowed, false);
    assert.equal(generation(qaState({ routingMessageId: INBOUND_B })).reason, 'qa_routing_message_mismatch');
    assert.equal(generation(qaState({ status: 'consumed', consumedMessageId: INBOUND_B })).reason, 'qa_consumed_message_mismatch');
});

test('QA 4: permit expirado falha fechado', () => {
    assert.equal(generation(qaState({ contextPatch: { expiresAt: '2026-09-16T14:59:59.999Z' } })).reason, 'qa_permit_expired');
});

test('QA 5 e 6: telefone não QA, parcial, sufixo, prefixo extra e formato não canônico não ativam a camada', () => {
    for (const phone of ['593999999999', '998038637', '5998038637', '55159980386370', '05515998038637', '+55 15 99803-8637']) {
        const result = generation(qaState(), { phone });
        assert.equal(result.applicable, false, phone);
        assert.equal(result.reason, 'not_exact_qa_phone', phone);
    }
});

test('QA 10, 11 e 12: os três marcadores de teste são obrigatórios sem alterar o dedupe normal', () => {
    for (const metadataPatch of [
        { testOnly: false },
        { botTestEnabled: false },
        { fullFunnelTestEnabled: false }
    ]) {
        const result = generation(qaState({ metadataPatch }));
        assert.equal(result.applicable, false);
        assert.equal(result.reason, 'qa_metadata_not_eligible');
    }
});

test('permit novo com inbound antigo é bloqueado; permit novo com inbound novo recebe identidade nova', () => {
    const oldIdentity = generation(qaState()).identity;
    const reusedOldInbound = generation(qaState({ permitId: PERMIT_B, priorProcessedMessageIds: [INBOUND_A] }));
    assert.equal(reusedOldInbound.allowed, false);
    assert.equal(reusedOldInbound.reason, 'qa_old_inbound_message_reuse');
    const fresh = generation(qaState({ permitId: PERMIT_B, routingMessageId: INBOUND_B }), {
        inboundMessageId: INBOUND_B
    });
    assert.equal(fresh.allowed, true);
    assert.notEqual(fresh.identity, oldIdentity);
});

test('reset por permit novo preserva IDs já processados sem limpar histórico comercial', () => {
    const state = qaState({ status: 'consumed', consumedMessageId: INBOUND_A });
    state.human = { mode: 'manual', pausedUntil: new Date('2036-01-01T00:00:00.000Z') };
    state.history = [{ event: 'preserved' }];
    const permit = createEcQaTestPermitV78({
        phone: EC_QA_TEST_PHONE_V78,
        now: NOW,
        randomBytes: () => Buffer.alloc(16, 0xbb)
    });
    const result = applyEcQaTestResetToStateV78({ state, phone: EC_QA_TEST_PHONE_V78, permit, now: NOW });
    assert.equal(result.changed, true);
    assert.deepEqual(state.history, [{ event: 'preserved' }]);
    assert.deepEqual(state.metadata.qaTestContextV78.priorProcessedMessageIds, [INBOUND_A]);
    assert.deepEqual(state.metadata.qaTestContextV78.processedMessageIds, []);
});

test('claim V78 não reutiliza contexto consumido para um inbound diferente', async () => {
    const calls = [];
    const result = await claimEcQaInboundContextV78({
        payload: {
            phone: EC_QA_TEST_PHONE_V78,
            messageId: INBOUND_B,
            text: { message: EC_OFFICIAL_VSL_V78_MESSAGE }
        },
        model: { async updateOne(query) { calls.push(query); return { modifiedCount: 0 }; } },
        allowQaFollowUp: true,
        now: NOW
    });
    assert.equal(result.allowed, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]['metadata.qaTestContextV78.status'], 'armed');
    assert.deepEqual(calls[0]['metadata.qaTestContextV78.priorProcessedMessageIds'], { $ne: INBOUND_B });
});

test('dedupe normal e anti-spam continuam usando a identidade histórica fora do QA', () => {
    const normalIdentity = 'tex_ultra_initial_cancellable_v1:greeting:68ab8e9429ec2b89fb1754b8';
    const normalFingerprint = fingerprintOutbound({ kind: 'text', value: normalIdentity });
    assert.equal(generation(qaState(), { phone: '593999999999' }).applicable, false);
    assert.equal(fingerprintOutbound({ kind: 'text', value: normalIdentity }), normalFingerprint);
    const initialLayer = fs.readFileSync('src/services/texUltraInitialLayerService.js', 'utf8');
    assert.match(initialLayer, /normalIdentity = `\$\{TEX_ULTRA_INITIAL_LAYER_ID\}:greeting:\$\{state\._id\}`/);
    assert.match(initialLayer, /qaGeneration\.allowed \? qaGeneration\.identity : normalIdentity/);
});

test('Watchdog A: flag Z-API false impede criação de timer', () => {
    let timers = 0;
    const scheduled = scheduleZapiFirstResponseWatchdogV168AR2({
        result: watchdogResult(),
        env: { ZAPI_CHAT_WATCHDOG_ENABLED: 'false', VSL_FIRST_RESPONSE_WATCHDOG_ENABLED: 'true' },
        setTimer: () => { timers += 1; },
        hasRecentOutbound: async () => false,
        providerAlreadyProcessed: async () => false,
        routeInbound: async () => {},
        markStatus: async () => {}
    });
    assert.equal(zapiFirstResponseWatchdogEnabledV168AR2({ ZAPI_CHAT_WATCHDOG_ENABLED: 'false' }), false);
    assert.equal(scheduled.scheduled, false);
    assert.equal(timers, 0);
});

test('Watchdog B: callback pendente relê a flag e não executa após desativação', async () => {
    const env = { ZAPI_CHAT_WATCHDOG_ENABLED: 'true', VSL_FIRST_RESPONSE_WATCHDOG_ENABLED: 'true' };
    let callback;
    let routed = 0;
    const scheduled = scheduleZapiFirstResponseWatchdogV168AR2({
        result: watchdogResult(), env,
        setTimer: (fn) => { callback = fn; return { unref() {} }; },
        hasRecentOutbound: async () => false,
        providerAlreadyProcessed: async () => false,
        routeInbound: async () => { routed += 1; },
        markStatus: async () => {}
    });
    assert.equal(scheduled.scheduled, true);
    env.ZAPI_CHAT_WATCHDOG_ENABLED = 'false';
    const outcome = await callback();
    assert.equal(outcome.reason, 'watchdog_disabled_at_execution');
    assert.equal(routed, 0);
});

test('Watchdog C, D e E: provider ID persistido bloqueia reentrada e ID sintético é inválido', async () => {
    let query;
    assert.equal(await watchdogProviderMessageAlreadyProcessedV168AR2({
        providerMessageId: INBOUND_A,
        model: { exists: async (value) => { query = value; return { _id: INBOUND_A }; } }
    }), true);
    assert.deepEqual(query.$or[0], { _id: INBOUND_A });
    assert.equal(canonicalWatchdogProviderMessageIdV168AR2(`${INBOUND_A}_watchdog_1789529415850`), '');

    let callback;
    let routed = 0;
    const marks = [];
    scheduleZapiFirstResponseWatchdogV168AR2({
        result: watchdogResult(),
        env: { ZAPI_CHAT_WATCHDOG_ENABLED: 'true' },
        setTimer: (fn) => { callback = fn; return { unref() {} }; },
        hasRecentOutbound: async () => false,
        providerAlreadyProcessed: async () => true,
        routeInbound: async () => { routed += 1; },
        markStatus: async (value) => marks.push(value)
    });
    const outcome = await callback();
    assert.equal(outcome.reason, 'provider_message_already_processed');
    assert.equal(routed, 0);
    assert.equal(marks[0].reason, 'provider_message_already_processed');
});

test('Watchdog F e G: mesmo inbound não obtém novo contexto nem segunda reserva', () => {
    const consumed = generation(qaState({ status: 'consumed', consumedMessageId: INBOUND_A }));
    const reservations = new Set();
    assert.equal(reservations.has(consumed.identity), false);
    reservations.add(consumed.identity);
    assert.equal(reservations.has(consumed.identity), true);
    const secondMessage = generation(qaState({ status: 'consumed', consumedMessageId: INBOUND_A }), {
        inboundMessageId: INBOUND_B
    });
    assert.equal(secondMessage.allowed, false);
});

test('watchdog legítimo continua disponível com flags ativas, ID canônico ausente no banco e uma única rota', async () => {
    let callback;
    let outboundChecks = 0;
    const routed = [];
    const scheduled = scheduleZapiFirstResponseWatchdogV168AR2({
        result: watchdogResult(),
        env: { ZAPI_CHAT_WATCHDOG_ENABLED: 'true', VSL_FIRST_RESPONSE_WATCHDOG_ENABLED: 'true' },
        delayMs: 15000,
        setTimer: (fn) => { callback = fn; return { unref() {} }; },
        hasRecentOutbound: async () => { outboundChecks += 1; return outboundChecks > 1; },
        providerAlreadyProcessed: async () => false,
        routeInbound: async (message) => routed.push(message),
        markStatus: async () => {}
    });
    assert.equal(scheduled.scheduled, true);
    const outcome = await callback();
    assert.equal(outcome.routed, true);
    assert.equal(routed.length, 1);
    assert.equal(routed[0].id, INBOUND_A);
    assert.doesNotMatch(routed[0].id, /watchdog/i);
});

test('fontes V168A-R2 não adicionam bypass global nem mutação destrutiva de histórico', () => {
    const files = [
        'src/services/qaCanaryDedupeV168AR2Service.js',
        'src/services/ecQaTestResetV78Service.js',
        'src/services/ecBotCoreRuntimeIntegrationV78Service.js',
        'src/services/texUltraInitialLayerService.js',
        'src/services/zapiFirstResponseWatchdogV168AR2Service.js',
        'src/routes/zapi.js'
    ];
    const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    assert.doesNotMatch(source, /force\s*:\s*true|skipOutboundDedupe|allowTextDedupeBypass/);
    assert.doesNotMatch(source, /OutboundDedupe\.(?:deleteOne|deleteMany|updateOne|updateMany)/);
    assert.doesNotMatch(source, /_watchdog_\$\{Date\.now\(\)\}/);
});
