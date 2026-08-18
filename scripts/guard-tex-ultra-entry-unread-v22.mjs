import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/texUltraEntryUnreadFreezeRuntimeGuardV22.js');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/tex-ultra-entry-unread-v22-20260818.json'));
const greeting = read('src/services/texUltraEntryGreetingService.js');
const profile = read('src/services/texUltraProductProfile.js');
const layer = read('src/services/texUltraInitialLayerService.js');
const route = read('src/routes/whatsapp.js');
const panel = read('public/qr.html');
const index = read('src/index.js');
const packageJson = JSON.parse(read('package.json'));
const successorPattern = /guard-tex-ultra-entry-unread-v22\.mjs/;

assert.equal(manifest.freezeId, 'tex-ultra-entry-unread-v22-20260818');
assert.equal(manifest.parentFreezeId, 'panel-call-dropi-safety-v21-20260817');
assert.equal(manifest.publicationStatus, 'candidate_not_published');
assert.equal(manifest.policy.singleEntryAudio, true);
assert.equal(manifest.policy.personalizedGreetingBeforeAudio, true);
assert.equal(manifest.policy.timezone, 'America/Guayaquil');
assert.equal(manifest.policy.audioHumanApprovalRequired, true);
assert.equal(manifest.policy.audioHumanApprovalStatus, 'pending_operator_listen');
assert.equal(manifest.policy.unreadAliasAggregation, true);
assert.equal(manifest.policy.readThroughMessageTimestamp, true);
assert.equal(manifest.policy.productionChanged, false);

assert.match(index, /import '\.\/services\/texUltraEntryUnreadFreezeRuntimeGuardV22\.js';/);
assert.doesNotMatch(index, /^import '\.\/services\/.+FreezeRuntimeGuardV(?:17|18|19|20|21)\.js';$/m);
assert.match(greeting, /America\/Guayaquil/);
assert.match(greeting, /Soy Ana López, asistente de la Dra\. María Fernandes/);
assert.match(greeting, /hour >= 5 && hour <= 11/);
assert.match(greeting, /hour >= 12 && hour <= 17/);
assert.match(profile, /universalAudioName: 'CONHECER_NECESSIDADES_CLIENTES'/);
assert.match(profile, /audioNames: Object\.freeze\(\['CONHECER_NECESSIDADES_CLIENTES'\]\)/);
assert.doesNotMatch(profile, /01_B_Buenos_dias|01_C_Buenos_tardes/);
assert.deepEqual(
    [...layer.matchAll(/Object\.freeze\(\{ key: '([^']+)'/g)].slice(0, 5).map((match) => match[1]),
    ['greeting', 'intro', 'proof', 'bottle', 'offer']
);
assert.match(layer, /antiSpamKey: `\$\{TEX_ULTRA_INITIAL_LAYER_ID\}:greeting:/);
assert.match(layer, /universalIntroSentAt/);
assert.match(route, /panelLastReadMarkerSeconds\(contactStates\)/);
assert.match(route, /fastReadMarkerForChat/);
assert.match(route, /panelReadIdentityQuery\(\{ chatId: rawChatId, phone: digits \}\)/);
assert.match(route, /const matchingStates = await ContactState\.find\(query\)/);
assert.match(route, /'metadata\.panelLastReadMessageTimestamp': latestInboundTimestamp/);
assert.match(panel, /markSelectedChatRead\(\{ silent: true \}\)/);
assert.match(panel, /TEX_ULTRA_UNIVERSAL_ENTRY_AUDIO_EC/);
assert.match(panel, /tex_ultra_personalized_entry/);

for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:operational-mode-zapi-health',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.match(packageJson.scripts[scriptName], successorPattern, `${scriptName} deve usar V22`);
}
for (const scriptName of ['deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], /assert-tex-ultra-entry-audio-approved-v22\.mjs/);
}
for (const scriptName of ['senior:check', 'deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], /tests\/tex-ultra-entry-unread-v22\.test\.mjs/);
    assert.match(packageJson.scripts[scriptName], /tests\/whatsapp-chat-read-persistence-v22\.test\.mjs/);
    assert.match(packageJson.scripts[scriptName], /scripts\/test-tex-ultra-initial-cadence\.mjs/);
    assert.match(packageJson.scripts[scriptName], /scripts\/test-tex-ultra-initial-concurrency\.mjs/);
}

console.log(`[TEX-ULTRA-ENTRY-UNREAD-GUARD-V22] OK: ${manifest.freezeId}; publicacao continua bloqueada ate aceite humano do audio.`);
