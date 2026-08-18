import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/ecAnaIdentityFreezeRuntimeGuardV23.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const manifest = JSON.parse(read('docs/freeze/ec-ana-identity-v23-20260818.json'));
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const panel = read('public/qr.html');
const profile = read('src/services/nitrixProductProfile.js');
const runtime = read('src/services/nitrixFastStateService.js');

assert.equal(manifest.freezeId, 'ec-ana-identity-v23-20260818');
assert.equal(manifest.parentFreezeId, 'tex-ultra-entry-unread-v22-20260818');
assert.equal(manifest.publicationStatus, 'approved_for_publication');
assert.equal(manifest.operatorApproval.status, 'approved_in_thread');
assert.equal(manifest.operatorApproval.approvedAt, '2026-08-18T04:01:11Z');
assert.equal(manifest.operatorApproval.scope, 'official_agent_ana_lopez_and_active_audio_library');
assert.equal(manifest.policy.officialAgent, 'Ana López');
assert.equal(manifest.policy.allActiveTextUsesOfficialAgent, true);
assert.equal(manifest.policy.legacyIdentityRemovedFromRuntime, true);
assert.equal(manifest.policy.legacyNitrixIdentityAudiosQuarantined, true);
assert.equal(manifest.policy.panelAvatarMode, 'initials_AL');
assert.equal(manifest.policy.texUltraEntryAudioApprovalStatus, 'approved_by_operator');
assert.equal(manifest.policy.unlabelledAudioHumanAuditStatus, 'approved_by_operator');
assert.equal(manifest.policy.productionChanged, false);

assert.match(index, /import '\.\/services\/ecAnaIdentityFreezeRuntimeGuardV23\.js';/);
assert.doesNotMatch(index, /^import '\.\/services\/.+FreezeRuntimeGuardV(?:17|18|19|20|21|22)\.js';$/m);
assert.match(panel, /title="Ana López" aria-label="Ana López">AL<\/div>/);
assert.equal(
    fs.readdirSync('public/media/templates/EC').some((name) => /^NITRIX_INICIO_/i.test(name)),
    false,
    'audios da identidade removida nao podem permanecer publicos'
);
assert.match(profile, /audioNames: Object\.freeze\(\[\]\)/);
assert.match(profile, /legacyIdentityAudioQuarantined: true/);
assert.match(runtime, /legacy_identity_audio_quarantined/);

for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:operational-mode-zapi-health',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'guard:ec-identity',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.match(packageJson.scripts[scriptName], /guard-ec-ana-identity-v23\.mjs/, `${scriptName} deve usar V23`);
}
for (const scriptName of ['deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], /assert-ec-ana-media-approved-v23\.mjs/);
    assert.match(packageJson.scripts[scriptName], /tests\/ec-ana-identity-v23\.test\.mjs/);
}

console.log('[EC-ANA-IDENTITY-GUARD-V23] OK: identidade Ana Lopez e audios aprovados pelo operador; candidato ainda nao publicado.');
