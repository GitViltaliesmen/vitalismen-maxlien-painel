import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';
import './ec-runtime-successor-v152-e-r2-context.mjs';

const canonicalText = (url) => {
    const text = fs.readFileSync(url, 'utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`);
    return { text, value };
};
const sha256File = (relative) => crypto.createHash('sha256')
    .update(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)))
    .digest('hex');

const current = canonicalText(new URL('../../docs/freeze/ec-whatsapp-br-jid-auth-flush-v152-e-r3-20260912.json', import.meta.url));
assert.equal(current.value.freezeId, 'EC_WHATSAPP_BR_JID_AUTH_FLUSH_V152_E_R3_20260912');
assert.equal(current.value.parentCommit, '0aea21f5bf3760b09a694e4e3e6c70670cc4fc0d');
assert.equal(current.value.functionalCommit, '2a52688083c079f398d4cf5c7060d99e6cf0d922');
assert.equal(current.value.functionalTree, '35809f3ec2abb655da4c3e24ac8ee8fff39a34f4');
assert.equal(current.value.functionalHash, 'e5ee27bb45bd8790714d6731e5b100e0c8d6fa710620515d730480522d5a0545');
assert.equal(current.value.policy.phase, 'V152-E-R3_BR_JID_NORMALIZATION_AND_AUTH_FLUSH_GATE');
assert.equal(current.value.policy.baileysVersion, '6.7.24');
assert.equal(current.value.policy.phoneNormalization, 'AUTHENTICATED_PROVIDER_EVIDENCE_ONLY');
assert.equal(current.value.policy.restartRequired515Gate, 'AUTH_FLUSH_EVENT_GATE');
assert.equal(current.value.policy.saveCredsEventGate, true);
assert.equal(current.value.policy.pendingAuthWritesGate, true);
assert.equal(current.value.policy.keyStoreRequiredAt515, false);
assert.equal(current.value.policy.keyStoreRequiredBeforeRestart, false);
assert.equal(current.value.policy.customerRouting, false);
assert.equal(current.value.policy.handoff, false);
assert.equal(current.value.policy.failover, false);
assert.equal(current.value.policy.zapiShutdown, false);
assert.equal(current.value.policy.cutover, false);
assert.equal(current.value.policy.qrGenerated, false);
assert.equal(current.value.policy.pairingRequests, 0);
assert.equal(current.value.policy.whatsappWebProviderCalls, 0);
assert.equal(current.value.policy.newApprovalRequiredBeforeQr, true);

const currentOverrides = new Set(Object.keys(current.value.protectedFiles));
assert.deepEqual([...currentOverrides].sort(), [...current.value.overrides].sort());
for (const [file, expected] of Object.entries(current.value.protectedFiles)) {
    assert.equal(sha256File(file), expected, `[V152-E-R3] ${file}`);
}

for (const contextKey of [
    '__VITALISMEN_V148_CONTEXT',
    '__VITALISMEN_V152_B_CONTEXT',
    '__VITALISMEN_V152_C0_CONTEXT',
    '__VITALISMEN_V152_C0_R1_CONTEXT',
    '__VITALISMEN_V152_E_CONTEXT',
    '__VITALISMEN_V152_E_R1_CONTEXT',
    '__VITALISMEN_V152_E_R2_CONTEXT'
]) {
    const inherited = globalThis[contextKey];
    if (!inherited?.loaded) continue;
    globalThis[contextKey] = Object.freeze({
        ...inherited,
        protectedFiles: Object.freeze({ ...inherited.protectedFiles, ...current.value.protectedFiles })
    });
}

globalThis.__VITALISMEN_V152_E_R3_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: current.value.freezeId,
    manifestSha256: crypto.createHash('sha256').update(current.text).digest('hex'),
    functionalHash: current.value.functionalHash,
    protectedFiles: Object.freeze({ ...current.value.protectedFiles })
});

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...currentOverrides])];
}
