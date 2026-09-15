import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const hashBuffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => hashBuffer(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)));
const url = new URL('../../docs/freeze/ec-web-worker-shadow-activation-v164-20260915.json', import.meta.url);
const text = fs.readFileSync(url, 'utf8');
const manifest = JSON.parse(text);

assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_WEB_WORKER_SHADOW_ACTIVATION_V164_20260915');
assert.equal(manifest.version, 164);
assert.equal(manifest.parentCommit, 'da4547aafb407da7259c312fdd1db46d5519cb91');
assert.equal(manifest.parentTree, 'd398db49ff2023d3d730fc9bd686ffe774265d93');
assert.equal(manifest.parentManifestSha256, hashFile(manifest.parentManifest));
for (const [file, expected] of Object.entries({ ...manifest.protectedFiles, ...manifest.preservedFiles })) {
    assert.equal(hashFile(file), expected, `[V164] ${file}`);
}

const protectedFiles = Object.freeze({ ...manifest.protectedFiles, ...manifest.preservedFiles });
globalThis.__VITALISMEN_V164_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: hashBuffer(text),
    protectedFiles
});

for (const key of [
    '__VITALISMEN_V148_CONTEXT',
    '__VITALISMEN_V152_B_CONTEXT',
    '__VITALISMEN_V152_C0_CONTEXT',
    '__VITALISMEN_V152_C0_R1_CONTEXT',
    '__VITALISMEN_V152_E_CONTEXT',
    '__VITALISMEN_V152_E_R1_CONTEXT',
    '__VITALISMEN_V152_E_R2_CONTEXT',
    '__VITALISMEN_V152_E_R3_CONTEXT',
    '__VITALISMEN_V152_E_R4_CONTEXT',
    '__VITALISMEN_V153_CONTEXT',
    '__VITALISMEN_V154_CONTEXT',
    '__VITALISMEN_V155_CONTEXT',
    '__VITALISMEN_V162_CONTEXT',
    '__VITALISMEN_V163_CONTEXT'
]) {
    const inherited = globalThis[key];
    if (!inherited?.loaded) continue;
    globalThis[key] = Object.freeze({
        ...inherited,
        protectedFiles: Object.freeze({ ...inherited.protectedFiles, ...protectedFiles })
    });
}
