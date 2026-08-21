import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

await import('../src/services/mediaDurabilityAuthFreezeRuntimeGuardV30.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const manifest = JSON.parse(read('docs/freeze/media-durability-auth-v30-20260821.json'));
const packageJson = JSON.parse(read('package.json'));

test('V30 sucede exatamente V29.2 e registra autorização posterior ao relatório', () => {
    const parent = fs.readFileSync('docs/freeze/guard-alias-integration-v29-2-20260818.json');
    assert.equal(crypto.createHash('sha256').update(parent).digest('hex'), manifest.parentManifestSha256);
    assert.equal(manifest.parentFreezeId, 'guard-alias-integration-v29-2-20260818');
    assert.equal(manifest.status, 'activation_approved');
    assert.equal(manifest.publicationStatus, 'draft_pr_published_activation_authorized');
    assert.equal(manifest.operatorActivationApproval.status, 'approved_in_thread');
    assert.equal(manifest.operatorActivationApproval.approvedAt, '2026-08-21T18:00:25Z');
    assert.deepEqual(manifest.operatorActivationApproval.constraints, [
        'no_mass_sends',
        'controlled_audio_image_canary',
        'preserve_zapi_until_whatsapp_web_is_ready'
    ]);
    assert.equal(manifest.policy.cleanChatV29Preserved, true);
    assert.equal(manifest.policy.commercialFlowChanged, false);
});

test('startup e aliases oficiais usam somente o sucessor V30', () => {
    const index = read('src/index.js');
    const successor = 'node src/services/mediaDurabilityAuthFreezeRuntimeGuardV30.js';
    assert.match(index, /mediaDurabilityAuthFreezeRuntimeGuardV30/);
    assert.doesNotMatch(index, /guardAliasIntegrationFreezeRuntimeGuardV292/);
    for (const scriptName of [
        'senior:check',
        'guard:whatsapp-chats-readonly',
        'guard:logistics-clean-chat-v29',
        'guard:operational-mode-zapi-health',
        'guard:media-durability-v30',
        'deploy:ec-safe',
        'deploy:vps'
    ]) {
        assert.equal(String(packageJson.scripts[scriptName] || '').startsWith(successor), true, scriptName);
    }
});

test('contrato V30 protege persistência, autenticação e uma bolha por provider ID', () => {
    const schema = read('src/models/Message.js');
    const zapi = read('src/routes/zapi.js');
    const whatsapp = read('src/routes/whatsapp.js');
    const panel = read('public/qr.html');
    assert.match(schema, /mediaStorageStatus/);
    assert.match(schema, /storedMediaPath: \{ type: String, select: false \}/);
    assert.match(zapi, /captureInboundMedia/);
    assert.match(whatsapp, /router\.get\('\/media\/:messageId'/);
    assert.match(panel, /VitalismenCleanChatV29\?\.presentMessages/);
    assert.match(panel, /hydrateAuthenticatedMedia\(box\)/);
    assert.doesNotMatch(panel, /mediaToken=|access_token=.*media/i);
});

test('deploy é liberado somente pela aprovação posterior ao relatório', () => {
    const result = spawnSync(process.execPath, ['scripts/assert-media-durability-activation-approved-v30.mjs'], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /autorização explícita de ativação verificada/);
    assert.match(packageJson.scripts['deploy:vps'], /assert-media-durability-activation-approved-v30\.mjs/);
});
