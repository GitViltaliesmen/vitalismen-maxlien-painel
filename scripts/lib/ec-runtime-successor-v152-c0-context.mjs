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

const c0 = canonicalText(new URL('../../docs/freeze/ec-multi-channel-control-plane-v152-c0-20260912.json', import.meta.url));
assert.equal(c0.value.freezeId, 'EC_MULTI_CHANNEL_CONTROL_PLANE_V152_C0_20260912');
assert.equal(c0.value.policy.realPairing, 0);
assert.equal(c0.value.policy.realOutbound, 0);
assert.equal(c0.value.policy.realCustomerRouting, 0);
assert.equal(c0.value.policy.samePhoneDualProvider, 'FORBIDDEN');

const v152 = canonicalText(new URL('../../docs/freeze/ec-provider-independent-core-v152-b-20260911.json', import.meta.url));
const v148 = canonicalText(new URL('../../docs/freeze/ec-meta-funnel-v148-20260910.json', import.meta.url));
const c0Overrides = new Set(Object.keys(c0.value.protectedFiles));
const v152Overrides = new Set(Object.keys(v152.value.protectedFiles));

for (const [file, expected] of Object.entries({ ...v148.value.preservedFiles, ...v148.value.protectedFiles })) {
    if (v152Overrides.has(file) || c0Overrides.has(file)) continue;
    assert.equal(sha256File(file), expected, `[V148 preserved by V152-C0] ${file}`);
}
for (const [file, expected] of Object.entries(v152.value.protectedFiles)) {
    if (c0Overrides.has(file)) continue;
    assert.equal(sha256File(file), expected, `[V152-B preserved by V152-C0] ${file}`);
}
for (const [file, expected] of Object.entries(c0.value.protectedFiles)) {
    assert.equal(sha256File(file), expected, `[V152-C0] ${file}`);
}

globalThis.__VITALISMEN_V148_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: v148.value.freezeId,
    manifestSha256: crypto.createHash('sha256').update(v148.text).digest('hex'),
    protectedFiles: Object.freeze({ ...v148.value.protectedFiles, ...v152.value.protectedFiles, ...c0.value.protectedFiles })
});
globalThis.__VITALISMEN_V152_B_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: v152.value.freezeId,
    manifestSha256: crypto.createHash('sha256').update(v152.text).digest('hex'),
    protectedFiles: Object.freeze({ ...v152.value.protectedFiles, ...c0.value.protectedFiles })
});
globalThis.__VITALISMEN_V152_C0_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: c0.value.freezeId,
    manifestSha256: crypto.createHash('sha256').update(c0.text).digest('hex'),
    protectedFiles: Object.freeze({ ...c0.value.protectedFiles })
});

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([
        ...(globalThis[key] || []),
        ...(v148.value.overrides || []),
        ...v152Overrides,
        ...c0Overrides
    ])];
}
