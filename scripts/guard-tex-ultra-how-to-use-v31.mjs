import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/texUltraHowToUseAudioFreezeRuntimeGuardV31.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const profile = read('src/services/texUltraProductProfile.js');
const catalog = read('src/services/audioTemplateService.js');
const shipment = read('src/services/shipmentMessageService.js');
const funnel = read('src/services/texUltraFunnelService.js');
const usageService = read('src/services/texUltraHowToUseAudioService.js');
const zapi = read('src/routes/zapi.js');
const whatsapp = read('src/routes/whatsapp.js');
const panel = read('public/qr.html');
const successor = 'node src/services/texUltraHowToUseAudioFreezeRuntimeGuardV31.js';

for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:logistics-clean-chat-v29',
    'guard:deploy-integration-v29-1',
    'guard:operational-mode-zapi-health',
    'guard:media-durability-v30',
    'guard:tex-ultra-how-to-use-v31',
    'guard:ec-nitrix',
    'guard:ec-identity',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.equal(String(packageJson.scripts[scriptName] || '').startsWith(successor), true, `${scriptName} não usa V31`);
}

assert.match(index, /import '\.\/services\/texUltraHowToUseAudioFreezeRuntimeGuardV31\.js';/);
assert.doesNotMatch(index, /mediaDurabilityAuthFreezeRuntimeGuardV30/);
assert.match(profile, /howToUseAudioName: 'MODO_DE_USO_TEX_ULTRA'/);
assert.match(catalog, /'MODO_DE_USO_TEX_ULTRA'/);
assert.match(shipment, /family === 'tex_ultra'/);
assert.match(shipment, /texUltraHowToUseAudioDedupeValue\(howToUseAudioBaseName\)/);
assert.match(funnel, /sendTexUltraHowToUseAudio\(\{ state \}\)/);
assert.match(funnel, /como se usa\|como tomar\|como usar\|modo de uso/);
assert.match(usageService, /allowExistingDropiOrder: true/);
assert.match(usageService, /OutboundDedupe\.findOne/);
assert.doesNotMatch(usageService, /COMO_SE_TOMA_VIT_POWER|NITRIX_USO_OXIDE_EC/);
assert.match(packageJson.scripts['senior:check'], /tex-ultra-how-to-use-audio-v31\.test\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-tex-ultra-how-to-use-activation-approved-v31\.mjs/);

assert.match(zapi, /captureInboundMedia/);
assert.match(whatsapp, /router\.get\('\/media\/:messageId'/);
assert.match(panel, /hydrateAuthenticatedMedia\(box\)/);
assert.match(panel, /VitalismenCleanChatV29\?\.presentMessages/);
assert.doesNotMatch(panel, /mediaToken=|access_token=.*media/i);

console.log('TEX_ULTRA_HOW_TO_USE_AUDIO_V31_GUARD=OK');
