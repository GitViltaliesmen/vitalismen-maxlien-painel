import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const customerFacingFiles = [
    '.env.example',
    'public/qr.html',
    'extensions/vitalismen-whatsapp-official/legacy-funnel-library.js',
    'scripts/plan-2800-failover-rescue.mjs',
    'src/services/adminBuyLaterFollowupService.js',
    'src/services/agentProfiles.js',
    'src/services/aiRouter.js',
    'src/services/audioService.js',
    'src/services/nitrixProductProfile.js',
    'src/services/openaiService.js',
    'src/services/passiveFunnelObserverService.js',
    'src/services/shipmentMessageService.js',
    'src/services/texUltraEntryGreetingService.js',
    'src/services/vitPowerAudioComplementService.js',
    'src/services/vitPowerEvolvedWorkflow.js'
];

for (const relativePath of customerFacingFiles) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, `arquivo ausente: ${relativePath}`);
}

const envExample = read('.env.example');
const panel = read('public/qr.html');
const profiles = read('src/services/agentProfiles.js');
const workflow = read('src/services/vitPowerEvolvedWorkflow.js');
const nitrix = read('src/services/nitrixProductProfile.js');
const nitrixRuntime = read('src/services/nitrixFastStateService.js');
const audioTemplates = read('src/services/audioTemplateService.js');
const audioService = read('src/services/audioService.js');
const conversation = read('src/services/conversationEngine.js');
const extension = read('extensions/vitalismen-whatsapp-official/legacy-funnel-library.js');

assert.match(envExample, /^VITALISMEN_OFFICIAL_AGENT=Ana Lopez$/m);
assert.match(envExample, /^ELEVENLABS_VOICE_ID_ANA_LOPEZ=$/m);
assert.match(profiles, /La conversacion siempre debe salir como Ana López\./);
assert.match(workflow, /export const VIT_POWER_OPERATOR_NAME = 'Ana López';/);
assert.match(panel, /title="Ana López" aria-label="Ana López">AL<\/div>/);
assert.doesNotMatch(panel, /\/media\/agent\//);
assert.match(panel, /nitrix_ana_entry/);
assert.match(nitrix, /audioNames: Object\.freeze\(\[\]\)/);
assert.match(nitrix, /legacyIdentityAudioQuarantined: true/);
assert.match(nitrixRuntime, /legacy_identity_audio_quarantined/);
assert.equal(fs.readdirSync(path.join(root, 'public/media/templates/EC')).some((name) => /^NITRIX_INICIO_/i.test(name)), false);
assert.doesNotMatch(audioTemplates, /NITRIX_INICIO_/);
assert.doesNotMatch(extension, /NITRIX_INICIO_/);
assert.match(audioService, /ELEVENLABS_VOICE_ID_ANA_LOPEZ/);
assert.doesNotMatch(audioService, /EtnafgWR3KNOASvt1grF/);
assert.match(conversation, /nomes de personas desativadas no runtime/);
assert.match(conversation, /\(\?:soy\|le saluda\|le habla\)/);

console.log('[EC-ANA-IDENTITY] OK: textos ativos usam Ana Lopez; a identidade anterior e seus audios publicos foram removidos do runtime.');
