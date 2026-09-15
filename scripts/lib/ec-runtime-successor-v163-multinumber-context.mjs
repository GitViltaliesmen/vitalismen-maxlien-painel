import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const hashBuffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => hashBuffer(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)));
const canonicalJson = (relative) => {
    const text = fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`);
    return { text, value };
};

const current = canonicalJson('docs/freeze/ec-multinumber-shadow-reconciliation-v163-20260915.json');
const manifest = current.value;
assert.equal(manifest.freezeId, 'EC_MULTINUMBER_SHADOW_RECONCILIATION_V163_20260915');
assert.equal(manifest.version, 163);
assert.equal(manifest.parentCommit, 'ecf9ab51c7f65dba00f27a8b9d4d9ffb901639f3');
assert.equal(manifest.parentTree, 'a8d48bde705ae669aeea9ac7dad1d46d9f8a0763');
assert.equal(manifest.sourceCommit, 'f5b84c4003279d07ca6c481ea54fb61f899bdeb6');
assert.equal(manifest.sourceTree, '6b5f06f21738aadb16902e62c41d6086d98a6aa2');
assert.equal(manifest.parentManifestSha256, hashFile(manifest.parentManifest));
assert.equal(manifest.sourceManifestSha256, hashFile(manifest.sourceManifest));
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());

const v164Overrides = new Set(globalThis.__VITALISMEN_V164_OVERRIDE_FILES || []);
for (const [file, expected] of Object.entries(manifest.protectedFiles || {})) {
    if (v164Overrides.has(file)) continue;
    assert.equal(hashFile(file), expected, `[V163] ${file}`);
}
const effectiveProtectedFiles = Object.freeze(Object.fromEntries(
    Object.entries(manifest.protectedFiles || {}).filter(([file]) => !v164Overrides.has(file))
));

const v152ELineage = [
    ['__VITALISMEN_V152_E_CONTEXT', 'docs/freeze/ec-whatsapp-controlled-real-pairing-v152-e-20260912.json'],
    ['__VITALISMEN_V152_E_R1_CONTEXT', 'docs/freeze/ec-whatsapp-real-pairing-test-channel-v152-e-r1-20260912.json'],
    ['__VITALISMEN_V152_E_R2_CONTEXT', 'docs/freeze/ec-whatsapp-native-pairing-code-v152-e-r2-20260912.json'],
    ['__VITALISMEN_V152_E_R3_CONTEXT', 'docs/freeze/ec-whatsapp-br-jid-auth-flush-v152-e-r3-20260912.json'],
    ['__VITALISMEN_V152_E_R4_CONTEXT', 'docs/freeze/ec-whatsapp-persistent-shadow-worker-v152-e-r4-20260912.json']
];
for (const [contextKey, relative] of v152ELineage) {
    const frozen = canonicalJson(relative);
    globalThis[contextKey] = Object.freeze({
        loaded: true,
        freezeId: frozen.value.freezeId,
        manifestSha256: hashBuffer(frozen.text),
        protectedFiles: effectiveProtectedFiles
    });
}

globalThis.__VITALISMEN_V163_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: hashBuffer(current.text),
    protectedFiles: effectiveProtectedFiles
});

for (const contextKey of [
    '__VITALISMEN_V148_CONTEXT',
    '__VITALISMEN_V152_B_CONTEXT',
    '__VITALISMEN_V152_C0_CONTEXT',
    '__VITALISMEN_V152_C0_R1_CONTEXT',
    '__VITALISMEN_V153_CONTEXT',
    '__VITALISMEN_V154_CONTEXT',
    '__VITALISMEN_V155_CONTEXT',
    '__VITALISMEN_V162_CONTEXT'
]) {
    const inherited = globalThis[contextKey];
    if (!inherited?.loaded) continue;
    globalThis[contextKey] = Object.freeze({
        ...inherited,
        protectedFiles: Object.freeze({ ...inherited.protectedFiles, ...effectiveProtectedFiles })
    });
}
