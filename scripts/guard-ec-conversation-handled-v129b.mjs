import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertManualMediaStorageV129 } from './guard-manual-media-storage-v129.mjs';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const assertConversationHandledV129B = () => {
    const manifest = JSON.parse(read('docs/freeze/ec-conversation-handled-v129b.json'));
    assert.equal(manifest.parentCommit, '40f9ddba7d00eec59fa1c322f684092d1a8c0560');
    assert.equal(manifest.layer, 'CONVERSATION_HANDLED_STATE');
    assert.deepEqual(manifest.overrides, ['public/qr.html', 'scripts/lib/ec-runtime-successor-v97-context.mjs', 'src/routes/whatsapp.js', 'src/services/ecPanelCustomerPersistenceV122Service.js', 'src/services/panelReadStateService.js', 'tests/ec-auth-login-v78-pass-through.test.mjs']);
    assert.equal(hash(read('docs/freeze/ec-admin-dropi-draft-bridge-v128-20260904.json')), manifest.parentManifestSha256);
    const storage = assertManualMediaStorageV129();
    const successorOverrides = new Set(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []);
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) {
        if (successorOverrides.has(file)) continue;
        assert.equal(hash(read(file)), storage.overrides.includes(file) ? storage.protectedFiles[file] : expected, file);
    }
    assert.equal(manifest.bundleSha256, hash(Object.entries(manifest.protectedFiles).map(([file, sha]) => `${file}\0${sha}\n`).join('')));
    const routes = read('src/routes/whatsapp.js').toString();
    assert.equal((routes.match(/panelHandledThroughSeconds\(/g) || []).length, 2);
    assert.match(read('src/services/ecPanelCustomerPersistenceV122Service.js').toString(), /routePath === '\/api\/whatsapp\/chats\/read'/);
    return manifest;
};
if (process.argv[1] === fileURLToPath(import.meta.url)) { assertConversationHandledV129B(); console.log('CONVERSATION_HANDLED_V129B=PASS'); }
