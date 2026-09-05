import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const assertManualMediaStorageV129 = () => {
    const manifest = JSON.parse(read('docs/freeze/manual-media-storage-v129.json'));
    assert.equal(manifest.parentCommit, '5257a5b8b13bbb5a367618888c32b9e335b49024');
    assert.equal(manifest.layer, 'MANUAL_MEDIA_AND_CACHE_STORAGE');
    assert.deepEqual(manifest.overrides, ['scripts/guard-ec-conversation-handled-v129b.mjs', 'scripts/lib/ec-runtime-successor-v97-context.mjs', 'src/index.js', 'src/routes/whatsapp.js', 'tests/ec-auth-login-v78-pass-through.test.mjs']);
    assert.equal(hash(read('docs/freeze/ec-conversation-handled-v129b.json')), manifest.parentManifestSha256);
    const successorOverrides = new Set(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []);
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) {
        if (successorOverrides.has(file)) continue;
        assert.equal(hash(read(file)), expected, file);
    }
    assert.equal(manifest.bundleSha256, hash(Object.entries(manifest.protectedFiles).map(([file, sha]) => `${file}\0${sha}\n`).join('')));
    return manifest;
};
if (process.argv[1] === fileURLToPath(import.meta.url)) { assertManualMediaStorageV129(); console.log('MANUAL_MEDIA_STORAGE_V129=PASS'); }
