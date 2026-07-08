import fs from 'fs';
import path from 'path';

const root = process.cwd();
const failures = [];

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const assert = (condition, message) => {
    if (!condition) failures.push(message);
};
const assertIncludes = (file, needle, message) => assert(read(file).includes(needle), `${message} (${file})`);
const assertNotMatches = (file, regex, message) => assert(!regex.test(read(file)), `${message} (${file})`);

const operationalFiles = [
    '.env.example',
    'src/whatsapp/connection.js',
    'src/routes/whatsapp.js',
    'src/services/agentProfiles.js',
    'src/services/openaiService.js',
    'src/services/aiRouter.js',
    'src/services/conversationEngine.js',
    'src/services/vitPowerEvolvedWorkflow.js',
    'src/services/adminBuyLaterFollowupService.js',
    'src/services/shipmentMessageService.js',
    'src/services/vitPowerAudioComplementService.js',
    'src/services/passiveFunnelObserverService.js',
    'src/services/audioService.js',
    'public/qr.html'
];

for (const file of operationalFiles) assert(exists(file), `Arquivo operacional existe: ${file}`);

for (const file of operationalFiles.filter(exists)) {
    assertNotMatches(file, /\bAna\s+Lope[sz]\b/i, 'Sem nome antigo Ana Lopez em texto operacional');
    assertNotMatches(file, /\bAna\s+Lopes\b/i, 'Sem nome antigo Ana Lopes em texto operacional');
    assertNotMatches(file, /\bsoy\s+Ana\b/i, 'Sem apresentacao antiga soy Ana');
    assertNotMatches(file, /ana-lopez-avatar/i, 'Sem avatar publico antigo no painel');
}

assertIncludes('.env.example', 'VITALISMEN_OFFICIAL_AGENT=Valeria Zambrano', 'Env exemplo usa Valeria');
assertIncludes('.env.example', 'ELEVENLABS_VOICE_ID_VALERIA', 'Env exemplo usa variavel de voz Valeria');
assertIncludes('src/services/vitPowerEvolvedWorkflow.js', "export const VIT_POWER_OPERATOR_NAME = 'Valeria Zambrano';", 'Operadora oficial e Valeria');
assertIncludes('src/services/agentProfiles.js', 'La conversacion siempre debe salir como Valeria Zambrano.', 'Prompt trava persona Valeria');
assertIncludes('src/routes/whatsapp.js', "{ sessionId: '553183002800', code: 'VZ', name: 'Valeria Zambrano' }", 'Conexao 2800 nomeada como Valeria');
assertIncludes('public/qr.html', '/media/agent/valeria-zambrano-avatar.jpg', 'Painel usa avatar Valeria');
assertIncludes('public/qr.html', 'title="Valeria Zambrano"', 'Painel mostra Valeria no avatar');
assert(exists('public/media/agent/valeria-zambrano-avatar.jpg'), 'Avatar Valeria existe no public/media/agent');

if (failures.length) {
    console.error('EC Valeria identity guard: FALHOU');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log('EC Valeria identity guard: OK');
