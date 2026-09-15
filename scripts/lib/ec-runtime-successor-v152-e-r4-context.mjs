import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';
import './ec-runtime-successor-v152-e-r3-context.mjs';

const canonicalText = (url) => {
    const text = fs.readFileSync(url, 'utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`);
    return { text, value };
};
const sha256File = (relative) => crypto.createHash('sha256')
    .update(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)))
    .digest('hex');

const current = canonicalText(new URL('../../docs/freeze/ec-whatsapp-persistent-shadow-worker-v152-e-r4-20260912.json', import.meta.url));
assert.equal(current.value.freezeId, 'EC_WHATSAPP_PERSISTENT_SHADOW_WORKER_V152_E_R4_20260912');
assert.equal(current.value.parentCommit, '33e4e69aace895dc2fe4f16f5856d1c824c96900');
assert.equal(current.value.parentTree, '25875c4639e31e5a5de2f94c24be851bd7a7878e');
assert.equal(current.value.functionalCommit, '7d1f7c62fce2416995facf75116e7075dca390d8');
assert.equal(current.value.functionalTree, '709c655566660482a6593396d8fbfbe8d2a7bbb3');
assert.equal(current.value.functionalHash, 'f44c4bc98860d55041f4d71e4581793c3a34a69325dd6bf9c101b35b81ffc32c');
assert.equal(current.value.candidateTag, 'candidate-v152-e-r4-persistent-shadow-worker-20260912');
assert.equal(current.value.freezeTag, 'freeze-candidate-v152-e-r4-persistent-shadow-worker-20260912');
assert.equal(current.value.policy.phase, 'V152-E-R4_PERSISTENT_SHADOW_WORKER');
assert.equal(current.value.policy.processName, 'vitalismen-whatsapp-web-shadow-v152-e-r4');
assert.equal(current.value.policy.supervisor, 'PM2_FORK_SINGLE_INSTANCE');
assert.equal(current.value.policy.testChannelPhone, '5531983002800');
assert.equal(current.value.policy.channelId, 'V152_TEST_WEB_01');
assert.equal(current.value.policy.sessionNamespace, 'V152_TEST_WEB_01');
assert.equal(current.value.policy.productionPhone, '5531971862958');
assert.equal(current.value.policy.productionProvider, 'ZAPI');
assert.equal(current.value.policy.shadow, true);
assert.equal(current.value.policy.draining, true);
assert.equal(current.value.policy.weight, 0);
assert.equal(current.value.policy.capacity, 0);
assert.equal(current.value.policy.singleSocket, true);
assert.equal(current.value.policy.boundedReconnect, true);
assert.equal(current.value.policy.terminalDisconnectFailClosed, true);
assert.equal(current.value.policy.customerInboundRouting, false);
assert.equal(current.value.policy.outboundQueueConsumption, false);
assert.equal(current.value.policy.customerRouting, false);
assert.equal(current.value.policy.handoff, false);
assert.equal(current.value.policy.failover, false);
assert.equal(current.value.policy.zapiShutdown, false);
assert.equal(current.value.policy.cutover, false);
assert.equal(current.value.policy.qrGenerated, false);
assert.equal(current.value.policy.pairingCodeRequests, 0);
assert.equal(current.value.policy.pairingRequests, 0);

const currentOverrides = new Set(Object.keys(current.value.protectedFiles));
assert.deepEqual([...currentOverrides].sort(), [...current.value.overrides].sort());
const successorOverrides = new Set(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []);
for (const [file, expected] of Object.entries(current.value.protectedFiles)) {
    if (successorOverrides.has(file)) continue;
    assert.equal(sha256File(file), expected, `[V152-E-R4] ${file}`);
}

const effectiveProtectedFiles = Object.freeze(Object.fromEntries(
    Object.entries(current.value.protectedFiles).filter(([file]) => !successorOverrides.has(file))
));
const successorProtectedFiles = Object.freeze({
    ...(globalThis.__VITALISMEN_V155_CONTEXT?.protectedFiles || {}),
    ...(globalThis.__VITALISMEN_V162_CONTEXT?.protectedFiles || {})
});

for (const contextKey of [
    '__VITALISMEN_V148_CONTEXT',
    '__VITALISMEN_V152_B_CONTEXT',
    '__VITALISMEN_V152_C0_CONTEXT',
    '__VITALISMEN_V152_C0_R1_CONTEXT',
    '__VITALISMEN_V152_E_CONTEXT',
    '__VITALISMEN_V152_E_R1_CONTEXT',
    '__VITALISMEN_V152_E_R2_CONTEXT',
    '__VITALISMEN_V152_E_R3_CONTEXT'
]) {
    const inherited = globalThis[contextKey];
    if (!inherited?.loaded) continue;
    globalThis[contextKey] = Object.freeze({
        ...inherited,
        protectedFiles: Object.freeze({
            ...inherited.protectedFiles,
            ...effectiveProtectedFiles,
            ...successorProtectedFiles
        })
    });
}

globalThis.__VITALISMEN_V152_E_R4_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: current.value.freezeId,
    manifestSha256: crypto.createHash('sha256').update(current.text).digest('hex'),
    functionalHash: current.value.functionalHash,
    protectedFiles: Object.freeze({ ...effectiveProtectedFiles, ...successorProtectedFiles })
});

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...currentOverrides])];
}
