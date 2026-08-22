import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/inboundMediaPathPortabilityFreezeRuntimeGuardV38.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const storageTest = read('tests/inbound-media-storage.test.mjs');
const storageService = read('src/services/inboundMediaStorageService.js');
const successor = 'node src/services/inboundMediaPathPortabilityFreezeRuntimeGuardV38.js';

for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:logistics-clean-chat-v29',
    'guard:deploy-integration-v29-1',
    'guard:operational-mode-zapi-health',
    'guard:media-durability-v30',
    'guard:tex-ultra-how-to-use-v31',
    'guard:official-whatsapp-phone-v32',
    'guard:panel-image-csp-v33',
    'guard:protocolo-g-tex-ultra-v34',
    'guard:ec-product-ingredients-v35',
    'guard:ec-all-products-ingredients-v36',
    'guard:panel-zapi-auth-status-v37',
    'guard:inbound-media-path-portability-v38',
    'guard:ec-nitrix',
    'guard:ec-identity',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.equal(String(packageJson.scripts[scriptName] || '').startsWith(successor), true, `${scriptName} não usa V38`);
}

assert.match(index, /import '\.\/services\/inboundMediaPathPortabilityFreezeRuntimeGuardV38\.js';/);
assert.doesNotMatch(index, /^import '.+panelZapiAuthStatusFreezeRuntimeGuardV37\.js';/m);
assert.match(storageTest, /process\.platform === 'win32'/);
assert.match(storageTest, /path\.join\(path\.resolve\(linuxReleaseRoot\), '\.runtime', 'media', 'inbound'\)/);
assert.match(storageTest, /path\.join\(path\.resolve\('\/tmp\/vitalismen-candidate'\), '\.runtime', 'media', 'inbound'\)/);
assert.match(storageService, /const normalizedCwd = path\.resolve\(cwd\)/);
assert.match(storageService, /return '\/opt\/vitalismen-automacao\/shared\/media\/inbound'/);
assert.match(packageJson.scripts['senior:check'], /inbound-media-path-portability-v38\.test\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-inbound-media-path-portability-activation-approved-v38\.mjs/);

console.log('INBOUND_MEDIA_PATH_PORTABILITY_V38_GUARD=OK');
