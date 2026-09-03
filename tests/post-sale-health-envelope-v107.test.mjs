import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
    POST_SALE_HEALTH_ENVELOPE_V107_OVERRIDE_KEY,
    assertPostSaleHealthEnvelopeV107Manifest
} from '../src/services/postSaleHealthEnvelopeV107Service.js';
import { assertPostSaleEligibleBatchV108Manifest } from '../src/services/postSaleEligibleBatchV108Service.js';

const validHealth = () => ({
    status: 'online',
    engine: 'Z-API',
    zapi: { connected: true },
    automationSafety: {
        operationalMutationsEnabled: true,
        compatibilityBridgeComplete: true,
        dataCompatibilityVersion: 66,
        minimumRuntimeVersion: 66,
        dropiSyncMode: 'REPORT_ONLY',
        dropiApplyAllowed: false
    }
});

test('health V105 aceita JSON compacto e preserva validação semântica', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'post-sale-v107-'));
    const healthFile = path.join(directory, 'health.json');
    const contract = path.resolve('scripts/lib/post-sale-transactional-control-plane-v105.mjs');
    try {
        fs.writeFileSync(healthFile, JSON.stringify(validHealth()));
        assert.equal(spawnSync(process.execPath, [contract, 'health', healthFile]).status, 0);
        const invalid = validHealth();
        invalid.automationSafety.dropiApplyAllowed = true;
        fs.writeFileSync(healthFile, JSON.stringify(invalid));
        assert.notEqual(spawnSync(process.execPath, [contract, 'health', healthFile]).status, 0);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test('helper arquiva somente autorização não consumida após bot core seguro', () => {
    const helper = fs.readFileSync('ops/post-sale-v105', 'utf8');
    assert.match(helper, /abort-authorization/);
    assert.match(helper, /authorization_aborted_after_failed_health/);
    assert.match(helper, /safety\.operationalMutationsEnabled!==false/);
    assert.match(helper, /Number\(safety\.mutatingSchedulers\)!==0/);
    assert.match(helper, /safety\.dropiApplyAllowed!==false/);
    assert.match(helper, /autorização consumida não pode ser abortada/);
});

test('manifesto V107 protege health semântico e abort seguro', () => {
    const successor = assertPostSaleEligibleBatchV108Manifest();
    globalThis[POST_SALE_HEALTH_ENVELOPE_V107_OVERRIDE_KEY] = successor.overrides;
    const result = assertPostSaleHealthEnvelopeV107Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.policy.healthSemanticValidationPreserved, true);
    assert.equal(result.manifest.policy.externalEffectsAllowed, false);
});
