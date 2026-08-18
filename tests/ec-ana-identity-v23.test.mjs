import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('todas as novas saidas textuais oficiais usam Ana Lopez', () => {
    for (const relativePath of [
        '.env.example',
        'public/qr.html',
        'src/services/adminBuyLaterFollowupService.js',
        'src/services/agentProfiles.js',
        'src/services/aiRouter.js',
        'src/services/nitrixProductProfile.js',
        'src/services/openaiService.js',
        'src/services/shipmentMessageService.js',
        'src/services/vitPowerAudioComplementService.js',
        'src/services/vitPowerEvolvedWorkflow.js'
    ]) {
        assert.match(read(relativePath), /Ana L[oó]pez|VITALISMEN_OFFICIAL_AGENT=Ana Lopez|ELEVENLABS_VOICE_ID_ANA_LOPEZ/, relativePath);
    }
    assert.match(read('src/services/agentProfiles.js'), /La conversacion siempre debe salir como Ana López\./);
    assert.match(read('src/services/vitPowerEvolvedWorkflow.js'), /VIT_POWER_OPERATOR_NAME = 'Ana López'/);
});

test('conversas historicas sao reconhecidas sem manter o nome anterior no runtime', () => {
    const conversation = read('src/services/conversationEngine.js');
    assert.match(conversation, /nomes de personas desativadas no runtime/);
    assert.match(conversation, /\(\?:soy\|le saluda\|le habla\)/);
});

test('audios Nitrix identificados com a persona anterior ficam fora de todos os caminhos ativos', () => {
    const profile = read('src/services/nitrixProductProfile.js');
    const runtime = read('src/services/nitrixFastStateService.js');
    const panel = read('public/qr.html');
    const library = read('src/services/audioTemplateService.js');
    const extension = read('extensions/vitalismen-whatsapp-official/legacy-funnel-library.js');
    assert.match(profile, /audioNames: Object\.freeze\(\[\]\)/);
    assert.match(profile, /legacyIdentityAudioQuarantined: true/);
    assert.match(runtime, /legacy_identity_audio_quarantined/);
    for (const source of [panel, library, extension]) assert.doesNotMatch(source, /NITRIX_INICIO_/);
    assert.equal(fs.readdirSync(path.join(root, 'public/media/templates/EC')).some((name) => /^NITRIX_INICIO_/i.test(name)), false);
});

test('painel usa avatar textual AL e nunca solicita a imagem quebrada da identidade anterior', () => {
    const panel = read('public/qr.html');
    assert.match(panel, /title="Ana López" aria-label="Ana López">AL<\/div>/);
    assert.doesNotMatch(panel, /\/media\/agent\//);
});

test('aceite do operador libera o gate de publicacao sem publicar o candidato', () => {
    const manifest = JSON.parse(read('docs/freeze/ec-ana-identity-v23-20260818.json'));
    const packageJson = JSON.parse(read('package.json'));
    assert.equal(manifest.publicationStatus, 'approved_for_publication');
    assert.equal(manifest.operatorApproval.status, 'approved_in_thread');
    assert.equal(manifest.operatorApproval.approvedAt, '2026-08-18T04:01:11Z');
    assert.equal(manifest.operatorApproval.scope, 'official_agent_ana_lopez_and_active_audio_library');
    assert.equal(manifest.policy.texUltraEntryAudioApprovalStatus, 'approved_by_operator');
    assert.equal(manifest.policy.unlabelledAudioHumanAuditStatus, 'approved_by_operator');
    assert.match(packageJson.scripts['deploy:ec-safe'], /assert-ec-ana-media-approved-v23\.mjs/);
    assert.match(packageJson.scripts['deploy:vps'], /assert-ec-ana-media-approved-v23\.mjs/);
});
