import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    assertDeployHealthBridgeSemanticsV76,
    assertDeployHealthRuntimeContainmentV76,
    assertDeployHelperBridgeSemanticsSourceV76,
    DEPLOY_HEALTH_V76_EXPECTED_RUNTIME_ENV,
    DEPLOY_HEALTH_V76_EXPECTED_SAFETY,
    evaluateDeployHealthBridgeSemanticsV76,
    evaluateDeployHealthRuntimeContainmentV76
} from '../scripts/lib/deploy-health-bridge-semantics-contract-v76.mjs';
import {
    CANARY_V75_QA_PHONE,
    CANARY_V75_RECIPIENT_LIST_FLAGS,
    CANARY_V75_REQUIRED_FALSE_FLAGS,
    CANARY_V75_REQUIRED_TRUE_FLAGS,
    evaluateCanaryV75ExternalEffect
} from '../src/services/canaryIsolationV75Service.js';
import {
    assertMutationAllowed,
    strictReadOnlyHealthContract
} from '../src/services/strictReadOnlyObservationService.js';

const safeHealth = () => ({
    status: 'online',
    degradedReasons: [],
    automationSafety: {
        ...DEPLOY_HEALTH_V76_EXPECTED_SAFETY,
        allowedWriteClasses: []
    }
});

const safeRuntimeEnv = () => ({ ...DEPLOY_HEALTH_V76_EXPECTED_RUNTIME_ENV });

const validCanaryEnv = () => {
    const env = {
        NODE_ENV: 'production',
        DISABLE_SCHEDULER: '0',
        DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY',
        POST_SALE_V66_MUTATIONS_AUTHORIZATION: 'I_UNDERSTAND_V66_OPERATIONAL_MUTATIONS',
        META_TEST_EVENT_CODE_EC: '',
        META_TEST_EVENT_CODE: '',
        VITALISMEN_CANARY_V75_ENABLED: 'true'
    };
    for (const flag of CANARY_V75_REQUIRED_TRUE_FLAGS) env[flag] = 'true';
    for (const flag of CANARY_V75_REQUIRED_FALSE_FLAGS) env[flag] = 'false';
    for (const flag of CANARY_V75_RECIPIENT_LIST_FLAGS) env[flag] = CANARY_V75_QA_PHONE;
    return env;
};

test('bridgeComplete=true é aceito como prova persistente com runtime integralmente contido', () => {
    assert.equal(assertDeployHealthBridgeSemanticsV76(safeHealth()).ok, true);
    assert.equal(assertDeployHealthRuntimeContainmentV76(safeRuntimeEnv()).ok, true);
    assert.equal(safeHealth().automationSafety.compatibilityBridgeComplete, true);
    assert.equal(safeRuntimeEnv().POST_SALE_V66_COMPATIBILITY_BRIDGE_READY, 'false');
});

test('health falha fechado para migração incompleta, versões divergentes, writes, schedulers, mutações ou Dropi APPLY', () => {
    const cases = [
        ['compatibilityBridgeComplete', false],
        ['dataCompatibilityVersion', 65],
        ['minimumRuntimeVersion', 65],
        ['allowedWriteClasses', ['shipment_update']],
        ['mutatingRoutesEnabled', true],
        ['mutatingSchedulers', 1],
        ['operationalMutationsEnabled', true],
        ['dropiSyncMode', 'APPLY'],
        ['dropiApplyAllowed', true]
    ];

    for (const [field, value] of cases) {
        const health = safeHealth();
        health.automationSafety[field] = value;
        assert.equal(evaluateDeployHealthBridgeSemanticsV76(health).ok, false, field);
    }
});

test('overlay/runtime falha fechado para bridge-ready, mutações, autorizações, schedulers, provider ou Dropi APPLY', () => {
    const cases = [
        ['POST_SALE_V66_COMPATIBILITY_BRIDGE_READY', 'true'],
        ['POST_SALE_V66_MUTATIONS_ENABLED', 'true'],
        ['POST_SALE_V66_MUTATIONS_AUTHORIZATION', 'I_UNDERSTAND_V66_OPERATIONAL_MUTATIONS'],
        ['POST_SALE_V66_BRIDGE_APPLY_APPROVED', 'I_UNDERSTAND_V66_BRIDGE_NO_REPLAY'],
        ['DISABLE_SCHEDULER', '0'],
        ['SHIPMENT_STATUS_DISPATCH_ENABLED', 'true'],
        ['WHATSAPP_CONNECT_ENABLED', 'true'],
        ['WHATSAPP_AUTO_REPLY_ENABLED', 'true'],
        ['DROPPI_EC_ACTIVE_SYNC_ENABLED', 'true'],
        ['DROPPI_EC_ACTIVE_SYNC_MODE', 'APPLY']
    ];

    for (const [field, value] of cases) {
        const env = safeRuntimeEnv();
        env[field] = value;
        assert.equal(evaluateDeployHealthRuntimeContainmentV76(env).ok, false, field);
    }
});

test('STRICT_READ_ONLY mantém provider, banco, Dropi APPLY e Meta bloqueados', () => {
    const env = safeRuntimeEnv();
    const health = strictReadOnlyHealthContract(env);
    assert.equal(health.strictReadOnly, true);
    assert.equal(health.mutatingSchedulers, 0);
    assert.equal(health.dropiApplyAllowed, false);

    for (const capability of ['zapi_provider_send', 'mongodb_write', 'dropi_apply', 'meta_event']) {
        assert.throws(
            () => assertMutationAllowed({ capability, source: 'v76_negative_test', env }),
            (error) => error?.code === 'STRICT_READ_ONLY_OPERATION_BLOCKED',
            capability
        );
    }
});

test('o canário V75 continua negando Dropi e Meta até para o único QA', () => {
    const env = validCanaryEnv();
    for (const effect of ['dropi', 'meta']) {
        const decision = evaluateCanaryV75ExternalEffect(effect, env);
        assert.equal(decision.enforced, true);
        assert.equal(decision.allowed, false);
    }
});

test('helper contém a nova semântica e recusa regressão ao predicado legado', () => {
    const helper = fs.readFileSync('ops/vitalismen-stage', 'utf8');
    const contract = assertDeployHelperBridgeSemanticsSourceV76(helper);
    assert.equal(contract.healthPersistentBridgeRequired, true);
    assert.equal(contract.operationalBridgeReady, false);
    assert.equal(contract.mutatingSchedulers, 0);
    assert.equal(contract.dropiMode, 'REPORT_ONLY');

    const regressed = helper.replace(
        'safety.compatibilityBridgeComplete !== true',
        'safety.compatibilityBridgeComplete !== false'
    );
    assert.throws(
        () => assertDeployHelperBridgeSemanticsSourceV76(regressed),
        /predicado legado/
    );
});
