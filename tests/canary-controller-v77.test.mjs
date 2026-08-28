import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    CANARY_CONTROLLER_V77_BASE_COMMIT,
    CANARY_CONTROLLER_V77_BASE_RELEASE,
    CANARY_CONTROLLER_V77_BASE_TAG,
    CANARY_CONTROLLER_V77_BASE_TREE,
    CANARY_CONTROLLER_V77_MAX_PERMIT_MS,
    CANARY_CONTROLLER_V77_MAX_WINDOW_MS,
    CANARY_CONTROLLER_V77_QA_PHONE,
    assertCanaryControllerV77Health,
    calculateCanaryControllerV77ProfileSha256,
    resolveCanaryControllerV77Runtime
} from '../src/services/canaryControllerV77Service.js';
import {
    CANARY_CONTROLLER_V77_AUTHORIZATION_PHRASE,
    buildCanaryControllerV77Bundle,
    buildCanaryControllerV77Environment,
    validateCanaryControllerV77Bundle
} from '../scripts/lib/canary-controller-contract-v77.mjs';
import {
    CANARY_V75_QA_PHONE,
    CANARY_V75_RECIPIENT_LIST_FLAGS,
    assertCanaryV75Recipient,
    buildCanaryV75RecipientQuery,
    evaluateCanaryV75ExternalEffect,
    evaluateCanaryV75Recipient,
    resolveCanaryV75Configuration
} from '../src/services/canaryIsolationV75Service.js';

const TARGET = Object.freeze({
    release: '20260828T220000Z_production-20260828-7777777',
    commit: '7777777777777777777777777777777777777777',
    tree: '6666666666666666666666666666666666666666',
    tag: 'production-20260828-7777777'
});
const HASH = 'a'.repeat(64);

const environmentAt = (startedAt = Date.now(), expiresAt = startedAt + CANARY_CONTROLLER_V77_MAX_WINDOW_MS) => (
    buildCanaryControllerV77Environment({
        ...TARGET,
        permitId: 'v77-test-permit',
        startedAt,
        expiresAt
    })
);

const expiredEnvironmentAt = (nowMs = Date.now()) => {
    const env = { ...environmentAt(nowMs, nowMs + CANARY_CONTROLLER_V77_MAX_WINDOW_MS) };
    env.VITALISMEN_CANARY_V77_STARTED_AT = new Date(nowMs - CANARY_CONTROLLER_V77_MAX_WINDOW_MS).toISOString();
    env.VITALISMEN_CANARY_V77_EXPIRES_AT = new Date(nowMs - 1).toISOString();
    env.VITALISMEN_CANARY_V77_PROFILE_SHA256 = calculateCanaryControllerV77ProfileSha256(env);
    return env;
};

const bundleAt = (nowMs = Date.now(), overrides = {}) => buildCanaryControllerV77Bundle({
    ...TARGET,
    permitId: 'v77-test-permit',
    createdAt: new Date(nowMs).toISOString(),
    permitExpiresAt: new Date(nowMs + CANARY_CONTROLLER_V77_MAX_PERMIT_MS).toISOString(),
    windowExpiresAt: new Date(nowMs + CANARY_CONTROLLER_V77_MAX_WINDOW_MS).toISOString(),
    manifestSha256: HASH,
    releaseMetadataSha256: HASH,
    stagingCompleteSha256: HASH,
    publicationMetadataSha256: HASH,
    publicationCompleteSha256: HASH,
    ...overrides
});

const validate = (bundle, nowMs = Date.now()) => validateCanaryControllerV77Bundle({
    overlay: bundle.overlay,
    attestation: bundle.attestation,
    permit: bundle.permit,
    nowMs,
    expected: {
        ...TARGET,
        permitId: 'v77-test-permit',
        baselineRelease: CANARY_CONTROLLER_V77_BASE_RELEASE,
        baselineCommit: CANARY_CONTROLLER_V77_BASE_COMMIT,
        baselineTree: CANARY_CONTROLLER_V77_BASE_TREE,
        baselineTag: CANARY_CONTROLLER_V77_BASE_TAG,
        qaPhone: CANARY_CONTROLLER_V77_QA_PHONE,
        manifestSha256: HASH,
        releaseMetadataSha256: HASH,
        stagingCompleteSha256: HASH,
        publicationMetadataSha256: HASH,
        publicationCompleteSha256: HASH
    }
});

const healthyCanary = () => ({
    status: 'online',
    degradedReasons: [],
    automationSafety: {
        strictReadOnly: false,
        operationalMutationsEnabled: true,
        compatibilityBridgeComplete: true,
        dataCompatibilityVersion: 66,
        minimumRuntimeVersion: 66,
        dropiSyncMode: 'REPORT_ONLY',
        dropiApplyAllowed: false
    }
});

test('perfil V77 íntegro aceita exclusivamente o QA nas cinco allowlists', () => {
    const env = environmentAt();
    const controller = resolveCanaryControllerV77Runtime(env);
    const canary = resolveCanaryV75Configuration(env);
    assert.equal(controller.ready, true);
    assert.equal(canary.ready, true);
    assert.equal(CANARY_V75_QA_PHONE, '5515998038637');
    assert.equal(CANARY_V75_RECIPIENT_LIST_FLAGS.length, 5);
    for (const flag of CANARY_V75_RECIPIENT_LIST_FLAGS) {
        assert.equal(env[flag], CANARY_V75_QA_PHONE);
    }
    assert.equal(evaluateCanaryV75Recipient(CANARY_V75_QA_PHONE, { env }).allowed, true);
    assert.equal(evaluateCanaryV75Recipient('+55 (15) 99803-8637@s.whatsapp.net', { env }).allowed, true);
    assert.doesNotThrow(() => assertCanaryV75Recipient(CANARY_V75_QA_PHONE, { env, surface: 'provider' }));
});

test('outro telefone, prefixo, sufixo, JID sem identidade e segundo item falham fechados', () => {
    const env = environmentAt();
    for (const recipient of [
        '593991234567',
        `593${CANARY_V75_QA_PHONE}`,
        `${CANARY_V75_QA_PHONE}0`,
        '@s.whatsapp.net',
        '',
        '5515991418416'
    ]) {
        assert.equal(evaluateCanaryV75Recipient(recipient, { env }).allowed, false, recipient);
    }
    const second = {
        ...env,
        WHATSAPP_AUTOMATION_ALLOWED_RECIPIENTS: `${CANARY_V75_QA_PHONE},593991234567`
    };
    assert.equal(resolveCanaryV75Configuration(second).ready, false);
});

test('queries Mongo limitam status, retirada, prova, decisões, ledgers e locks ao QA integral', () => {
    const env = environmentAt();
    for (const path of ['client.phone', 'recipientPhone', 'postSale.phone', 'ledger.phone', 'lock.phone']) {
        const query = buildCanaryV75RecipientQuery(path, env);
        const matcher = query[path];
        assert.ok(matcher instanceof RegExp);
        assert.equal(matcher.test(CANARY_V75_QA_PHONE), true);
        assert.equal(matcher.test(`593${CANARY_V75_QA_PHONE}`), false);
        assert.equal(matcher.test(`${CANARY_V75_QA_PHONE}0`), false);
    }
    const expired = expiredEnvironmentAt();
    assert.deepEqual(buildCanaryV75RecipientQuery('client.phone', expired), { _id: { $exists: false } });
});

test('provider de outro telefone e todos os efeitos externos proibidos permanecem bloqueados', () => {
    const env = environmentAt();
    assert.throws(
        () => assertCanaryV75Recipient('593991234567', { env, surface: 'zapi_provider_text' }),
        /canary_v75_non_qa_recipient/
    );
    for (const effect of [
        'dropi', 'meta', 'capi', 'carrier_sweep', 'guide_print', 'automatic_bonus',
        'repurchase', 'followup', 'backlog', 'second_recipient'
    ]) {
        assert.equal(evaluateCanaryV75ExternalEffect(effect, env).allowed, false, effect);
    }
    for (const flag of [
        'DROPPI_EC_ACTIVE_SYNC_ENABLED', 'SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED',
        'SHIPMENT_GUIDE_PRINT_DISPATCH_ENABLED', 'PICKUP_PROOF_BONUS_ENABLED',
        'POST_SALE_REPURCHASE_30D_ENABLED', 'WHATSAPP_PRODUCT_FOLLOWUP_ENABLED',
        'PENDING_CHECKOUT_FOLLOWUP_ENABLED', 'WHATSAPP_BACKLOG_RECOVERY_ENABLED',
        'META_RETRO_SEND'
    ]) {
        assert.equal(env[flag], 'false', flag);
    }
    assert.equal(env.DROPPI_EC_ACTIVE_SYNC_MODE, 'REPORT_ONLY');
});

test('expiração bloqueia novos efeitos e remoção isolada da flag V75 é inválida', () => {
    const now = Date.now();
    const expired = expiredEnvironmentAt(now);
    const state = resolveCanaryControllerV77Runtime(expired, { nowMs: now });
    assert.equal(state.ready, false);
    assert.equal(state.expired, true);
    assert.ok(state.failures.includes('window_expired'));
    assert.equal(evaluateCanaryV75Recipient(CANARY_V75_QA_PHONE, { env: expired }).allowed, false);
    assert.deepEqual(buildCanaryV75RecipientQuery('client.phone', expired), { _id: { $exists: false } });

    const flagRemoved = { ...environmentAt(), VITALISMEN_CANARY_V75_ENABLED: 'false' };
    flagRemoved.VITALISMEN_CANARY_V77_PROFILE_SHA256 = calculateCanaryControllerV77ProfileSha256(flagRemoved);
    assert.equal(resolveCanaryControllerV77Runtime(flagRemoved).ready, false);
    assert.ok(resolveCanaryControllerV77Runtime(flagRemoved).failures.includes('VITALISMEN_CANARY_V75_ENABLED_must_be_true'));
    const pilotAlsoRemoved = {
        ...flagRemoved,
        WHATSAPP_AUTOMATION_PILOT_ONLY: 'false'
    };
    assert.equal(resolveCanaryV75Configuration(pilotAlsoRemoved).enabled, true);
    assert.equal(evaluateCanaryV75Recipient(CANARY_V75_QA_PHONE, { env: pilotAlsoRemoved }).allowed, false);
});

test('permit e attestation vinculam release, tree, tag, baseline, QA e hashes', () => {
    const now = Date.now();
    const bundle = bundleAt(now);
    assert.equal(validate(bundle, now).ok, true);
    assert.equal(bundle.permit.singleUse, true);
    assert.equal(bundle.permit.baselineCommit, CANARY_CONTROLLER_V77_BASE_COMMIT);
    assert.equal(bundle.permit.baselineTree, CANARY_CONTROLLER_V77_BASE_TREE);
    assert.equal(bundle.permit.qaPhone, CANARY_CONTROLLER_V77_QA_PHONE);
    assert.equal(CANARY_CONTROLLER_V77_AUTHORIZATION_PHRASE, 'I_UNDERSTAND_V77_QA_CANARY');
});

test('permit reutilizado, vencido ou acima de 10 minutos é rejeitado', () => {
    const now = Date.now();
    const bundle = bundleAt(now);
    assert.throws(() => validate({ ...bundle, permit: { ...bundle.permit, status: 'consumed' } }, now), /permit_invalid/);

    const old = bundleAt(now - 11 * 60 * 1000, {
        permitExpiresAt: new Date(now - 60 * 1000).toISOString(),
        windowExpiresAt: new Date(now + 49 * 60 * 1000).toISOString()
    });
    assert.throws(() => validate(old, now), /permit_expired_or_invalid/);
    assert.throws(() => bundleAt(now, {
        permitExpiresAt: new Date(now + CANARY_CONTROLLER_V77_MAX_PERMIT_MS + 1).toISOString()
    }), /permit_window_invalid/);
});

test('janela acima de 60 minutos, hash divergente e rollback incompatível são rejeitados', () => {
    const now = Date.now();
    assert.throws(() => bundleAt(now, {
        windowExpiresAt: new Date(now + CANARY_CONTROLLER_V77_MAX_WINDOW_MS + 1).toISOString()
    }), /canary_window_invalid/);

    const bundle = bundleAt(now);
    assert.throws(() => validate({
        ...bundle,
        overlay: bundle.overlay.replace('WHATSAPP_BACKLOG_RECOVERY_ENABLED=false', 'WHATSAPP_BACKLOG_RECOVERY_ENABLED=true')
    }, now), /overlay_sha256_mismatch/);
    assert.throws(() => validate({
        ...bundle,
        permit: { ...bundle.permit, rollbackCompatibility: 'UNSAFE_OR_NOT_SUPPORTED' }
    }, now), /rollback_incompatible/);
});

test('health divergente impede canário; health operacional QA com Dropi REPORT_ONLY é aceito', () => {
    assert.equal(assertCanaryControllerV77Health(healthyCanary()).ok, true);
    for (const health of [
        { ...healthyCanary(), status: 'degraded', degradedReasons: ['zapi_not_connected'] },
        { ...healthyCanary(), automationSafety: { ...healthyCanary().automationSafety, compatibilityBridgeComplete: false } },
        { ...healthyCanary(), automationSafety: { ...healthyCanary().automationSafety, dropiSyncMode: 'APPLY' } },
        { ...healthyCanary(), automationSafety: { ...healthyCanary().automationSafety, dropiApplyAllowed: true } }
    ]) {
        assert.throws(() => assertCanaryControllerV77Health(health), /canary_controller_v77_health_invalid/);
    }
});

test('helper implementa autorização root, consumo preservado, ativação sem switch e contenção strict explícita', () => {
    const helper = fs.readFileSync('ops/vitalismen-stage', 'utf8');
    assert.match(helper, /v77-canary-authorize/);
    assert.match(helper, /VITALISMEN_CANARY_V77_AUTHORIZE/);
    assert.match(helper, /I_UNDERSTAND_V77_QA_CANARY/);
    assert.match(helper, /canary-v77-permit\.consumed\.\$\{canary_v77_permit_id\}\.json/);
    assert.match(helper, /permit V77 ausente, consumido ou reutilizado/);
    assert.match(helper, /v77-canary-contain/);
    assert.match(helper, /V77_CANARY_CONTAINMENT=STRICT_READ_ONLY_RESTORED/);
    assert.match(helper, /VITALISMEN_CANARY_CTRL_V77_ENABLED=false/);
    assert.match(helper, /VITALISMEN_CANARY_V75_ENABLED=false/);
    const activation = helper.slice(
        helper.indexOf('if [[ "$action" == "v77-canary-activate" ]]'),
        helper.indexOf('if [[ "$action" == "v77-canary-contain" ]]')
    );
    assert.doesNotMatch(activation, /switch_current_v66/);
    assert.doesNotMatch(activation, /DROPPI_EC_ACTIVE_SYNC_MODE=APPLY/);
});

test('integrações existentes mantêm guards QA em inbound, outbound, queries, decisões e provider final', () => {
    const sources = {
        inboundZapi: fs.readFileSync('src/routes/zapi.js', 'utf8'),
        inboundVsl: fs.readFileSync('src/routes/whatsapp.js', 'utf8'),
        outbound: fs.readFileSync('src/whatsapp/outboundGuard.js', 'utf8'),
        provider: fs.readFileSync('src/services/zapiClient.js', 'utf8'),
        status: fs.readFileSync('src/services/shipmentStatusDispatcherService.js', 'utf8'),
        pickup: fs.readFileSync('src/services/shipmentMessageService.js', 'utf8'),
        proof: fs.readFileSync('src/services/postSalePickupReconciliationService.js', 'utf8'),
        decision: fs.readFileSync('src/services/postSaleNotificationDecisionService.js', 'utf8')
    };
    assert.match(sources.inboundZapi, /evaluateCanaryV75Recipient/);
    assert.match(sources.inboundVsl, /evaluateCanaryV75Recipient/);
    assert.match(sources.outbound, /evaluateCanaryV75Recipient/);
    assert.match(sources.provider, /assertCanaryV75Recipient/);
    assert.match(sources.status, /buildCanaryV75RecipientQuery/);
    assert.match(sources.pickup, /buildCanaryV75RecipientQuery/);
    assert.match(sources.proof, /buildCanaryV75RecipientQuery/);
    assert.match(sources.decision, /canaryV75SchedulerShipmentAllowed/);
});
