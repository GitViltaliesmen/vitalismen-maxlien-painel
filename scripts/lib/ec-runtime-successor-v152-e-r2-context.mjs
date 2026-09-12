import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';
import './ec-runtime-successor-v152-e-r1-context.mjs';

const canonicalText = (url) => {
    const text = fs.readFileSync(url, 'utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`);
    return { text, value };
};
const sha256File = (relative) => crypto.createHash('sha256')
    .update(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)))
    .digest('hex');

const current = canonicalText(new URL('../../docs/freeze/ec-whatsapp-native-pairing-code-v152-e-r2-20260912.json', import.meta.url));
assert.equal(current.value.freezeId, 'EC_WHATSAPP_NATIVE_PAIRING_CODE_V152_E_R2_20260912');
assert.equal(current.value.policy.basePhase, 'V152-E-R1_REAL_PAIRING_TEST_CHANNEL');
assert.equal(current.value.policy.pairingPatch, 'V152-E-R2_NATIVE_PAIRING_CODE');
assert.equal(current.value.policy.pairingMethod, 'PAIRING_CODE');
assert.equal(current.value.policy.testChannelPhone, '5531983002800');
assert.equal(current.value.policy.channelId, 'V152_TEST_WEB_01');
assert.equal(current.value.policy.sessionNamespace, 'V152_TEST_WEB_01');
assert.equal(current.value.policy.productionPhone, '5531971862958');
assert.equal(current.value.policy.productionProvider, 'ZAPI');
assert.equal(current.value.policy.pairingCodePersistence, false);
assert.equal(current.value.policy.qrGeneratedForPairingCode, false);
assert.equal(current.value.policy.shadow, true);
assert.equal(current.value.policy.draining, true);
assert.equal(current.value.policy.weight, 0);
assert.equal(current.value.policy.capacity, 0);
assert.equal(current.value.policy.customerRouting, false);
assert.equal(current.value.policy.handoff, false);
assert.equal(current.value.policy.failover, false);
assert.equal(current.value.policy.zapiShutdown, false);
assert.equal(current.value.policy.cutover, false);
assert.equal(current.value.policy.newApprovalRequiredBeforeCutover, true);

const currentOverrides = new Set(Object.keys(current.value.protectedFiles));
assert.deepEqual([...currentOverrides].sort(), [...current.value.overrides].sort());
for (const [file, expected] of Object.entries(current.value.protectedFiles)) {
    assert.equal(sha256File(file), expected, `[V152-E-R2] ${file}`);
}

for (const contextKey of [
    '__VITALISMEN_V148_CONTEXT',
    '__VITALISMEN_V152_B_CONTEXT',
    '__VITALISMEN_V152_C0_CONTEXT',
    '__VITALISMEN_V152_C0_R1_CONTEXT',
    '__VITALISMEN_V152_E_CONTEXT',
    '__VITALISMEN_V152_E_R1_CONTEXT'
]) {
    const inherited = globalThis[contextKey];
    if (!inherited?.loaded) continue;
    globalThis[contextKey] = Object.freeze({
        ...inherited,
        protectedFiles: Object.freeze({ ...inherited.protectedFiles, ...current.value.protectedFiles })
    });
}

globalThis.__VITALISMEN_V152_E_R2_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: current.value.freezeId,
    manifestSha256: crypto.createHash('sha256').update(current.text).digest('hex'),
    protectedFiles: Object.freeze({ ...current.value.protectedFiles })
});

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...currentOverrides])];
}
