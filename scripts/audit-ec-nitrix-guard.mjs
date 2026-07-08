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
    { label: 'telefone antigo A', regex: new RegExp(['5515', '9914', '18416'].join('')) },
    { label: 'telefone antigo B', regex: new RegExp(['1599', '1418', '416'].join('')) },
    { label: 'slot antigo final', regex: new RegExp(`\\b${['84', '16'].join('')}\\b`) }
];

for (const file of files.filter(exists)) {
    for (const item of forbidden) assertNotMatches(file, item.regex, `Sem contaminacao por ${item.label}`);
}

assertIncludes('src/services/agentProfiles.js', "key: 'nitrix_ec'", 'Perfil Nitrix EC existe');
assertIncludes('src/services/agentProfiles.js', 'manualOnly: true', 'Perfil Nitrix marcado como manual');
assertMatches('src/services/agentProfiles.js', /getAgentProfile\s*=\s*\(key\s*=\s*'nitrix_ec'\)/, 'Default de agente permanece Nitrix');

assertIncludes('src/routes/whatsapp.js', "nitrix: 'nitrix_ec'", 'Rota publica reconhece Nitrix');
assertIncludes('src/routes/whatsapp.js', "vitPower: 'vit_power_ec'", 'Vit Power continua produto separado');
assertMatches('src/routes/whatsapp.js', /bodyPath\.startsWith\('\/n'\)[\s\S]{0,80}sourcePath\.startsWith\('\/n'\)/, 'Caminho /n mapeia para Nitrix');
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
assertIncludes('public/qr.html', "nitrix_ec: 'Nitrix EC'", 'Painel nomeia agente Nitrix');

assertIncludes('public/n/index.html', 'OFFICIAL_ZAPI_SELLER_E164 = "553183002800"', 'VSL /n mantem telefone 2800');
assertIncludes('public/n/index.html', 'productKey: "nitrix_ec"', 'VSL /n envia productKey Nitrix');
assertIncludes('public/n/index.html', 'productName: "Nitrix Oxide Ecuador"', 'VSL /n envia produto Nitrix');
assertIncludes('public/n/index.html', 'content_ids: ["nitrix_oxide_ec"]', 'Meta Lead usa content_id Nitrix');

try {
    const cta = JSON.parse(read('public/cta-nx-messages.json'));
    assert(cta.country === 'EC', 'CTA JSON permanece EC');
    assert(cta.productKey === 'nitrix_ec', 'CTA JSON productKey Nitrix');
    assert(/Nitrix Oxide Ecuador/i.test(String(cta.product || '')), 'CTA JSON produto Nitrix');
    assert(cta.productMedia === '/media/sales/ec/nitrix_bottle.png', 'CTA JSON midia Nitrix');
    assert(Array.isArray(cta.messages) && cta.messages.length >= 4, 'CTA JSON tem mensagens suficientes');
    assert(cta.messages.every((message) => /nitrix/i.test(String(message))), 'CTA JSON fala Nitrix nas mensagens');
} catch (error) {
    failures.push(`CTA JSON invalido: ${error.message}`);
}

const bottlePath = 'public/media/sales/ec/nitrix_bottle.png';
assert(exists(bottlePath), 'Frasco Nitrix existe em public/media/sales/ec');
if (exists(bottlePath)) assert(fs.statSync(path.join(root, bottlePath)).size > 100000, 'Frasco Nitrix nao esta vazio');

if (failures.length) {
    console.error('EC Nitrix guard: FALHOU');
    for (const item of failures) console.error(`- ${item}`);
    process.exit(1);
}

console.log('EC Nitrix guard: OK');
