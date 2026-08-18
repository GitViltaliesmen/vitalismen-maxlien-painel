import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];

const assert = (condition, message) => {
    if (!condition) failures.push(message);
};
const assertIncludes = (file, needle, message) => assert(read(file).includes(needle), `${message} (${file})`);
const assertMatches = (file, regex, message) => assert(regex.test(read(file)), `${message} (${file})`);
const assertNotMatches = (file, regex, message) => assert(!regex.test(read(file)), `${message} (${file})`);

const files = [
    'src/models/ContactState.js',
    'src/services/agentProfiles.js',
    'src/routes/whatsapp.js',
    'src/services/conversationEngine.js',
    'public/qr.html',
    'public/n/index.html',
    'public/cta-nx-messages.json'
];

for (const file of files) assert(exists(file), `Arquivo obrigatorio existe: ${file}`);

const forbidden = [
    { label: 'dominio externo', regex: new RegExp(['max', 'tourus'].join(''), 'i') },
    { label: 'pais externo', regex: new RegExp(['colo', 'mbia'].join(''), 'i') },
    { label: 'oferta externa', regex: new RegExp(['super', 'full'].join(''), 'i') },
    { label: 'telefone operacional desativado 2800', regex: /553183002800/ },
    { label: 'telefone operacional desativado 2958', regex: /553171862958/ }
];

for (const file of files.filter(exists)) {
    for (const item of forbidden) assertNotMatches(file, item.regex, `Sem contaminacao por ${item.label}`);
}

assertIncludes('src/services/agentProfiles.js', "key: 'nitrix_ec'", 'Perfil Nitrix EC existe');
assertIncludes('src/services/agentProfiles.js', 'manualOnly: true', 'Perfil Nitrix marcado como manual');
assertMatches('src/services/agentProfiles.js', /getAgentProfile\s*=\s*\(key\s*=\s*'nitrix_ec'\)/, 'Default de agente permanece Nitrix');

assertIncludes('src/models/ContactState.js', "'nitrix_ec'", 'ContactState aceita Nitrix EC como agente');
assertIncludes('src/models/ContactState.js', "'vit_power_ec'", 'ContactState mantem Vit Power EC como agente separado');

assertIncludes('src/routes/whatsapp.js', "nitrix: 'nitrix_ec'", 'Rota publica reconhece Nitrix');
assertIncludes('src/routes/whatsapp.js', "vitPower: 'vit_power_ec'", 'Vit Power continua produto separado');
assertIncludes('src/routes/whatsapp.js', "texUltra: 'tex_ultra_ec'", 'Rota publica reconhece Tex Ultra');
assertIncludes('src/routes/whatsapp.js', "source: 'ec_tex_ultra_vsl'", 'Caminho atual /n atribui Tex Ultra');
assertIncludes('src/routes/whatsapp.js', "tag: 'NITRIX_EC'", 'Lead Nitrix recebe tag propria');
assertIncludes('src/routes/whatsapp.js', "/media/sales/ec/nitrix_bottle.png", 'Lead Nitrix leva frasco Nitrix');

assertIncludes('src/services/conversationEngine.js', "const NITRIX_AGENT_KEY = 'nitrix_ec';", 'Motor conhece agente Nitrix');
assertIncludes('src/services/conversationEngine.js', 'const explicitlyMentionsVitPower', 'Vit Power exige mencao explicita');
assertIncludes('src/services/conversationEngine.js', 'const contactCameFromNitrix', 'Origem Nitrix e detectada pelo motor');
assertIncludes('src/services/conversationEngine.js', 'const holdNitrixForHuman', 'Nitrix trava em atendimento humano');
assertIncludes('src/services/conversationEngine.js', 'BOT_VIT_POWER_BLOQUEADO', 'Contato Nitrix recebe tag de bloqueio Vit Power');
assertMatches('src/services/conversationEngine.js', /handleAgentConversation\s*=\s*async\s*\(msg,\s*agentProfile\s*=\s*AGENT_PROFILES\.nitrix_ec\)/, 'Entrada do bot usa Nitrix como padrao');
assertMatches('src/services/conversationEngine.js', /if\s*\(agentProfile\?\.key\s*===\s*NITRIX_AGENT_KEY\)[\s\S]{0,1200}holdNitrixForHuman[\s\S]{0,600}return;/, 'Nitrix retorna antes do funil Vit Power');

assertIncludes('public/qr.html', 'Frasco Nitrix', 'Painel mostra frasco Nitrix');
assertIncludes('public/qr.html', '/media/sales/ec/nitrix_bottle.png', 'Painel usa midia Nitrix');
assertIncludes('public/qr.html', 'nitrix_inicio_completo', 'Painel tem bloco manual completo Nitrix');
assertIncludes('public/qr.html', 'Saudacao Ana Lopez + Prova 1 + Frasco Nitrix', 'Bloco manual Nitrix usa identidade Ana e preserva prova e frasco');
assertIncludes('public/qr.html', "nitrix_ana_entry: 'Hola, soy Ana López", 'Bloco manual Nitrix prepara a saudacao Ana');
assertNotMatches('public/qr.html', /NITRIX_INICIO_/, 'Audios Nitrix da identidade anterior nao ficam ativos no painel');
assertIncludes('public/qr.html', "nitrix_ec: 'Nitrix EC'", 'Painel nomeia agente Nitrix');
assertNotMatches('src/services/audioTemplateService.js', /NITRIX_INICIO_/, 'Audios Nitrix da identidade anterior foram removidos da biblioteca ativa');
assertIncludes('src/services/nitrixProductProfile.js', 'legacyIdentityAudioQuarantined: true', 'Perfil Nitrix bloqueia os audios da identidade anterior');
assertIncludes('src/services/vitPowerEvolvedWorkflow.js', "export const VIT_POWER_OPERATOR_NAME = 'Ana López';", 'Identidade oficial do atendimento e Ana');
assertIncludes('src/services/agentProfiles.js', 'La conversacion siempre debe salir como Ana López.', 'Prompt de atendimento usa Ana');

assertIncludes('public/n/index.html', 'OFFICIAL_ZAPI_SELLER_E164 = "5515991418416"', 'VSL /n usa telefone 8416');
assertIncludes('public/n/index.html', 'await nextSellerFromServer(message, fullName)', 'VSL /n confirma o telefone conectado antes de abrir WhatsApp');
assertIncludes('public/n/index.html', 'productKey: "tex_ultra_ec"', 'VSL /n envia productKey Tex Ultra');
assertIncludes('public/n/index.html', 'productName: "Tex Ultra Ecuador"', 'VSL /n envia produto Tex Ultra');
assertIncludes('public/n/index.html', 'content_ids: ["tex_ultra_ec"]', 'Meta Lead usa content_id Tex Ultra');

try {
    const cta = JSON.parse(read('public/cta-nx-messages.json'));
    assert(cta.country === 'EC', 'CTA JSON permanece EC');
    assert(cta.productKey === 'tex_ultra_ec', 'CTA JSON productKey Tex Ultra');
    assert(/Tex Ultra Ecuador/i.test(String(cta.product || '')), 'CTA JSON produto Tex Ultra');
    assert(cta.productMedia === '', 'CTA JSON nao reutiliza midia de outro produto');
    assert(Array.isArray(cta.messages) && cta.messages.length >= 4, 'CTA JSON tem mensagens suficientes');
    assert(cta.messages.every((message) => /tex ultra/i.test(String(message))), 'CTA JSON fala Tex Ultra nas mensagens');
} catch (error) {
    failures.push(`CTA JSON invalido: ${error.message}`);
}

const bottlePath = 'public/media/sales/ec/nitrix_bottle.png';
assert(exists(bottlePath), 'Frasco Nitrix existe em public/media/sales/ec');
if (exists(bottlePath)) assert(fs.statSync(path.join(root, bottlePath)).size > 100000, 'Frasco Nitrix nao esta vazio');

const nitrixIntroArtifacts = fs.readdirSync(path.join(root, 'public/media/templates/EC'))
    .filter((name) => /^NITRIX_INICIO_/i.test(name));
assert(nitrixIntroArtifacts.length === 0, 'Nenhum audio da identidade anterior permanece no diretorio publico');

if (failures.length) {
    console.error('EC Nitrix guard: FALHOU');
    for (const item of failures) console.error(`- ${item}`);
    process.exit(1);
}

console.log('EC Nitrix guard: OK');
