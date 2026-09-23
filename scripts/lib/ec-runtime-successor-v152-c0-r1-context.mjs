import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const canonicalText = (url) => {
    const text = fs.readFileSync(url, 'utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`);
    return { text, value };
};
const sha256File = (relative) => crypto.createHash('sha256')
    .update(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)))
    .digest('hex');

const r1 = canonicalText(new URL('../../docs/freeze/ec-multi-channel-control-plane-v152-c0-r1-20260912.json', import.meta.url));
assert.equal(r1.value.freezeId, 'EC_MULTI_CHANNEL_CONTROL_PLANE_V152_C0_R1_20260912');
assert.equal(r1.value.parentCommit, 'c205a587328a973d99ca4c4008b08144b28681d9');
assert.equal(r1.value.parentTree, 'ade9b0c1095417d4f4f193ef890f6af185d7ad9d');
assert.equal(r1.value.policy.publicationAllowed, false);
assert.equal(r1.value.policy.productionChanged, false);
assert.equal(r1.value.policy.functionalBehaviorChanged, false);
assert.equal(r1.value.policy.providerBehaviorChanged, false);
assert.equal(r1.value.policy.routingBehaviorChanged, false);
assert.equal(r1.value.policy.shadowBehaviorChanged, false);
assert.equal(r1.value.policy.realPairing, 0);
assert.equal(r1.value.policy.realOutbound, 0);
assert.equal(r1.value.policy.realCustomerRouting, 0);
assert.equal(r1.value.policy.realHandoff, 0);
assert.equal(r1.value.policy.realFailover, 0);
assert.equal(r1.value.identifier.from, 'WHATSAPP_WEB_TEST_TEMPLATE');
assert.equal(r1.value.identifier.to, 'WHATSAPP_WEB_TEMPLATE');

const c0 = canonicalText(new URL('../../docs/freeze/ec-multi-channel-control-plane-v152-c0-20260912.json', import.meta.url));
const v152 = canonicalText(new URL('../../docs/freeze/ec-provider-independent-core-v152-b-20260911.json', import.meta.url));
const v148 = canonicalText(new URL('../../docs/freeze/ec-meta-funnel-v148-20260910.json', import.meta.url));
const r1Overrides = new Set(Object.keys(r1.value.protectedFiles));
const c0Overrides = new Set(Object.keys(c0.value.protectedFiles));
const v152Overrides = new Set(Object.keys(v152.value.protectedFiles));

assert.deepEqual([...r1Overrides].sort(), [...r1.value.overrides].sort());
for (const [file, expected] of Object.entries({ ...v148.value.preservedFiles, ...v148.value.protectedFiles })) {
    if (v152Overrides.has(file) || c0Overrides.has(file) || r1Overrides.has(file)) continue;
    assert.equal(sha256File(file), expected, `[V148 preserved by V152-C0-R1] ${file}`);
}
for (const [file, expected] of Object.entries(v152.value.protectedFiles)) {
    if (c0Overrides.has(file) || r1Overrides.has(file)) continue;
    assert.equal(sha256File(file), expected, `[V152-B preserved by V152-C0-R1] ${file}`);
}
for (const [file, expected] of Object.entries(c0.value.protectedFiles)) {
    if (r1Overrides.has(file)) continue;
    assert.equal(sha256File(file), expected, `[V152-C0 preserved by V152-C0-R1] ${file}`);
}
for (const [file, expected] of Object.entries(r1.value.protectedFiles)) {
    assert.equal(sha256File(file), expected, `[V152-C0-R1] ${file}`);
}

const inheritedProtectedFiles = Object.freeze({
    ...v148.value.protectedFiles,
    ...v152.value.protectedFiles,
    ...c0.value.protectedFiles,
    ...r1.value.protectedFiles
});
globalThis.__VITALISMEN_V148_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: v148.value.freezeId,
    manifestSha256: crypto.createHash('sha256').update(v148.text).digest('hex'),
    protectedFiles: inheritedProtectedFiles
});
globalThis.__VITALISMEN_V152_B_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: v152.value.freezeId,
    manifestSha256: crypto.createHash('sha256').update(v152.text).digest('hex'),
    protectedFiles: Object.freeze({ ...v152.value.protectedFiles, ...c0.value.protectedFiles, ...r1.value.protectedFiles })
});
globalThis.__VITALISMEN_V152_C0_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: c0.value.freezeId,
    manifestSha256: crypto.createHash('sha256').update(c0.text).digest('hex'),
    protectedFiles: Object.freeze({ ...c0.value.protectedFiles, ...r1.value.protectedFiles })
});
globalThis.__VITALISMEN_V152_C0_R1_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: r1.value.freezeId,
    manifestSha256: crypto.createHash('sha256').update(r1.text).digest('hex'),
    protectedFiles: Object.freeze({ ...r1.value.protectedFiles })
});

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([
        ...(globalThis[key] || []),
        ...(v148.value.overrides || []),
        ...v152Overrides,
        ...c0Overrides,
        ...r1Overrides
    ])];
}
