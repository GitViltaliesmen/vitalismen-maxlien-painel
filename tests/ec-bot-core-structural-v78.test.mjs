import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    EC_BOT_CORE_V78_ALLOWED_MUTATION_ROUTES,
    EC_BOT_CORE_V78_DATASET_ID,
    EC_BOT_CORE_V78_MODE,
    EC_BOT_CORE_V78_REQUIRED_FALSE_FLAGS,
    assertEcBotCoreV78Health,
    buildEcBotCoreV78OverlayEnvironment,
    calculateEcBotCoreV78ProfileSha256,
    ecBotCoreV78ExternalEffectDecision,
    ecBotCoreV78RouteDecision,
    resolveEcBotCoreV78Configuration
} from '../src/services/ecBotCoreOperationalV78Service.js';
import {
    MUTABLE_RUNTIME_ARTIFACTS_V78,
    assertNoSymlinkTraversalV78,
    calculateFunctionalPayloadSha256V78,
    resolveMutableRuntimeArtifactPathV78
} from '../src/services/mutableRuntimeArtifactV78Service.js';
import {
    EC_OFFICIAL_VSL_V78_MESSAGE,
    EC_OFFICIAL_VSL_V78_URL,
    EC_OFFICIAL_VSL_V78_WHATSAPP,
    officialEcVslDestinationPhoneV78,
    recognizeOfficialEcVslEntryV78,
    validateOfficialEcVslOriginContractV78
} from '../src/services/ecOfficialVslEntryV78Service.js';
import {
    EC_QA_TEST_MAX_WINDOW_MS_V78,
    EC_QA_TEST_PHONE_V78,
    applyEcQaTestResetToStateV78,
    assertExactEcQaPhoneV78,
    consumeEcQaTestContextV78,
    containEcQaTestContextOnStateV78,
    createEcQaTestPermitV78,
    planEcQaTestResetV78,
    resolveEcQaTestContextV78,
    validateEcQaTestPermitV78
} from '../src/services/ecQaTestResetV78Service.js';
import {
    EC_BOT_CORE_V78_AUTHORIZATION_PHRASE,
    EC_BOT_CORE_V78_MAX_PERMIT_MS,
    assertEcBotCoreV78PreActivationHealth,
    buildEcBotCoreOperationalBundleV78,
    validateEcBotCoreOperationalBundleV78
} from '../scripts/lib/ec-bot-core-operational-contract-v78.mjs';
import {
    resolveStrictReadOnlyObservation
} from '../src/services/strictReadOnlyObservationService.js';
import { canaryV75BlockedResult } from '../src/services/canaryIsolationV75Service.js';
import { explicitEcVslProductContextFromText } from '../src/routes/zapi.js';
import {
    claimEcQaInboundContextV78,
    decorateEcBotCoreHealthPayloadV78,
    ecBotCoreMutationRouteGuardV78,
    installEcBotCoreMongooseGuardV78
} from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';

const HASH = 'a'.repeat(64);
const IDENTITY = Object.freeze({
    release: '20260829T120000Z_production-20260829-7888888',
    commit: '7888888888888888888888888888888888888888',
    tree: '7999999999999999999999999999999999999999',
    tag: 'production-20260829-7888888'
});

const coreEnvironment = () => {
    const overlay = buildEcBotCoreV78OverlayEnvironment({
        baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID }
    });
    return { ...overlay, META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID };
};

const rehash = (env) => ({
    ...env,
    VITALISMEN_EC_BOT_CORE_PROFILE_SHA256: calculateEcBotCoreV78ProfileSha256(env)
});

const qaState = () => ({
    chatId: `${EC_QA_TEST_PHONE_V78}@c.us`,
    phoneDigits: EC_QA_TEST_PHONE_V78,
    countryCode: 'BR',
    tags: ['TESTE_8637_PRIORIDADE', 'TESTE_FIXO_NAO_MEXER', 'BOT_TESTE_LIBERADO'],
    human: {
        mode: 'manual',
        pausedUntil: new Date('2036-01-01T00:00:00.000Z'),
        assignedName: 'Operador QA',
        lastManualBy: 'operator'
    },
    metadata: {
        testOnly: true,
        botTestEnabled: true,
        fullFunnelTestEnabled: true,
        publicVslLeadEntry: false,
        perAgentMemory: { tex_ultra_ec: { stage: 'existing' } }
    },
    history: [{ id: 'history-preserved' }],
    messages: [{ id: 'message-preserved' }],
    orders: [{ id: 'order-preserved' }]
});

const deterministicPermit = (now = new Date('2026-08-29T12:00:00.000Z')) => createEcQaTestPermitV78({
    phone: EC_QA_TEST_PHONE_V78,
    now,
    ttlMs: 5 * 60 * 1000,
    randomBytes: () => Buffer.alloc(16, 7)
});

test('artefatos mutáveis V78 usam registro explícito e diretório compartilhado fora da release', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v78-runtime-'));
    const productionRoot = path.join(root, 'vitalismen');
    const release = path.join(productionRoot, 'releases', 'candidate');
    fs.mkdirSync(release, { recursive: true });
    const target = resolveMutableRuntimeArtifactPathV78('passiveFunnelObserverReport', {
        cwd: release,
        productionRoot,
        sharedRuntimeRoot: path.join(productionRoot, 'shared', 'runtime'),
        env: { PASSIVE_FUNNEL_OBSERVER_REPORT_PATH: 'runtime/passive-funnel-observer-latest.json' }
    });
    assert.equal(target, path.join(productionRoot, 'shared', 'runtime', 'observers', 'passive-funnel-observer-latest.json'));
    assert.equal(Object.keys(MUTABLE_RUNTIME_ARTIFACTS_V78).length, 5);
    assert.throws(() => resolveMutableRuntimeArtifactPathV78('undeclaredSnapshot', {
        cwd: release,
        productionRoot,
        sharedRuntimeRoot: path.join(productionRoot, 'shared', 'runtime')
    }), /not_declared/);
    assert.throws(() => resolveMutableRuntimeArtifactPathV78('passiveFunnelObserverReport', {
        cwd: release,
        productionRoot,
        sharedRuntimeRoot: path.join(productionRoot, 'shared', 'runtime'),
        env: { PASSIVE_FUNNEL_OBSERVER_REPORT_PATH: '../escape.json' }
    }), /relative_override_blocked/);
    assert.throws(() => resolveMutableRuntimeArtifactPathV78('passiveFunnelObserverReport', {
        cwd: release,
        productionRoot,
        sharedRuntimeRoot: path.join(productionRoot, 'shared', 'runtime'),
        env: { PASSIVE_FUNNEL_OBSERVER_REPORT_PATH: path.join(root, 'outside.json') }
    }), /outside_allowed_root/);
});

test('snapshot externo não muda fingerprint; código, package, runtime disfarçado e arquivo não declarado mudam', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v78-fingerprint-'));
    const release = path.join(root, 'release');
    const external = path.join(root, 'shared', 'runtime', 'observers');
    fs.mkdirSync(path.join(release, 'src'), { recursive: true });
    fs.mkdirSync(external, { recursive: true });
    fs.writeFileSync(path.join(release, 'src', 'app.js'), 'export const value = 1;\n');
    fs.writeFileSync(path.join(release, 'package.json'), '{"type":"module"}\n');
    fs.writeFileSync(path.join(external, 'passive-funnel-observer-latest.json'), '{"run":1}\n');
    const baseline = calculateFunctionalPayloadSha256V78(release);
    fs.writeFileSync(path.join(external, 'passive-funnel-observer-latest.json'), '{"run":2}\n');
    assert.equal(calculateFunctionalPayloadSha256V78(release), baseline);

    fs.writeFileSync(path.join(release, 'src', 'app.js'), 'export const value = 2;\n');
    const codeChanged = calculateFunctionalPayloadSha256V78(release);
    assert.notEqual(codeChanged, baseline);
    fs.writeFileSync(path.join(release, 'src', 'app.js'), 'export const value = 1;\n');
    assert.equal(calculateFunctionalPayloadSha256V78(release), baseline);

    fs.writeFileSync(path.join(release, 'package.json'), '{"type":"module","scripts":{"start":"node src/app.js"}}\n');
    assert.notEqual(calculateFunctionalPayloadSha256V78(release), baseline);
    fs.writeFileSync(path.join(release, 'package.json'), '{"type":"module"}\n');

    fs.mkdirSync(path.join(release, 'runtime'), { recursive: true });
    fs.writeFileSync(path.join(release, 'runtime', 'passive-funnel-observer-latest.json'), '{"disguised":true}\n');
    assert.notEqual(calculateFunctionalPayloadSha256V78(release), baseline);
    fs.rmSync(path.join(release, 'runtime'), { recursive: true });

    fs.writeFileSync(path.join(release, 'undeclared-runtime.json'), '{}\n');
    assert.notEqual(calculateFunctionalPayloadSha256V78(release), baseline);
});

test('symlink inesperado é fail-closed sem depender de privilégios do sistema de teste', () => {
    const root = path.resolve(os.tmpdir(), 'v78-symlink-root');
    const target = path.join(root, 'observers', 'snapshot.json');
    const fakeFs = {
        existsSync: () => true,
        lstatSync: (candidate) => ({ isSymbolicLink: () => candidate.endsWith(`${path.sep}observers`) })
    };
    assert.throws(() => assertNoSymlinkTraversalV78({ target, allowedRoot: root, fsImpl: fakeFs }), /symlink_blocked/);
});

test('perfil BOT CORE íntegro libera só núcleo e mantém schedulers, Dropi e Meta bloqueados', () => {
    const env = coreEnvironment();
    const config = resolveEcBotCoreV78Configuration(env);
    assert.equal(config.ready, true);
    assert.equal(config.mode, EC_BOT_CORE_V78_MODE);
    assert.equal(config.schedulerMutationsAllowed, false);
    assert.equal(config.dropiApplyAllowed, false);
    assert.equal(config.metaPurchaseAllowed, false);
    assert.equal(resolveStrictReadOnlyObservation(env).strictReadOnly, false);
    const health = decorateEcBotCoreHealthPayloadV78({
        status: 'online',
        automationSafety: { mode: 'OPERATIONAL', mutatingRoutesEnabled: true }
    }, env).automationSafety;
    assert.equal(health.botCoreOperational, true);
    assert.equal(health.mutatingRoutesEnabled, false);
    assert.equal(health.mutatingSchedulers, 0);
    assert.equal(health.dropiApplyAllowed, false);
    assert.equal(health.metaPurchaseAllowed, false);
});

test('cada tentativa de ligar scheduler, Dropi ou Meta falha mesmo com hash recalculado', () => {
    const schedulerFlags = [
        'WHATSAPP_PRODUCT_FOLLOWUP_ENABLED',
        'SHIPMENT_STATUS_DISPATCH_ENABLED',
        'WHATSAPP_BACKLOG_RECOVERY_ENABLED'
    ];
    for (const flag of [...schedulerFlags, 'DROPPI_EC_ACTIVE_SYNC_ENABLED', 'VITALISMEN_META_PURCHASE_ENABLED']) {
        const tampered = rehash({ ...coreEnvironment(), [flag]: 'true' });
        const result = resolveEcBotCoreV78Configuration(tampered);
        assert.equal(result.ready, false, flag);
        assert.ok(result.failures.includes(`${flag}_must_be_false`), flag);
    }
    assert.ok(EC_BOT_CORE_V78_REQUIRED_FALSE_FLAGS.includes('DROPPI_EC_ACTIVE_SYNC_ENABLED'));
    assert.ok(EC_BOT_CORE_V78_REQUIRED_FALSE_FLAGS.includes('VITALISMEN_META_PURCHASE_ENABLED'));
});

test('allowlist HTTP e gate de efeitos externos são mínimos e fail-closed', () => {
    const env = coreEnvironment();
    assert.equal(EC_BOT_CORE_V78_ALLOWED_MUTATION_ROUTES.size, 5);
    for (const route of EC_BOT_CORE_V78_ALLOWED_MUTATION_ROUTES) {
        assert.equal(ecBotCoreV78RouteDecision({ method: 'POST', path: route, env }).allowed, true, route);
    }
    for (const route of ['/api/orders', '/api/dropi/apply', '/api/meta/purchase', '/api/admin/import']) {
        assert.equal(ecBotCoreV78RouteDecision({ method: 'POST', path: route, env }).allowed, false, route);
    }
    for (const effect of ['dropi', 'meta', 'capi', 'scheduler', 'followup', 'repurchase']) {
        assert.equal(ecBotCoreV78ExternalEffectDecision(effect, env).allowed, false, effect);
        assert.equal(canaryV75BlockedResult(effect, env)?.blocked, true, effect);
    }
    for (const effect of ['zapi_inbound', 'zapi_outbound_reply', 'panel_attendance_state']) {
        assert.equal(ecBotCoreV78ExternalEffectDecision(effect, env).allowed, true, effect);
    }
    const invalid = { ...env, DISABLE_SCHEDULER: '0' };
    assert.equal(ecBotCoreV78RouteDecision({ method: 'POST', path: '/api/zapi/webhook', env: invalid }).allowed, false);
});

test('guard Mongo permite coleções do núcleo somente dentro da rota V78 e bloqueia orders', async () => {
    class FakeCollection {
        constructor(collectionName) {
            this.collectionName = collectionName;
        }

        updateOne() {
            return `updated:${this.collectionName}`;
        }
    }

    const installed = installEcBotCoreMongooseGuardV78({
        Collection: FakeCollection,
        mongo: { Collection: FakeCollection }
    });
    assert.equal(installed.installed, true);
    assert.ok(installed.patchedMethods >= 1);

    const env = coreEnvironment();
    const previous = new Map();
    for (const [key, value] of Object.entries(env)) {
        previous.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
        process.env[key] = value;
    }
    try {
        const req = { method: 'POST', originalUrl: '/api/zapi/webhook/delivery', body: {} };
        const res = {};
        const allowed = await ecBotCoreMutationRouteGuardV78(req, res, () => (
            new FakeCollection('messages').updateOne()
        ));
        assert.equal(allowed, 'updated:messages');
        await assert.rejects(
            () => ecBotCoreMutationRouteGuardV78(req, res, () => (
                new FakeCollection('orders').updateOne()
            )),
            /ec_bot_core_mongo_write_blocked:orders\.updateOne/
        );
        assert.throws(
            () => new FakeCollection('messages').updateOne(),
            /ec_bot_core_mongo_write_blocked:messages\.updateOne/
        );
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});

test('Dataset compartilhado permanece exato e Browser/CAPI divergente bloqueia perfil e health', () => {
    const env = coreEnvironment();
    assert.equal(EC_BOT_CORE_V78_DATASET_ID, '1468946114265008');
    assert.equal(resolveEcBotCoreV78Configuration(env, {
        browserPixelId: EC_BOT_CORE_V78_DATASET_ID,
        serverDatasetId: EC_BOT_CORE_V78_DATASET_ID
    }).ready, true);
    assert.equal(resolveEcBotCoreV78Configuration(env, {
        browserPixelId: '9999999999999999',
        serverDatasetId: EC_BOT_CORE_V78_DATASET_ID
    }).ready, false);
    const healthy = {
        status: 'online',
        engine: 'Z-API',
        zapi: { connected: true, outboundBlocked: false },
        automationSafety: {
            mode: EC_BOT_CORE_V78_MODE,
            botCoreOperational: true,
            mutatingSchedulers: 0,
            dropiApplyAllowed: false,
            metaPurchaseAllowed: false
        }
    };
    const meta = {
        datasetId: EC_BOT_CORE_V78_DATASET_ID,
        browserPixelId: EC_BOT_CORE_V78_DATASET_ID,
        browserServerSynchronized: true
    };
    assert.equal(assertEcBotCoreV78Health(healthy, meta).ok, true);
    assert.equal(assertEcBotCoreV78PreActivationHealth(healthy, meta).ok, true);
    assert.throws(() => assertEcBotCoreV78Health(healthy, { ...meta, browserServerSynchronized: false }), /browser_server_not_synchronized/);
});

test('bundle operacional V78 é atômico, limitado, single-use e vinculado à identidade', () => {
    const now = Date.parse('2026-08-29T12:00:00.000Z');
    const bundle = buildEcBotCoreOperationalBundleV78({
        ...IDENTITY,
        permitId: 'ec-bot-core-v78-test-permit',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 5 * 60 * 1000).toISOString(),
        functionalPayloadSha256: HASH,
        manifestSha256: HASH,
        releaseMetadataSha256: HASH,
        stagingCompleteSha256: HASH,
        publicationMetadataSha256: HASH,
        publicationCompleteSha256: HASH
    });
    const result = validateEcBotCoreOperationalBundleV78({
        overlay: bundle.overlay,
        attestation: bundle.attestation,
        permit: bundle.permit,
        nowMs: now,
        expected: { ...IDENTITY, permitId: bundle.permit.permitId }
    });
    assert.equal(result.ok, true);
    assert.equal(bundle.permit.singleUse, true);
    assert.equal(bundle.attestation.mutatingSchedulersAllowed, false);
    assert.equal(bundle.attestation.dropiApplyAllowed, false);
    assert.equal(bundle.attestation.metaPurchaseAllowed, false);
    assert.equal(EC_BOT_CORE_V78_AUTHORIZATION_PHRASE, 'I_UNDERSTAND_EC_BOT_CORE_V78');
    assert.equal(EC_BOT_CORE_V78_MAX_PERMIT_MS, 10 * 60 * 1000);
    assert.throws(() => validateEcBotCoreOperationalBundleV78({
        overlay: bundle.overlay.replace('DROPPI_EC_ACTIVE_SYNC_ENABLED=false', 'DROPPI_EC_ACTIVE_SYNC_ENABLED=true'),
        attestation: bundle.attestation,
        permit: bundle.permit,
        nowMs: now
    }), /configuration_invalid|overlay_sha256_mismatch/);
    assert.throws(() => validateEcBotCoreOperationalBundleV78({
        overlay: bundle.overlay,
        attestation: bundle.attestation,
        permit: { ...bundle.permit, status: 'consumed' },
        nowMs: now
    }), /permit_invalid/);
});

test('reset QA exige telefone literal e rejeita parcial, formatação, lista e segundo número', () => {
    assert.equal(assertExactEcQaPhoneV78(EC_QA_TEST_PHONE_V78), EC_QA_TEST_PHONE_V78);
    for (const invalid of [
        '998038637',
        '+55 15 99803-8637',
        `${EC_QA_TEST_PHONE_V78},593991234567`,
        '593991234567',
        `${EC_QA_TEST_PHONE_V78}0`,
        ''
    ]) {
        assert.throws(() => assertExactEcQaPhoneV78(invalid), /must_match_exactly/, invalid);
        assert.throws(() => createEcQaTestPermitV78({ phone: invalid }), /must_match_exactly/, invalid);
    }
    assert.equal(EC_QA_TEST_MAX_WINDOW_MS_V78, 10 * 60 * 1000);
});

test('reset QA é idempotente e preserva histórico, mensagens, pedidos, país e memória', () => {
    const now = new Date('2026-08-29T12:00:00.000Z');
    const permit = deterministicPermit(now);
    const state = qaState();
    const preserved = {
        history: structuredClone(state.history),
        messages: structuredClone(state.messages),
        orders: structuredClone(state.orders),
        countryCode: state.countryCode,
        memory: structuredClone(state.metadata.perAgentMemory),
        publicVslLeadEntry: state.metadata.publicVslLeadEntry
    };
    assert.equal(validateEcQaTestPermitV78(permit, { phone: EC_QA_TEST_PHONE_V78, now }).valid, true);
    const first = applyEcQaTestResetToStateV78({ state, phone: EC_QA_TEST_PHONE_V78, permit, now });
    assert.equal(first.changed, true);
    assert.equal(state.human.mode, 'auto');
    assert.equal(state.human.pausedUntil, null);
    assert.deepEqual(state.history, preserved.history);
    assert.deepEqual(state.messages, preserved.messages);
    assert.deepEqual(state.orders, preserved.orders);
    assert.equal(state.countryCode, preserved.countryCode);
    assert.deepEqual(state.metadata.perAgentMemory, preserved.memory);
    assert.equal(state.metadata.publicVslLeadEntry, preserved.publicVslLeadEntry);
    const afterFirst = JSON.stringify(state);
    const second = applyEcQaTestResetToStateV78({ state, phone: EC_QA_TEST_PHONE_V78, permit, now });
    assert.equal(second.changed, false);
    assert.equal(second.idempotent, true);
    assert.equal(JSON.stringify(state), afterFirst);
});

test('contexto QA é temporário, consumido por uma mensagem e human.manual real continua prioritário', () => {
    const now = new Date('2026-08-29T12:00:00.000Z');
    const permit = deterministicPermit(now);
    const state = qaState();
    applyEcQaTestResetToStateV78({ state, phone: EC_QA_TEST_PHONE_V78, permit, now });
    assert.equal(resolveEcQaTestContextV78(state, { phone: EC_QA_TEST_PHONE_V78, now }).ready, true);
    const consumed = consumeEcQaTestContextV78(state, {
        phone: EC_QA_TEST_PHONE_V78,
        messageId: 'zapi-message-1',
        now
    });
    assert.equal(consumed.consumed, true);
    assert.equal(resolveEcQaTestContextV78(state, {
        phone: EC_QA_TEST_PHONE_V78,
        permitId: permit.permitId,
        messageId: 'zapi-message-1',
        allowConsumed: true,
        now
    }).ready, true);
    assert.equal(resolveEcQaTestContextV78(state, {
        phone: EC_QA_TEST_PHONE_V78,
        permitId: permit.permitId,
        messageId: 'another-message',
        allowConsumed: true,
        now
    }).ready, false);
    state.human.mode = 'manual';
    assert.equal(resolveEcQaTestContextV78(state, {
        phone: EC_QA_TEST_PHONE_V78,
        permitId: permit.permitId,
        messageId: 'zapi-message-1',
        allowConsumed: true,
        now
    }).ready, false);
    assert.throws(() => containEcQaTestContextOnStateV78({
        state,
        phone: EC_QA_TEST_PHONE_V78,
        permitId: permit.permitId,
        now
    }), /real_human_state_protected/);
});

test('containment QA restaura somente o hold anterior e também é idempotente', () => {
    const now = new Date('2026-08-29T12:00:00.000Z');
    const permit = deterministicPermit(now);
    const state = qaState();
    const previousPause = state.human.pausedUntil.toISOString();
    applyEcQaTestResetToStateV78({ state, phone: EC_QA_TEST_PHONE_V78, permit, now });
    const first = containEcQaTestContextOnStateV78({ state, phone: EC_QA_TEST_PHONE_V78, permitId: permit.permitId, now });
    assert.equal(first.changed, true);
    assert.equal(state.human.mode, 'manual');
    assert.equal(state.human.pausedUntil.toISOString(), previousPause);
    const second = containEcQaTestContextOnStateV78({ state, phone: EC_QA_TEST_PHONE_V78, permitId: permit.permitId, now });
    assert.equal(second.changed, false);
    assert.equal(second.idempotent, true);
});

test('assinatura oficial VSL é determinística; mensagem genérica, telefone e origem falsos são rejeitados', () => {
    const valid = recognizeOfficialEcVslEntryV78({
        text: EC_OFFICIAL_VSL_V78_MESSAGE,
        destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP,
        sourceUrl: EC_OFFICIAL_VSL_V78_URL
    });
    assert.equal(valid.recognized, true);
    assert.equal(valid.productKey, 'tex_ultra_ec');
    assert.equal(explicitEcVslProductContextFromText(EC_OFFICIAL_VSL_V78_MESSAGE)?.productKey, 'tex_ultra_ec');
    assert.equal(validateOfficialEcVslOriginContractV78({
        message: EC_OFFICIAL_VSL_V78_MESSAGE,
        destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP,
        sourceUrl: EC_OFFICIAL_VSL_V78_URL
    }).recognized, true);
    for (const fixture of [
        { text: 'Hola, quiero el tratamiento', destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP, sourceUrl: EC_OFFICIAL_VSL_V78_URL },
        { text: EC_OFFICIAL_VSL_V78_MESSAGE, destinationPhone: '553172220518', sourceUrl: EC_OFFICIAL_VSL_V78_URL },
        { text: EC_OFFICIAL_VSL_V78_MESSAGE, destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP, sourceUrl: 'https://example.invalid/fake' },
        { text: 'Vi el video, dame precio', destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP, sourceUrl: '' }
    ]) {
        assert.equal(recognizeOfficialEcVslEntryV78(fixture).recognized, false, JSON.stringify(fixture));
    }
    assert.equal(officialEcVslDestinationPhoneV78({ ZAPI_PHONE: EC_OFFICIAL_VSL_V78_WHATSAPP }), EC_OFFICIAL_VSL_V78_WHATSAPP);
    assert.equal(officialEcVslDestinationPhoneV78({ ZAPI_PHONE: EC_OFFICIAL_VSL_V78_WHATSAPP, WHATSAPP_OFFICIAL_PHONE: '553172220518' }), '');
});

test('middleware QA reivindica atomicamente apenas assinatura oficial no 8637 armado', async () => {
    const calls = [];
    const model = {
        async updateOne(query, update) {
            calls.push({ query, update });
            return { modifiedCount: 1 };
        }
    };
    const valid = await claimEcQaInboundContextV78({
        payload: {
            phone: EC_QA_TEST_PHONE_V78,
            messageId: 'provider-v78-1',
            text: { message: EC_OFFICIAL_VSL_V78_MESSAGE }
        },
        model,
        now: new Date('2026-08-29T12:00:00.000Z')
    });
    assert.equal(valid.allowed, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].query.phoneDigits, EC_QA_TEST_PHONE_V78);
    assert.equal(calls[0].query['metadata.qaTestContextV78.status'], 'armed');
    assert.equal(calls[0].query['metadata.fullFunnelTestEnabled'], true);
    assert.equal(calls[0].update.$set['metadata.qaTestContextV78.status'], 'routing');
    const generic = await claimEcQaInboundContextV78({
        payload: {
            phone: EC_QA_TEST_PHONE_V78,
            messageId: 'provider-v78-2',
            text: { message: 'Hola, quiero el tratamiento' }
        },
        model
    });
    assert.equal(generic.allowed, false);
    assert.equal(calls.length, 1);
    const realEc = await claimEcQaInboundContextV78({
        payload: { phone: '593991234567', messageId: 'real-ec', text: EC_OFFICIAL_VSL_V78_MESSAGE },
        model
    });
    assert.equal(realEc.applicable, false);
    assert.equal(calls.length, 1);
});

test('wiring V78 não cria bypass genérico, não remove human hold e não referencia infraestrutura externa proibida', () => {
    const zapi = fs.readFileSync('src/routes/zapi.js', 'utf8');
    const router = fs.readFileSync('src/services/agentRouter.js', 'utf8');
    const qaReset = fs.readFileSync('src/services/ecQaTestResetV78Service.js', 'utf8');
    const qaCli = fs.readFileSync('scripts/ec-qa-test-reset-v78.mjs', 'utf8');
    const core = fs.readFileSync('src/services/ecBotCoreOperationalV78Service.js', 'utf8');
    const helper = fs.readFileSync('ops/ec-bot-core-v78', 'utf8');
    const integration = fs.readFileSync('src/services/ecBotCoreRuntimeIntegrationV78Service.js', 'utf8');
    assert.match(zapi, /\\btex ultra\\b/);
    assert.match(zapi, /authorizedTestRecipient && publicVslLeadEntry/);
    assert.match(integration, /claimEcQaInboundContextV78/);
    assert.match(integration, /'metadata\.qaTestContextV78\.status': 'armed'/);
    assert.match(integration, /EC_BOT_CORE_V78_MONGO_COLLECTIONS/);
    assert.match(router, /human\.mode === 'manual'/);
    assert.doesNotMatch(qaReset, /publicVslLeadEntry\s*:\s*true/);
    assert.doesNotMatch(qaReset, /delete\s+state\./);
    assert.doesNotMatch(qaCli, /deleteOne|deleteMany|findOneAndDelete|remove\s*\(/);
    for (const operation of ['status', 'plan', 'authorize', 'activate', 'contain']) {
        assert.match(helper, new RegExp(`\\"${operation}\\"`));
    }
    assert.match(helper, /v66-plan/);
    assert.match(helper, /v66-contain/);
    assert.match(helper, /--update-env/);
    assert.doesNotMatch(helper, /source\s+.*\.env/);
    assert.doesNotMatch(helper, /cat\s+.*\.env/);
    const forbiddenCountry = ['colo', 'mbia'].join('');
    const forbiddenDashboard = ['maxt', 'ourus'].join('');
    for (const source of [core, qaReset, zapi, router, helper, integration]) {
        assert.equal(source.toLowerCase().includes(forbiddenCountry), false);
        assert.equal(source.toLowerCase().includes(forbiddenDashboard), false);
    }
});
