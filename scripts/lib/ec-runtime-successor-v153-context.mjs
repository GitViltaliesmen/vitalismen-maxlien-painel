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

const v153 = canonicalText(new URL('../../docs/freeze/ec-audio-postsale-recovery-v153-20260913.json', import.meta.url));
const r1 = canonicalText(new URL('../../docs/freeze/ec-multi-channel-control-plane-v152-c0-r1-20260912.json', import.meta.url));
const c0 = canonicalText(new URL('../../docs/freeze/ec-multi-channel-control-plane-v152-c0-20260912.json', import.meta.url));
const v152 = canonicalText(new URL('../../docs/freeze/ec-provider-independent-core-v152-b-20260911.json', import.meta.url));
const v148 = canonicalText(new URL('../../docs/freeze/ec-meta-funnel-v148-20260910.json', import.meta.url));

assert.equal(v153.value.freezeId, 'EC_AUDIO_POSTSALE_RECOVERY_V153_20260913');
assert.equal(v153.value.parentCommit, 'ccbb64e035345bae0d3e4d464485f694a66629e2');
assert.equal(v153.value.parentTree, '588f5f91842396b310600ba68c8fee50d7daebf6');
assert.equal(v153.value.policy.panelAuthenticationRequired, true);
assert.equal(v153.value.policy.audioUploadProviderCalls, 0);
assert.equal(v153.value.policy.productionWhatsAppNumberChanged, false);
assert.equal(v153.value.policy.dropiOrderCreationChanged, false);
assert.equal(v153.value.policy.metaCapiChanged, false);
assert.equal(v153.value.policy.historicalBurstAllowed, false);
assert.equal(v153.value.policy.genericMongoWriteAllowed, false);

const v153Overrides = new Set(v153.value.overrides || []);
assert.deepEqual([...v153Overrides].sort(), Object.keys(v153.value.protectedFiles || {}).sort());
const r1Overrides = new Set(Object.keys(r1.value.protectedFiles));
const c0Overrides = new Set(Object.keys(c0.value.protectedFiles));
const v152Overrides = new Set(Object.keys(v152.value.protectedFiles));

for (const [file, expected] of Object.entries({ ...v148.value.preservedFiles, ...v148.value.protectedFiles })) {
    if (v152Overrides.has(file) || c0Overrides.has(file) || r1Overrides.has(file) || v153Overrides.has(file)) continue;
    assert.equal(sha256File(file), expected, `[V148 preserved by V153] ${file}`);
}
for (const [file, expected] of Object.entries(v152.value.protectedFiles)) {
    if (c0Overrides.has(file) || r1Overrides.has(file) || v153Overrides.has(file)) continue;
    assert.equal(sha256File(file), expected, `[V152-B preserved by V153] ${file}`);
}
for (const [file, expected] of Object.entries(c0.value.protectedFiles)) {
    if (r1Overrides.has(file) || v153Overrides.has(file)) continue;
    assert.equal(sha256File(file), expected, `[V152-C0 preserved by V153] ${file}`);
}
for (const [file, expected] of Object.entries(r1.value.protectedFiles)) {
    if (v153Overrides.has(file)) continue;
    assert.equal(sha256File(file), expected, `[V152-C0-R1 preserved by V153] ${file}`);
}
for (const [file, expected] of Object.entries(v153.value.protectedFiles)) {
    assert.equal(sha256File(file), expected, `[V153] ${file}`);
}

const inheritedProtectedFiles = Object.freeze({
    ...v148.value.protectedFiles,
    ...v152.value.protectedFiles,
    ...c0.value.protectedFiles,
    ...r1.value.protectedFiles,
    ...v153.value.protectedFiles
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
    protectedFiles: Object.freeze({
        ...v152.value.protectedFiles,
        ...c0.value.protectedFiles,
        ...r1.value.protectedFiles,
        ...v153.value.protectedFiles
    })
});
globalThis.__VITALISMEN_V152_C0_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: c0.value.freezeId,
    manifestSha256: crypto.createHash('sha256').update(c0.text).digest('hex'),
    protectedFiles: Object.freeze({
        ...c0.value.protectedFiles,
        ...r1.value.protectedFiles,
        ...v153.value.protectedFiles
    })
});
globalThis.__VITALISMEN_V152_C0_R1_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: r1.value.freezeId,
    manifestSha256: crypto.createHash('sha256').update(r1.text).digest('hex'),
    protectedFiles: Object.freeze({ ...r1.value.protectedFiles, ...v153.value.protectedFiles })
});
globalThis.__VITALISMEN_V153_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: v153.value.freezeId,
    manifestSha256: crypto.createHash('sha256').update(v153.text).digest('hex'),
    protectedFiles: Object.freeze({ ...v153.value.protectedFiles })
});

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([
        ...(globalThis[key] || []),
        ...(v148.value.overrides || []),
        ...v152Overrides,
        ...c0Overrides,
        ...r1Overrides,
        ...v153Overrides
    ])];
}
